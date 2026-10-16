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
        } else {
            return Err(ConversionError::MaxChainDepthExceeded);
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
