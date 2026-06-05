/**
 * @file calendar-helper.ts
 * @description Вспомогательные функции для работы с календарём
 */

interface CalendarMonth {
  название: string;
  дней: number;
}

interface CalendarEra {
  название: string;
  год_начала: number;
  год_конца: number;
}

interface SeasonWeather {
  типичная?: string;
}

interface CalendarSeason {
  название: string;
  длительность_в_днях: number;
  месяцы: number[];
  время_восхода?: string;
  время_заката?: string;
  погода?: SeasonWeather;
}

interface MoonPhase {
  название: string;
  луна_номер: number;
  период_в_днях: number;
  описание?: string;
  магический_потенциал?: number;
}

interface CalendarHoliday {
  название: string;
  описание?: string;
  традиции?: string;
  дата_начала?: { месяц: number; день: number };
  дата_конца?: { месяц: number; день: number };
}

interface CalendarTimeSettings {
  часов_в_сутках: number;
  минут_в_часе: number;
  секунд_в_минуте: number;
  широта: number;
  учитывать_сезонную_длительность_дня: boolean;
}

interface LeapYearRule {
  месяц: number;
  день_смещения: number;
}

interface CalendarConfig {
  название: string;
  дней_в_неделе: number;
  названия_дней_недели: string[];
  первый_месяц_года: number;
  месяцы: CalendarMonth[];
  эпохи: CalendarEra[];
  сезоны: CalendarSeason[];
  фазы_луны: MoonPhase[];
  праздники: CalendarHoliday[];
  правило_високосного_года: string;
  точка_отсчета: { год: number; месяц: number; день: number; день_недели: number };
  настройки_времени: CalendarTimeSettings;
  пользовательское_високосное_правило: LeapYearRule;
}

interface DateObject {
  эпоха_ключ: number;
  год: number;
  месяц: number;
  день: number;
  время?: string;
}

interface RelatedEntity {
  name: string;
  type: string;
}

interface ExtraInfo {
  first_sentence?: string;
  author_note?: string;
  related_entities?: RelatedEntity[];
}

class CalendarHelper {
  config: CalendarConfig;

  constructor(calendarConfig?: CalendarConfig) {
    this.config = calendarConfig || this.getDefaultCalendar();
  }

  getDefaultCalendar(): CalendarConfig {
    return {
      название: 'Григорианский календарь',
      дней_в_неделе: 7,
      названия_дней_недели: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
      первый_месяц_года: 0,
      месяцы: [
        { название: 'Январь', дней: 31 },
        { название: 'Февраль', дней: 28 },
        { название: 'Март', дней: 31 },
        { название: 'Апрель', дней: 30 },
        { название: 'Май', дней: 31 },
        { название: 'Июнь', дней: 30 },
        { название: 'Июль', дней: 31 },
        { название: 'Август', дней: 31 },
        { название: 'Сентябрь', дней: 30 },
        { название: 'Октябрь', дней: 31 },
        { название: 'Ноябрь', дней: 30 },
        { название: 'Декабрь', дней: 31 }
      ],
      эпохи: [{ название: 'Наша эра', год_начала: 1, год_конца: 9999 }],
      сезоны: [
        { название: 'Весна', длительность_в_днях: 92, месяцы: [2, 3, 4], время_восхода: '06:00', время_заката: '18:00', погода: { типичная: '+10..+15°C, дождливо' } },
        { название: 'Лето', длительность_в_днях: 92, месяцы: [5, 6, 7], время_восхода: '04:30', время_заката: '20:30', погода: { типичная: '+20..+25°C, солнечно' } },
        { название: 'Осень', длительность_в_днях: 91, месяцы: [8, 9, 10], время_восхода: '06:30', время_заката: '17:30', погода: { типичная: '+5..+10°C, пасмурно' } },
        { название: 'Зима', длительность_в_днях: 90, месяцы: [11, 0, 1], время_восхода: '08:00', время_заката: '16:00', погода: { типичная: '-5..-10°C, снег' } }
      ],
      фазы_луны: [
        { название: 'Новолуние', луна_номер: 1, период_в_днях: 3, описание: 'небо тёмное, звёзды яркие', магический_потенциал: 0 },
        { название: 'Молодая луна', луна_номер: 2, период_в_днях: 4, описание: 'тонкий серп', магический_потенциал: 10 },
        { название: 'Первая четверть', луна_номер: 3, период_в_днях: 4, описание: 'половина диска', магический_потенциал: 25 },
        { название: 'Прибывающая луна', луна_номер: 4, период_в_днях: 4, описание: 'растущий серп', магический_потенциал: 50 },
        { название: 'Полнолуние', луна_номер: 5, период_в_днях: 3, описание: 'полный диск, светит ярко', магический_потенциал: 100 },
        { название: 'Убывающая луна', луна_номер: 6, период_в_днях: 4, описание: 'убывающий серп', магический_потенциал: 50 },
        { название: 'Последняя четверть', луна_номер: 7, период_в_днях: 4, описание: 'половина диска', магический_потенциал: 25 },
        { название: 'Старая луна', луна_номер: 8, период_в_днях: 4, описание: 'тонкий серп перед новолунием', магический_потенциал: 10 }
      ],
      праздники: [],
      правило_високосного_года: 'григорианское',
      точка_отсчета: { год: 1, месяц: 0, день: 1, день_недели: 0 },
      настройки_времени: {
        часов_в_сутках: 24,
        минут_в_часе: 60,
        секунд_в_минуте: 60,
        широта: 45.0,
        учитывать_сезонную_длительность_дня: false
      },
      пользовательское_високосное_правило: {
        месяц: 1,
        день_смещения: 29
      }
    };
  }

