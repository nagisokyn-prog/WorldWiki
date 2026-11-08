-- ==============================================================================
-- 08_CALENDARS_AND_PLANETS.SURQL — ПЛАНЕТЫ И КАЛЕНДАРНЫЕ СИСТЕМЫ
-- ==============================================================================

-- 1. СБОР ПОЛНОГО ДЕРЕВА ПЛАНЕТ И КАЛЕНДАРЕЙ ПРОЕКТА В ОДИН ROUNDTRIP
DEFINE FUNCTION OVERWRITE fn::get_planet_calendar_bundle($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $planets = (
        SELECT id, project_id, name, ticks_per_day, axial_tilt_mdeg, orbit_days_num, orbit_days_den, moons, timezones, regions, created_at, updated_at 
        FROM planets 
        WHERE fn::normalize_project_id(project_id) = $p_rec 
        ORDER BY created_at ASC 
        LIMIT 200
    );
    LET $calendars = (
        SELECT id, planet_id, name, is_master, is_default, data, created_at, updated_at 
        FROM calendars 
        WHERE fn::normalize_project_id(planet_id.project_id) = $p_rec 
        ORDER BY created_at ASC 
        LIMIT 500
    );
    RETURN {
        planets: $planets,
        calendars: $calendars
    };
};

-- 2. СОХРАНЕНИЕ / ИБПЕРТ ПЛАНЕТЫ (С ВАЛИДАЦИЕЙ ФИЗИЧЕСКИХ ПАРАМЕТРОВ)
DEFINE FUNCTION OVERWRITE fn::save_planet(
    $id: any,
    $proj: any,
    $name: string,
    $ticks_per_day: any,
    $axial_tilt_mdeg: any,
    $orbit_days_num: any,
    $orbit_days_den: any,
    $moons: any,
    $timezones: any,
    $regions: any
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $clean_ticks = IF $ticks_per_day != NONE AND $ticks_per_day != NULL AND type::int($ticks_per_day) > 0 { type::int($ticks_per_day) } ELSE { 86400 };
    
    LET $clean_moons = IF $moons != NONE AND $moons != NULL { $moons } ELSE { [] };
    LET $clean_timezones = IF $timezones != NONE AND $timezones != NULL { $timezones } ELSE { [] };
    LET $clean_regions = IF $regions != NONE AND $regions != NULL { $regions } ELSE { [] };

    LET $str_pl = IF $id != NONE AND $id != NULL {
        string::replace(string::replace(string::replace(string::replace(type::string($id), 'planets:', ''), '⟨', ''), '⟩', ''), '`', '')
    } ELSE {
        NONE
    };
    LET $has_id = $str_pl != NONE AND $str_pl != '' AND $str_pl != 'NONE' AND $str_pl != 'null';
    LET $pl_rec = IF $has_id { type::record('planets', $str_pl) } ELSE { NONE };
    
    IF $has_id {
        -- Защита от угона планеты чужого проекта
        LET $existing = (SELECT id, project_id FROM $pl_rec LIMIT 1);
        IF array::len($existing) > 0 AND fn::normalize_project_id($existing[0].project_id) != $p_rec {
            -- Планета с таким ID принадлежит другому проекту: создаём собственную планету для текущего проекта
            LET $res = (
                CREATE planets SET
                    project_id = $p_rec,
                    name = $name,
                    ticks_per_day = $clean_ticks,
                    axial_tilt_mdeg = $axial_tilt_mdeg,
                    orbit_days_num = $orbit_days_num,
                    orbit_days_den = $orbit_days_den,
                    moons = $clean_moons,
                    timezones = $clean_timezones,
                    regions = $clean_regions,
                    created_at = time::now(),
                    updated_at = time::now()
            );
            RETURN $res[0];
        } ELSE {
            LET $res = (
                UPSERT $pl_rec SET
                    project_id = $p_rec,
                    name = $name,
                    ticks_per_day = $clean_ticks,
                    axial_tilt_mdeg = $axial_tilt_mdeg,
                    orbit_days_num = $orbit_days_num,
                    orbit_days_den = $orbit_days_den,
                    moons = $clean_moons,
                    timezones = $clean_timezones,
                    regions = $clean_regions,
                    updated_at = time::now()
            );
            RETURN $res[0];
        };
    } ELSE {
        LET $res = (
            CREATE planets SET
                project_id = $p_rec,
                name = $name,
                ticks_per_day = $clean_ticks,
                axial_tilt_mdeg = $axial_tilt_mdeg,
                orbit_days_num = $orbit_days_num,
                orbit_days_den = $orbit_days_den,
                moons = $clean_moons,
                timezones = $clean_timezones,
                regions = $clean_regions,
                created_at = time::now(),
                updated_at = time::now()
        );
        RETURN $res[0];
    };
};

