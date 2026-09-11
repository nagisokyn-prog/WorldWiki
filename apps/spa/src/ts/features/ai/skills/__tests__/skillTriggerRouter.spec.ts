import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  extractManualSkillInvocations,
  findMatchingSkills,
  buildSkillContext
} from '../skillTriggerRouter';
import { DEFAULT_BUILTIN_SKILLS } from '../defaultBuiltinSkills';
import type { AiSkillItem } from '../aiSkills.model';

describe('skillTriggerRouter', () => {
  it('correctly normalizes text and removes punctuation', () => {
    const raw = 'Привет! Создай, пожалуйста, «тип сущности» для магии...';
    expect(normalizeText(raw)).toBe('привет создай пожалуйста тип сущности для магии');
  });

  it('extracts manual skill calls with !"..." syntax', () => {
    const text = 'Помоги с анкетой !"Заполнение сущностей" и !"Конструктор типов сущностей"';
    const extracted = extractManualSkillInvocations(text);
    expect(extracted).toEqual(['Заполнение сущностей', 'Конструктор типов сущностей']);
  });

  it('matches single and multi-word triggers correctly and ranks specific phrases higher', () => {
    const msg = 'Пожалуйста, создай тип сущности для космического корабля';
    const matches = findMatchingSkills(msg, DEFAULT_BUILTIN_SKILLS);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.id).toBe('ai_skills:builtin_entity_type_creator');
    expect(matches[0].matchedTrigger).toBe('тип сущности');
  });

  it('matches entity data filling triggers', () => {
    const msg = 'Пожалуйста, измени статус и заполни карточку персонажа';
    const matches = findMatchingSkills(msg, DEFAULT_BUILTIN_SKILLS);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.id).toBe('ai_skills:builtin_entity_data_fill');
    expect(matches[0].matchedTrigger).toBe('заполни карточку');
  });

  it('respects is_auto_trigger = false', () => {
    const customSkills: AiSkillItem[] = [
      {
        id: 'ai_skills:usr_disabled',
        name: 'Отключенный навык',
        description: 'тест',
        prompt_text: 'тест',
        triggers: ['тестовый триггер'],
        is_auto_trigger: false
      }
    ];

    const matches = findMatchingSkills('Это тестовый триггер', customSkills);
    expect(matches.length).toBe(0);
  });

  it('correctly matches custom user skills with custom triggers', () => {
    const userSkill: AiSkillItem = {
      id: 'ai_skills:usr_cyberpunk',
      name: 'Стиль Киберпанка',
      description: 'Специфический сленг и импланты',
      prompt_text: 'Используй киберпанк сленг',
      triggers: ['киберпанк', 'хром', 'импланты', 'нетраннер'],
      is_auto_trigger: true,
      priority: 10
    };

    const matches = findMatchingSkills('Опиши как нетраннер ставит новый хром', [
      ...DEFAULT_BUILTIN_SKILLS,
      userSkill
    ]);

    const foundUserSkill = matches.find(m => m.skill.id === 'ai_skills:usr_cyberpunk');
    expect(foundUserSkill).toBeDefined();
  });

  it('buildSkillContext attaches manual skill without running auto-triggers', async () => {
    const text = 'Отредактируй главу !"Конструктор типов сущностей"';
    const { augmentedMessage, appliedSkills } = await buildSkillContext(text, DEFAULT_BUILTIN_SKILLS);

    expect(appliedSkills.length).toBe(1);
    expect(appliedSkills[0].name).toBe('Конструктор типов сущностей');
    expect(appliedSkills[0].isManual).toBe(true);
    expect(augmentedMessage).toContain('<context type="skill" name="Конструктор типов сущностей">');
  });

  it('buildSkillContext attaches auto-triggered skills when triggers match', async () => {
    const text = 'Проверь сюжет и оцени темп этой главы';
    const { augmentedMessage, appliedSkills } = await buildSkillContext(text, DEFAULT_BUILTIN_SKILLS);

    expect(appliedSkills.length).toBeGreaterThan(0);
    expect(appliedSkills[0].name).toBe('Литературный аудит');
    expect(appliedSkills[0].isManual).toBe(false);
    expect(augmentedMessage).toContain('<context type="skill" name="Литературный аудит">');
  });
});
