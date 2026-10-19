-- ==============================================================================
-- 08_CALENDARS_AND_PLANETS.SURQL — ПЛАНЕТЫ И КАЛЕНДАРНЫЕ СИСТЕМЫ
-- ==============================================================================

-- 1. СБОР ПОЛНОГО ДЕРЕВА ПЛАНЕТ И КАЛЕНДАРЕЙ ПРОЕКТА В ОДИН ROUNDTRIP
DEFINE FUNCTION OVERWRITE fn::get_planet_calendar_bundle($proj: record<projects> | string) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $planets = (
        SELECT id, project_id, name, ticks_per_day, axial_tilt_mdeg, orbit_days_num, orbit_days_den, moons, created_at, updated_at 
        FROM planets 
        WHERE project_id = $p_rec 
        ORDER BY created_at ASC 
        LIMIT 200
    );
    LET $calendars = (
        SELECT id, project_id, planet_id, name, is_master, is_default, data, created_at, updated_at 
        FROM calendars 
        WHERE project_id = $p_rec 
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
    $id: option<record<planets> | null>,
    $proj: record<projects> | string,
    $name: string,
    $ticks_per_day: int,
    $axial_tilt_mdeg: option<int>,
    $orbit_days_num: option<int>,
    $orbit_days_den: option<int>,
    $moons: option<array<object>>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $ticks_per_day <= 0 {
        THROW "Ticks per day must be strictly positive";
    };
    
    IF $id != NONE AND $id != NULL {
        LET $res = (
            UPSERT $id SET
                project_id = $p_rec,
                name = $name,
                ticks_per_day = $ticks_per_day,
                axial_tilt_mdeg = $axial_tilt_mdeg,
                orbit_days_num = $orbit_days_num,
                orbit_days_den = $orbit_days_den,
                moons = IF $moons != NONE { $moons } ELSE { [] },
                updated_at = time::now()
        );
        RETURN $res[0];
    } ELSE {
        LET $res = (
            CREATE planets SET
                project_id = $p_rec,
                name = $name,
                ticks_per_day = $ticks_per_day,
                axial_tilt_mdeg = $axial_tilt_mdeg,
                orbit_days_num = $orbit_days_num,
                orbit_days_den = $orbit_days_den,
                moons = IF $moons != NONE { $moons } ELSE { [] },
                created_at = time::now(),
                updated_at = time::now()
        );
        RETURN $res[0];
    };
};

-- 3. СОХРАНЕНИЕ КАЛЕНДАРЯ С АТОМАРНОЙ ЗАЩИТОЙ MASTER-КАЛЕНДАРЯ
DEFINE FUNCTION OVERWRITE fn::save_calendar(
    $id: option<record<calendars> | null>,
    $proj: record<projects> | string,
    $planet_id: record<planets> | string,
    $name: string,
    $is_master: bool,
    $data: object
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $pl_rec = type::record('planets', string::split(type::string($planet_id), ':')[-1]);
    
    LET $cal_res = IF $id != NONE AND $id != NULL {
        (UPSERT $id SET
            project_id = $p_rec,
            planet_id = $pl_rec,
            name = $name,
            is_master = $is_master,
            data = $data,
            updated_at = time::now()
        )[0]
    } ELSE {
        (CREATE calendars SET
            project_id = $p_rec,
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
        WHERE project_id = $p_rec AND planet_id = $pl_rec AND id != $cal_res.id;
    };
    
    RETURN $cal_res;
};

-- 4. АТОМАРНАЯ СМЕНА MASTER-КАЛЕНДАРЯ ПЛАНЕТЫ
DEFINE FUNCTION OVERWRITE fn::set_master_calendar(
    $proj: record<projects> | string,
    $planet_id: record<planets> | string,
    $cal_id: record<calendars>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $pl_rec = type::record('planets', string::split(type::string($planet_id), ':')[-1]);
    
    UPDATE calendars SET is_master = false WHERE project_id = $p_rec AND planet_id = $pl_rec;
    UPDATE $cal_id SET is_master = true;
};

-- 5. БЕЗОПАСНОЕ УДАЛЕНИЕ ПЛАНЕТЫ С КАСКАДНОЙ ЗАЩИТОЙ
DEFINE FUNCTION OVERWRITE fn::delete_planet(
    $proj: record<projects> | string,
    $planet_id: record<planets>,
    $cascade: bool
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $child_cals = (SELECT VALUE id FROM calendars WHERE project_id = $p_rec AND planet_id = $planet_id LIMIT 100);
    
    IF array::len($child_cals) > 0 AND $cascade == false {
        THROW "Cannot delete planet with existing calendars without cascade flag";
    };
    
    IF $cascade == true {
        DELETE calendars WHERE project_id = $p_rec AND planet_id = $planet_id;
    };
    
    DELETE $planet_id;
    RETURN true;
};

-- 6. БЕЗОПАСНОЕ УДАЛЕНИЕ КАЛЕНДАРЯ (ПРОВЕРКА СВЯЗЕЙ SYNC_ANCHOR)
DEFINE FUNCTION OVERWRITE fn::delete_calendar($cal_id: record<calendars>) {
    LET $dep_cals = (
        SELECT id, name FROM calendars 
        WHERE data.sync_anchor.master_calendar_id = type::string($cal_id)
        LIMIT 5
    );
    IF array::len($dep_cals) > 0 {
        THROW "Cannot delete calendar: other calendars depend on it via sync_anchor";
    };
    DELETE $cal_id;
    RETURN true;
};
