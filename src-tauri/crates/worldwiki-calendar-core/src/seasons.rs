extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;

/// Климатический сезон года
/// (Спецификация раздел 2.7 и 3.8)
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CoreSeason {
    pub name: String,
    pub color: String,
    pub months: Vec<usize>,
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

/// Проверяет, не противоречит ли сезон астрономическому солнцестоянию
/// (Спецификация раздел 3.14: предупреждение, если "Лето" назначено на месяцы зимнего солнцестояния)
pub fn is_season_conflicting_with_solstice(
    season_months: &[usize],
    is_summer_season: bool,
    winter_solstice_month: usize,
    total_months: usize,
) -> bool {
    if total_months == 0 {
        return false;
    }
    let target_cold_month = winter_solstice_month % total_months;

    if is_summer_season {
        // Если сезон помечен как "Лето", но содержит месяц зимнего солнцестояния (самый холодный месяц)
        season_months.contains(&target_cold_month)
    } else {
        // Если сезон помечен как "Зима", но содержит месяц летнего солнцестояния (противоположный, + total_months/2)
        let target_hot_month = (target_cold_month + total_months / 2) % total_months;
        season_months.contains(&target_hot_month)
    }
}
