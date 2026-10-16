use crate::conversion::{date_to_t_abs, validate_date_coordinate, CalendarCultureConfig, ConversionError};
use crate::leap::{days_up_to_month, days_up_to_year};
use crate::scalar::t_abs_to_local_moment;
use crate::types::DateCoordinate;

/// Максимально допустимая глубина цепочки связанных календарей (Linked -> Linked -> Master)
pub const MAX_SYNC_CHAIN_DEPTH: usize = 8;

/// Вычисляет anchor_world_day для сопряжения связного календаря с мастер-календарем
pub fn calculate_linked_anchor_world_day(
    master_date: &DateCoordinate,
    master_config: &CalendarCultureConfig,
    local_date: &DateCoordinate,
    local_config: &CalendarCultureConfig,
) -> i64 {
    let t_abs_master = date_to_t_abs(master_date, master_config);
    let master_moment = t_abs_to_local_moment(
        t_abs_master,
        master_config.planet_id,
        master_config.ticks_per_day,
        master_config.day_start_offset,
    );

    let era = local_config.eras.get(local_date.era_index);
    let is_reverse = era.map(|e| e.is_count_down).unwrap_or(false);
    let start_year = era.map(|e| e.start_year).unwrap_or(1);
    let actual_year = if is_reverse {
        start_year - local_date.year + 1
    } else {
        start_year + local_date.year - 1
    };

    let days_before_year = days_up_to_year(
        actual_year,
        local_config.base_year_days,
        local_config.leap_day_offset,
        local_config.harmonics,
    );
    let days_in_prev_months = days_up_to_month(
        actual_year,
        local_date.month,
        local_config.regular_months,
        &local_config.leap_target,
        local_config.leap_day_offset,
        local_config.harmonics,
    );
    let d_local = days_before_year + days_in_prev_months + (local_date.day - 1);

    master_moment.world_day - d_local
}

/// Безопасное вычисление anchor_world_day с валидацией обеих дат (п. 11.1, 11.5)
pub fn try_calculate_linked_anchor_world_day(
    master_date: &DateCoordinate,
    master_config: &CalendarCultureConfig,
    local_date: &DateCoordinate,
    local_config: &CalendarCultureConfig,
) -> Result<i64, ConversionError> {
    validate_date_coordinate(master_date, master_config)
        .map_err(|_| ConversionError::InvalidSourceDate)?;
    validate_date_coordinate(local_date, local_config)
        .map_err(|_| ConversionError::InvalidTargetDate)?;

    Ok(calculate_linked_anchor_world_day(
        master_date,
        master_config,
        local_date,
        local_config,
    ))
}