  getEraName(eraKey: number): string {
    if (!this.config.эпохи || !this.config.эпохи[eraKey]) return 'Неизвестная эпоха';
    return this.config.эпохи[eraKey].название;
  }

  getMonthName(monthIndex: number): string {
    if (!this.config.месяцы || !this.config.месяцы[monthIndex]) return 'Неизвестный месяц';
    return this.config.месяцы[monthIndex].название;
  }

  getDaysInMonth(year: number, monthIndex: number): number {
    if (!this.config.месяцы || !this.config.месяцы[monthIndex]) return 30;
    const month = this.config.месяцы[monthIndex];
    let days = month.дней;

    if (monthIndex === 1 && this.isLeapYear(year)) {
      days = 29;
    }
    return days;
  }

  isLeapYear(year: number): boolean {
    const rule = this.config.правило_високосного_года;
    if (rule === 'григорианское') {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }
    return false;
  }

  getDayOfWeek(year: number, month: number, day: number): number {
    let y = year;
    let m = month + 1;
    if (m < 3) {
      m += 12;
      y--;
    }
    const K = y % 100;
    const J = Math.floor(y / 100);
    const h = (day + Math.floor(13 * (m + 1) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
    const firstDayOffset = this.config.дней_в_неделе - 7;
    return (h + firstDayOffset) % this.config.дней_в_неделе;
  }

  getSeason(year: number, monthIndex: number, day: number): CalendarSeason {
    if (!this.config.сезоны || this.config.сезоны.length === 0) {
      return this.getDefaultSeason(monthIndex);
    }
    for (const season of this.config.сезоны) {
      if (season.месяцы && Array.isArray(season.месяцы)) {
        if (season.месяцы.includes(monthIndex)) {
          return season;
        }
      }
    }

    let dayOfYear = 0;
    for (let i = 0; i < monthIndex; i++) {
      dayOfYear += this.getDaysInMonth(year, i);
    }
    dayOfYear += day;

    let accumulated = 0;
    for (const season of this.config.сезоны) {
      if (dayOfYear <= accumulated + season.длительность_в_днях) {
        return season;
      }
      accumulated += season.длительность_в_днях;
    }

    return this.config.сезоны[0];
  }

  getMonthOrder(monthIndex: number): number {
    const firstMonth = this.config.первый_месяц_года || 0;
    const totalMonths = this.config.месяцы.length;

    let order = monthIndex - firstMonth;
    if (order < 0) order += totalMonths;

    return order;
  }

  getFirstMonthName(): string {
    const idx = this.config.первый_месяц_года || 0;
    return this.getMonthName(idx);
  }

  getDefaultSeason(monthIndex: number): CalendarSeason {
    if (monthIndex >= 2 && monthIndex <= 4) return { название: 'Весна', длительность_в_днях: 92, месяцы: [2, 3, 4], погода: { типичная: '+10..+15°C' } } as CalendarSeason;
    if (monthIndex >= 5 && monthIndex <= 7) return { название: 'Лето', длительность_в_днях: 92, месяцы: [5, 6, 7], погода: { типичная: '+20..+25°C' } } as CalendarSeason;
    if (monthIndex >= 8 && monthIndex <= 10) return { название: 'Осень', длительность_в_днях: 91, месяцы: [8, 9, 10], погода: { типичная: '+5..+10°C' } } as CalendarSeason;
    return { название: 'Зима', длительность_в_днях: 90, месяцы: [11, 0, 1], погода: { типичная: '-5..-10°C' } } as CalendarSeason;
  }

  getMoonPhase(year: number, month: number, day: number): MoonPhase | null {
    if (!this.config.фазы_луны || this.config.фазы_луны.length === 0) return null;

    const baseDate = new Date(2000, 0, 6);
    const targetDate = new Date(year, month, day);
    const diffDays = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    const lunarCycle = 29.53;
    const phaseIndex = Math.floor((diffDays % lunarCycle) / (lunarCycle / this.config.фазы_луны.length));

    return this.config.фазы_луны[Math.min(phaseIndex, this.config.фазы_луны.length - 1)];
  }

  getHolidays(year: number, month: number, day: number): CalendarHoliday[] {
    if (!this.config.праздники) return [];

    return this.config.праздники.filter(holiday => {
      const startMonth = holiday.дата_начала?.месяц;
      const startDay = holiday.дата_начала?.день;
      const endMonth = holiday.дата_конца?.месяц ?? startMonth;
      const endDay = holiday.дата_конца?.день ?? startDay;

      if (startMonth === undefined || startDay === undefined) return false;
      if (month < startMonth || month > (endMonth ?? month)) return false;
      if (month === startMonth && day < startDay) return false;
      if (month === endMonth && day > (endDay ?? day)) return false;
      return true;
    });
  }

  getSunTimes(year: number, month: number, day: number, latitude: number = 45): { восход: string; закат: string } {
    const season = this.getSeason(year, month, day);
    if (!season.время_восхода || !season.время_заката) {
      return { восход: '06:00', закат: '18:00' };
    }

    let riseHour = parseInt(season.время_восхода.split(':')[0]);
    let setHour = parseInt(season.время_заката.split(':')[0]);

    if (latitude > 60) {
      riseHour += 1;
      setHour -= 1;
    } else if (latitude < 30) {
      riseHour -= 1;
      setHour += 1;
    }

    const riseMin = season.время_восхода.split(':')[1];
    const setMin = season.время_заката.split(':')[1];

    return {
      восход: `${Math.max(0, Math.min(23, riseHour)).toString().padStart(2, '0')}:${riseMin}`,
      закат: `${Math.max(0, Math.min(23, setHour)).toString().padStart(2, '0')}:${setMin}`
    };
  }

  generateDateTooltip(dateObj: DateObject, extraInfo: ExtraInfo = {}): string {
    const { эпоха_ключ, год, месяц, день, время } = dateObj;
    const eraName = this.getEraName(эпоха_ключ);
    const monthName = this.getMonthName(месяц);
    const dayOfWeek = this.getDayOfWeek(год, месяц, день);
    const dayName = this.config.названия_дней_недели[dayOfWeek] || 'День';

    const season = this.getSeason(год, месяц, день);
    const moonPhase = this.getMoonPhase(год, месяц, день);
    const holidays = this.getHolidays(год, месяц, день);
    const sunTimes = this.getSunTimes(год, месяц, день);

    let tooltip = `
      <div class="calendar-tooltip">
        <div class="tooltip-header">
          📅 ${день} ${monthName} ${год} года
          <span class="tooltip-era">(${eraName})</span>
        </div>
        <div class="tooltip-day">${dayName}</div>
    `;

    if (время) {
      tooltip += `<div class="tooltip-time">🕐 ${время}</div>`;
    }

    tooltip += `
      <div class="tooltip-season">🌿 ${season.название}</div>
      <div class="tooltip-weather">🌡️ ${season.погода?.типичная || 'Сезонная погода'}</div>
      <div class="tooltip-sun">☀️ Рассвет: ${sunTimes.восход}, Закат: ${sunTimes.закат}</div>
    `;

    if (moonPhase) {
      tooltip += `
        <div class="tooltip-moon">🌙 ${moonPhase.название}</div>
        <div class="tooltip-moon-desc">${moonPhase.описание || ''}</div>
      `;
      if (moonPhase.магический_потенциал !== undefined) {
        tooltip += `<div class="tooltip-magic">✨ Магический потенциал: +${moonPhase.магический_потенциал}%</div>`;
      }
    }

    if (holidays.length > 0) {
      tooltip += `<div class="tooltip-holiday">🎉 Праздники:`;
      holidays.forEach(h => {
        tooltip += `<div class="tooltip-holiday">• ${h.название}`;
        if (h.описание) tooltip += `<br><span class="tooltip-holiday-desc">${h.описание}</span>`;
        if (h.традиции) tooltip += `<br><span class="tooltip-holiday-trad">📖 Традиции: ${h.традиции}</span>`;
        tooltip += `</div>`;
      });
      tooltip += `</div>`;
    }

    if (extraInfo.first_sentence) {
      tooltip += `
        <div class="tooltip-first-sentence">
          <strong>📖 Первое предложение:</strong><br>
          "${extraInfo.first_sentence.substring(0, 100)}${extraInfo.first_sentence.length > 100 ? '...' : ''}"
        </div>
      `;
    }

    if (extraInfo.author_note) {
      tooltip += `
        <div class="tooltip-author-note">
          <strong>📝 Заметка автора:</strong><br>
          ${extraInfo.author_note}
        </div>
      `;
    }

    if (extraInfo.related_entities && extraInfo.related_entities.length > 0) {
      tooltip += `<div class="tooltip-entities">👥 Связанные сущности:`;
      extraInfo.related_entities.forEach(e => {
        const typeLabel = e.type === 'character' ? 'Персонаж' : e.type === 'organization' ? 'Организация' : 'Государство';
        tooltip += `<div class="tooltip-entity">• ${e.name} (${typeLabel})</div>`;
      });
      tooltip += `</div>`;
    }

    tooltip += `</div>`;
    return tooltip;
  }

  getDateDescription(dateObj: DateObject, style: string = 'full'): string {
    const { год, месяц, день } = dateObj;
    const monthName = this.getMonthName(месяц);
    const season = this.getSeason(год, месяц, день);
    const moonPhase = this.getMoonPhase(год, месяц, день);

    switch (style) {
      case 'short':
        return `${день} ${monthName}`;
      case 'full':
        return `${день} ${monthName} ${год} года`;
      case 'with-season':
        return `${season.название}, ${день} ${monthName} ${год} года`;
      case 'with-moon':
        return `${день} ${monthName} ${год} года, ${moonPhase?.название || ''}`;
      default:
        return `${день} ${monthName} ${год} года`;
    }
  }

  static getDefaultConfig(): CalendarConfig {
    const instance = new CalendarHelper();
    return instance.getDefaultCalendar();
  }
}

declare global {
  interface Window {
    CalendarHelper: typeof CalendarHelper;
    getDefaultCalendar: () => CalendarConfig;
  }
}

if (typeof window !== 'undefined') {
  window.CalendarHelper = CalendarHelper;
  window.getDefaultCalendar = () => CalendarHelper.getDefaultConfig();
}

export { CalendarHelper };