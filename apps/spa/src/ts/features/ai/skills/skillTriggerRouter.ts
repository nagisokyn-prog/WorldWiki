import type { AiSkillItem, SkillMatchResult, SkillTriggerOptions } from './aiSkills.model';

const skillContentCache = new Map<string, string>();

/**
 * Очищает и нормализует строку для сопоставления с триггерами (lowercase, удаление лишних знаков)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»""''`,.!?:;()—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Извлекает явно вызванные навыки через синтаксис !"Имя Навыка"
 */
export function extractManualSkillInvocations(text: string): string[] {
  const matches = Array.from(text.matchAll(/!"([^"]+)"/g));
  return matches.map(m => m[1].trim()).filter(Boolean);
}

/**
 * Находит скиллы, триггеры которых встречаются в пользовательском сообщении
 */
export function findMatchingSkills(
  message: string,
  availableSkills: AiSkillItem[],
  options: SkillTriggerOptions = {}
): SkillMatchResult[] {
  const maxSkills = options.maxSkills ?? 2;
  const normalizedMsg = ` ${normalizeText(message)} `;

  const matches: SkillMatchResult[] = [];

  for (const skill of availableSkills) {
    if (skill.is_auto_trigger === false || skill.is_unlocked === false) {
      continue;
    }

    const triggers = skill.triggers || [];
    let bestTriggerForSkill = '';
    let bestScoreForSkill = 0;

    for (const rawTrigger of triggers) {
      const normalizedTrigger = normalizeText(rawTrigger);
      if (!normalizedTrigger) continue;

      // Проверяем вхождение как отдельной фразы/слов
      const searchTarget = ` ${normalizedTrigger} `;
      if (normalizedMsg.includes(searchTarget) || normalizedMsg.includes(normalizedTrigger)) {
        // Очки: длина триггера в словах * 10 + длина в символах + приоритет навыка
        const wordCount = normalizedTrigger.split(' ').length;
        const score = wordCount * 20 + normalizedTrigger.length + (skill.priority || 0);

        if (score > bestScoreForSkill) {
          bestScoreForSkill = score;
          bestTriggerForSkill = rawTrigger;
        }
      }
    }

    if (bestTriggerForSkill && bestScoreForSkill > 0) {
      matches.push({
        skill,
        matchedTrigger: bestTriggerForSkill,
        score: bestScoreForSkill
      });
    }
  }

  // Сортируем по убыванию скора (наиболее специфичные и приоритетные выше)
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, maxSkills);
}

/**
 * Загружает полное содержимое навыка (из Markdown-файла или fallback на prompt_text)
 */
export async function resolveSkillContent(skill: AiSkillItem): Promise<string> {
  const cacheKey = skill.id || skill.name;
  if (skillContentCache.has(cacheKey)) {
    return skillContentCache.get(cacheKey)!;
  }

  let content = skill.prompt_text || skill.description || '';

  if (skill.file_path) {
    try {
      const res = await fetch(skill.file_path);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          content = text;
        }
      }
    } catch (e) {
      console.warn(`[skillTriggerRouter] Failed to fetch skill file ${skill.file_path}, using fallback:`, e);
    }
  } else if (skill.name.toLowerCase().includes('конструктор') && !content.includes('## 🛑 Железные Инварианты')) {
    try {
      const res = await fetch('/skills/Конструктор_типов_сущностей.md');
      if (res.ok) content = await res.text();
    } catch {
      // fallback
    }
  } else if (skill.name.toLowerCase().includes('заполнение') && !content.includes('## 1. Литературный ввод')) {
    try {
      const res = await fetch('/skills/Заполнение_сущностей.md');
      if (res.ok) content = await res.text();
    } catch {
      // fallback
    }
  }

  skillContentCache.set(cacheKey, content);
  return content;
}

/**
 * Собирает финальный контекст и тело запроса для отправки в LLM
 */
export async function buildSkillContext(
  text: string,
  availableSkills: AiSkillItem[]
): Promise<{
  augmentedMessage: string;
  appliedSkills: Array<{ name: string; isManual: boolean; trigger?: string }>;
}> {
  const manualSkillNames = extractManualSkillInvocations(text);
  const appliedSkills: Array<{ name: string; isManual: boolean; trigger?: string }> = [];
  const skillContexts: string[] = [];
  const processedSkillIds = new Set<string>();

  // 1. Ручные вызовы !"Название"
  if (manualSkillNames.length > 0) {
    for (const name of manualSkillNames) {
      const skill = availableSkills.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (skill && !processedSkillIds.has(skill.id)) {
        processedSkillIds.add(skill.id);
        const content = await resolveSkillContent(skill);
        skillContexts.push(`<context type="skill" name="${skill.name}">\n${content}\n</context>`);
        appliedSkills.push({ name: skill.name, isManual: true });
      }
    }
  } else {
    // 2. Автоматический роутинг триггеров
    const matches = findMatchingSkills(text, availableSkills, { maxSkills: 2 });
    for (const match of matches) {
      if (!processedSkillIds.has(match.skill.id)) {
        processedSkillIds.add(match.skill.id);
        const content = await resolveSkillContent(match.skill);
        skillContexts.push(`<context type="skill" name="${match.skill.name}">\n${content}\n</context>`);
        appliedSkills.push({
          name: match.skill.name,
          isManual: false,
          trigger: match.matchedTrigger
        });
      }
    }
  }

  let augmentedMessage = text;
  if (skillContexts.length > 0) {
    augmentedMessage = `${skillContexts.join('\n\n')}\n\n${text}`;
  }

  return {
    augmentedMessage,
    appliedSkills
  };
}