-- 3. СОХРАНЕНИЕ КАЛЕНДАРЯ С АТОМАРНОЙ ЗАЩИТОЙ MASTER-КАЛЕНДАРЯ
DEFINE FUNCTION OVERWRITE fn::save_calendar(
    $id: any,
    $proj: any,
    $planet_id: any,
    $name: string,
    $is_master: bool,
    $data: object
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $str_pl = string::replace(string::replace(string::replace(string::replace(type::string($planet_id), 'planets:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $has_pl = $str_pl != NONE AND $str_pl != NULL AND $str_pl != '' AND $str_pl != 'NONE';
    LET $pl_candidate = IF $has_pl { type::record('planets', $str_pl) } ELSE { NONE };

    -- Проверяем, что кандидат-планета принадлежит ЭТОМУ проекту
    LET $verified_pl = IF $has_pl {
        LET $chk = (SELECT VALUE id FROM $pl_candidate WHERE fn::normalize_project_id(project_id) = $p_rec LIMIT 1);
        IF array::len($chk) > 0 { $chk[0] } ELSE { NONE }
    } ELSE {
        NONE
    };

    LET $pl_rec = IF $verified_pl != NONE { 
        $verified_pl 
    } ELSE { 
        LET $existing_p = (SELECT VALUE id FROM planets WHERE fn::normalize_project_id(project_id) = $p_rec LIMIT 1);
        IF array::len($existing_p) > 0 { 
            $existing_p[0] 
        } ELSE { 
            -- Автоматическое создание планеты для этого проекта по аналогии с первым томом
            (CREATE planets SET
                project_id = $p_rec,
                name = 'Земля',
                ticks_per_day = 86400,
                axial_tilt_mdeg = 23440,
                orbit_days_num = 3652422,
                orbit_days_den = 10000,
                moons = [],
                timezones = [],
                regions = [],
                created_at = time::now(),
                updated_at = time::now()
                RETURN VALUE id)[0]
        }
    };
    
    LET $str_id = string::replace(string::replace(string::replace(string::replace(type::string($id), 'calendars:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $has_id = $id != NONE AND $id != NULL AND $str_id != '' AND $str_id != 'NONE' AND $str_id != 'null';
    LET $cal_rec = IF $has_id { type::record('calendars', $str_id) } ELSE { NONE };
    
    LET $cal_res = IF $has_id {
        (UPSERT $cal_rec SET
            planet_id = $pl_rec,
            name = $name,
            is_master = $is_master,
            data = $data,
            updated_at = time::now()
        )[0]
    } ELSE {
        (CREATE calendars SET
            planet_id = $pl_rec,
            name = $name,
            is_master = $is_master,
            data = $data,
            created_at = time::now(),
            updated_at = time::now()
        )[0]
    };
    
    -- Инвариант: ровно один master на планету
    IF $is_master == true {
        UPDATE calendars SET is_master = false 
        WHERE planet_id = $pl_rec AND id != $cal_res.id;
    };
    
    RETURN $cal_res;
};

-- 4. АТОМАРНАЯ СМЕНА MASTER-КАЛЕНДАРЯ ПЛАНЕТЫ
DEFINE FUNCTION OVERWRITE fn::set_master_calendar(
    $proj: any,
    $planet_id: any,
    $cal_id: any
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $str_pl = string::replace(string::replace(string::replace(string::replace(type::string($planet_id), 'planets:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $has_pl = $str_pl != NONE AND $str_pl != NULL AND $str_pl != '' AND $str_pl != 'NONE';
    LET $pl_candidate = IF $has_pl { type::record('planets', $str_pl) } ELSE { NONE };
    LET $verified_pl = IF $has_pl {
        LET $chk = (SELECT VALUE id FROM $pl_candidate WHERE fn::normalize_project_id(project_id) = $p_rec LIMIT 1);
        IF array::len($chk) > 0 { $chk[0] } ELSE { NONE }
    } ELSE {
        NONE
    };
    LET $pl_rec = IF $verified_pl != NONE { 
        $verified_pl 
    } ELSE { 
        LET $existing_p = (SELECT VALUE id FROM planets WHERE fn::normalize_project_id(project_id) = $p_rec LIMIT 1);
        IF array::len($existing_p) > 0 { $existing_p[0] } ELSE { type::record('planets', rand::uuid::v4()) }
    };
    LET $str_cal = string::replace(string::replace(string::replace(string::replace(type::string($cal_id), 'calendars:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $c_rec = type::record('calendars', $str_cal);
    
    UPDATE calendars SET is_master = false WHERE planet_id = $pl_rec;
    UPDATE $c_rec SET is_master = true;
};

-- 5. БЕЗОПАСНОЕ УДАЛЕНИЕ ПЛАНЕТЫ С КАСКАДНОЙ ЗАЩИТОЙ
DEFINE FUNCTION OVERWRITE fn::delete_planet(
    $proj: record<projects> | string,
    $planet_id: record<planets>,
    $cascade: bool
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $child_cals = (SELECT VALUE id FROM calendars WHERE planet_id = $planet_id LIMIT 100);
    
    IF array::len($child_cals) > 0 AND $cascade == false {
        THROW "Cannot delete planet with existing calendars without cascade flag";
    };
    
    IF $cascade == true {
        DELETE calendars WHERE planet_id = $planet_id;
    };
    
    DELETE $planet_id;
    RETURN true;
};

-- 6. БЕЗОПАСНОЕ УДАЛЕНИЕ КАЛЕНДАРЯ (ПРОВЕРКА СВЯЗЕЙ SYNC_ANCHOR)
DEFINE FUNCTION OVERWRITE fn::delete_calendar($cal_id: any) {
    LET $rec = IF string::starts_with(type::string($cal_id), 'calendars:') { type::record($cal_id) } ELSE { type::record('calendars', $cal_id) };
    LET $dep_cals = (
        SELECT id, name FROM calendars 
        WHERE data.sync_anchor.master_calendar_id = type::string($rec)
        LIMIT 5
    );
    IF array::len($dep_cals) > 0 {
        THROW "Cannot delete calendar: other calendars depend on it via sync_anchor";
    };
    DELETE $rec;
    RETURN true;
};

-- 7. ПОЛУЧЕНИЕ СОБЫТИЯ ТАЙМЛАЙНА ПО ID
DEFINE FUNCTION OVERWRITE fn::get_timeline_event($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'timeline_events:') { type::record($id) } ELSE { type::record('timeline_events', $id) };
    LET $res = (SELECT id, project_id, calendar_id, title, description, m_abs, created_at FROM $rec LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 8. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ СОБЫТИЯ ТАЙМЛАЙНА
DEFINE FUNCTION OVERWRITE fn::save_timeline_event(
    $id: any,
    $proj: any,
    $cal_id: any,
    $title: string,
    $description: option<string>,
    $m_abs: int
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $c_rec = IF $cal_id != NONE AND $cal_id != NULL AND type::string($cal_id) != '' {
        IF string::starts_with(type::string($cal_id), 'calendars:') { type::record($cal_id) } ELSE { type::record('calendars', $cal_id) }
    } ELSE { NONE };
    
    LET $res = IF $id != NONE AND $id != NULL AND type::string($id) != '' {
        LET $rec = IF string::starts_with(type::string($id), 'timeline_events:') { type::record($id) } ELSE { type::record('timeline_events', $id) };
        (UPSERT $rec SET
            title = $title,
            description = $description,
            m_abs = $m_abs,
            project_id = $p_rec,
            calendar_id = $c_rec
        )
    } ELSE {
        (CREATE timeline_events SET
            title = $title,
            description = $description,
            m_abs = $m_abs,
            project_id = $p_rec,
            calendar_id = $c_rec,
            created_at = time::now()
        )
    };
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 9. УДАЛЕНИЕ СОБЫТИЯ ТАЙМЛАЙНА
DEFINE FUNCTION OVERWRITE fn::delete_timeline_event($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'timeline_events:') { type::record($id) } ELSE { type::record('timeline_events', $id) };
    DELETE $rec;
};

-- 10. СПИСОК СОБЫТИЙ ТАЙМЛАЙНА ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::list_timeline_events_by_project($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, project_id, calendar_id, title, description, m_abs, created_at FROM timeline_events WHERE project_id = $p_rec ORDER BY m_abs ASC LIMIT 1000);
};

-- 11. ПРИВЯЗКА РАСКРЫТИЯ СОБЫТИЯ В ГЛАВЕ (REVEAL)
DEFINE FUNCTION OVERWRITE fn::add_event_reveal(
    $event_id: any,
    $chapter_id: any,
    $pov_id: any,
    $kind: option<string>,
    $block_id: option<string>
) {
    LET $ev_rec = IF string::starts_with(type::string($event_id), 'timeline_events:') { type::record($event_id) } ELSE { type::record('timeline_events', $event_id) };
    LET $ch_rec = IF string::starts_with(type::string($chapter_id), 'chapters:') { type::record($chapter_id) } ELSE { type::record('chapters', $chapter_id) };
    LET $pov_rec = IF $pov_id != NONE AND $pov_id != NULL AND type::string($pov_id) != '' {
        IF string::starts_with(type::string($pov_id), 'entities:') { type::record($pov_id) } ELSE { type::record('entities', $pov_id) }
    } ELSE { NONE };
    RELATE $ev_rec->revealed_in->$ch_rec CONTENT {
        pov_id: $pov_rec,
        kind: IF $kind != NONE AND $kind != NULL AND type::string($kind) != '' { type::string($kind) } ELSE { 'direct' },
        block_id: IF $block_id != NONE AND $block_id != NULL { type::string($block_id) } ELSE { NONE },
        created_at: time::now()
    };
};

-- 12. УДАЛЕНИЕ РАСКРЫТИЯ СОБЫТИЯ
DEFINE FUNCTION OVERWRITE fn::remove_event_reveal($event_id: any, $chapter_id: any) {
    LET $ev_rec = IF string::starts_with(type::string($event_id), 'timeline_events:') { type::record($event_id) } ELSE { type::record('timeline_events', $event_id) };
    LET $ch_rec = IF string::starts_with(type::string($chapter_id), 'chapters:') { type::record($chapter_id) } ELSE { type::record('chapters', $chapter_id) };
    DELETE revealed_in WHERE in = $ev_rec AND out = $ch_rec;
};