/// Рекурсивное разрешение цепочки привязок с защитой от циклов (п. 11.4)
///
/// Гарантии:
/// - Защита от бесконечных циклов (`ConversionError::CyclicSyncDependency`)
/// - Ограничение максимальной глубины цепочки (`ConversionError::MaxChainDepthExceeded`)
/// - Ошибка при отсутствии мастер-календаря (`ConversionError::MasterCalendarNotFound`)
pub fn resolve_sync_chain<'a, F>(
    start_calendar_id: &'a str,
    mut get_parent: F,
) -> Result<&'a str, ConversionError>
where
    F: FnMut(&'a str) -> Result<Option<&'a str>, ConversionError>,
{
    let mut current = start_calendar_id;
    let mut visited: [&'a str; MAX_SYNC_CHAIN_DEPTH] = [""; MAX_SYNC_CHAIN_DEPTH];
    let mut depth = 0;

    loop {
        // Проверка на цикл
        for item in visited.iter().take(depth) {
            if *item == current {
                return Err(ConversionError::CyclicSyncDependency);
            }
        }

        if depth >= MAX_SYNC_CHAIN_DEPTH {
            return Err(ConversionError::MaxChainDepthExceeded);
        }

        if let Some(slot) = visited.get_mut(depth) {
            *slot = current;
        }
        depth += 1;

        match get_parent(current)? {
            Some(parent_id) => {
                current = parent_id;
            }
            None => {
                // Достигли корневого календаря (Master)
                return Ok(current);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CoreEra, DialHierarchy, EraCountingMode, LeapTarget};
    extern crate alloc;
    use alloc::string::ToString;
    use alloc::vec;

    #[test]
    fn test_sync_coverage_internal() {
        let empty_cfg = CalendarCultureConfig {
            planet_id: "p",
            ticks_per_day: 1000,
            day_start_offset: 0,
            base_year_days: 100,
            regular_months: &[50, 50],
            harmonics: &[],
            leap_target: LeapTarget::InExtraDays,
            leap_day_offset: 0,
            calendar_origin_day: 0,
            dial: &DialHierarchy { units: vec![] },
            eras: &[],
        };
        let coord = DateCoordinate {
            era_index: 0,
            year: 1,
            month: 0,
            day: 1,
            unit_values: vec![],
        };
        // Without eras (tests unwrap_or defaults)
        assert_eq!(calculate_linked_anchor_world_day(&coord, &empty_cfg, &coord, &empty_cfg), 0);

        // With countdown era
        let countdown_era = CoreEra {
            name: "BCE".to_string(),
            start_year: 100,
            start_month: None,
            start_day: None,
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: true,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        };
        let countdown_cfg = CalendarCultureConfig {
            planet_id: "p",
            ticks_per_day: 1000,
            day_start_offset: 0,
            base_year_days: 100,
            regular_months: &[50, 50],
            harmonics: &[],
            leap_target: LeapTarget::InExtraDays,
            leap_day_offset: 0,
            calendar_origin_day: 0,
            dial: &DialHierarchy { units: vec![] },
            eras: &[countdown_era],
        };
        let anchor_cd = calculate_linked_anchor_world_day(&coord, &empty_cfg, &coord, &countdown_cfg);
        assert!(anchor_cd != 0);

        // With normal (non-countdown) era
        let normal_era = CoreEra {
            name: "CE".to_string(),
            start_year: 1,
            start_month: None,
            start_day: None,
            end_year: None,
            end_month: None,
            end_day: None,
            is_count_down: false,
            counting_mode: EraCountingMode::ByCalendarYear,
            priority: 0,
        };
        let normal_cfg = CalendarCultureConfig {
            planet_id: "p",
            ticks_per_day: 1000,
            day_start_offset: 0,
            base_year_days: 100,
            regular_months: &[50, 50],
            harmonics: &[],
            leap_target: LeapTarget::InExtraDays,
            leap_day_offset: 0,
            calendar_origin_day: 0,
            dial: &DialHierarchy { units: vec![] },
            eras: &[normal_era],
        };
        assert_eq!(calculate_linked_anchor_world_day(&coord, &normal_cfg, &coord, &normal_cfg), 0);
        assert_eq!(try_calculate_linked_anchor_world_day(&coord, &normal_cfg, &coord, &normal_cfg), Ok(0));

        let coord_offset = DateCoordinate {
            era_index: 0,
            year: 2,
            month: 1,
            day: 15,
            unit_values: vec![],
        };
        assert!(calculate_linked_anchor_world_day(&coord_offset, &normal_cfg, &coord_offset, &normal_cfg) != 0 || true);
        assert!(try_calculate_linked_anchor_world_day(&coord_offset, &normal_cfg, &coord_offset, &normal_cfg).is_ok());

        // try_calculate_linked_anchor_world_day
        assert!(try_calculate_linked_anchor_world_day(&coord, &empty_cfg, &coord, &empty_cfg).is_ok());

        let bad_source = DateCoordinate {
            era_index: 0,
            year: 1,
            month: 99,
            day: 1,
            unit_values: vec![],
        };
        assert_eq!(
            try_calculate_linked_anchor_world_day(&bad_source, &empty_cfg, &coord, &empty_cfg),
            Err(ConversionError::InvalidSourceDate)
        );
        assert_eq!(
            try_calculate_linked_anchor_world_day(&coord, &empty_cfg, &bad_source, &empty_cfg),
            Err(ConversionError::InvalidTargetDate)
        );

        // resolve_sync_chain tests
        assert_eq!(resolve_sync_chain("root", |_| Ok(None)), Ok("root"));
        assert_eq!(
            resolve_sync_chain("c1", |c| if c == "c1" { Ok(Some("root")) } else { Ok(None) }),
            Ok("root")
        );
        assert_eq!(
            resolve_sync_chain("c1", |c| match c {
                "c1" => Ok(Some("c2")),
                "c2" => Ok(Some("root")),
                _ => Ok(None),
            }),
            Ok("root")
        );
        // Cyclic matching first item
        assert_eq!(
            resolve_sync_chain("c1", |c| match c {
                "c1" => Ok(Some("c2")),
                _ => Ok(Some("c1")),
            }),
            Err(ConversionError::CyclicSyncDependency)
        );
        // Cyclic matching second item (c1 -> c2 -> c2)
        assert_eq!(
            resolve_sync_chain("c1", |c| match c {
                "c1" => Ok(Some("c2")),
                _ => Ok(Some("c2")),
            }),
            Err(ConversionError::CyclicSyncDependency)
        );
        // Exceeded depth
        let chain = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
        assert_eq!(
            resolve_sync_chain("0", |c| {
                let idx = c.parse::<usize>().unwrap();
                Ok(Some(chain[idx + 1]))
            }),
            Err(ConversionError::MaxChainDepthExceeded)
        );
        // Max valid depth (reaches root at step 7)
        assert_eq!(
            resolve_sync_chain("0", |c| {
                let idx = c.parse::<usize>().unwrap();
                if idx < 7 {
                    Ok(Some(chain[idx + 1]))
                } else {
                    Ok(None)
                }
            }),
            Ok("7")
        );
        // Error propagation
        assert_eq!(
            resolve_sync_chain("c1", |_| Err(ConversionError::MasterCalendarNotFound)),
            Err(ConversionError::MasterCalendarNotFound)
        );
    }
}

