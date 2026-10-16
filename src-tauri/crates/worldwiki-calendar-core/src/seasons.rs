extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;

/// Полушарие планеты/региона для климатических расчетов
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum Hemisphere {
    #[default]
    Northern,
    Southern,
}

/// Климатический сезон года
/// (Спецификация раздел 2.7 и 3.8)
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CoreSeason {
    pub name: String,
    pub color: String,
    pub months: Vec<usize>,
    pub hemisphere: Hemisphere,
}

/// Преобразует день солнцестояния внутри года в номер месяца целевого календаря
#[inline]
pub fn solstice_day_in_year_to_calendar_month(
    solstice_day_in_year: i64,
    regular_month_lengths: &[i32],
) -> usize {
    let mut accumulated = 0i64;
    for (idx, &len) in regular_month_lengths.iter().enumerate() {
        accumulated += len as i64;
        if solstice_day_in_year < accumulated {
            return idx;
        }
    }
    regular_month_lengths.len().saturating_sub(1)
}

/// Находит индекс активного климатического сезона для заданного месяца
/// (Спецификация раздел 3.8)
pub fn find_season_index(month_index: usize, seasons: &[CoreSeason]) -> Option<usize> {
    seasons.iter().position(|s| s.months.contains(&month_index))
}

/// Проверяет, входит ли месяц в климатический сезон
#[inline]
pub fn is_month_in_season(month_index: usize, season: &CoreSeason) -> bool {
    season.months.contains(&month_index)
}

/// Проверяет, не противоречит ли сезон астрономическому солнцестоянию с учетом полушария
/// (В Южном полушарии лето наступает во время зимнего солнцестояния Северного полушария)
pub fn is_season_conflicting_with_solstice_hemisphere(
    season_months: &[usize],
    is_summer_season: bool,
    winter_solstice_month: usize,
    total_months: usize,
    hemisphere: Hemisphere,
) -> bool {
    if total_months == 0 {
        return false;
    }
    let effective_winter_month = match hemisphere {
        Hemisphere::Northern => winter_solstice_month % total_months,
        Hemisphere::Southern => (winter_solstice_month + total_months / 2) % total_months,
    };

    if is_summer_season {
        season_months.contains(&effective_winter_month)
    } else {
        let effective_summer_month = (effective_winter_month + total_months / 2) % total_months;
        season_months.contains(&effective_summer_month)
    }
}

/// Базовая проверка конфликта сезона для Северного полушария (обратная совместимость)
#[inline]
pub fn is_season_conflicting_with_solstice(
    season_months: &[usize],
    is_summer_season: bool,
    winter_solstice_month: usize,
    total_months: usize,
) -> bool {
    is_season_conflicting_with_solstice_hemisphere(
        season_months,
        is_summer_season,
        winter_solstice_month,
        total_months,
        Hemisphere::Northern,
    )
}
