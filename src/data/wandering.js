/* =============================================================================
 * STOCKING MONSTERS — бродячие и занятые монстры
 * Первоисточник: файл «Stocking Monsters» (по Designer Note — из черновика
 * правил Arneson v. Gygax). Тот же продукт/семейство, что и остальные буклеты;
 * см. NOTICE.
 *
 * Группы применяются и к бродячим встречам, и к «занятым» комнатам.
 *   Группа I   — уровни 1-2
 *   Группа II  — уровни 3-4
 *   Группа III — уровни 5-6 (глубже — тоже III)
 *
 * NRP из источника переведено как «НИП» (человек: маг или воин N-го уровня).
 *
 * Формат записи: [en, ru].
 * ========================================================================== */

'use strict';

const GROUPS = {
  1: [
    ['Bandit', 'Бандит'],
    ['Centipede, Giant', 'Гигантская сороконожка'],
    ['Dwarf', 'Дворф'],
    ['Elf', 'Эльф'],
    ['Fairy', 'Фея'],
    ['Gnoll', 'Гнолл'],
    ['Gnome', 'Гном'],
    ['Goblin', 'Гоблин'],
    ['Halfling', 'Полурослик'],
    ['Insect, Giant', 'Гигантское насекомое'],
    ['Kobold', 'Кобольд'],
    ['Orc', 'Орк'],
    ['NRP (1st-5th level Magic-User or Warrior)', 'НИП (маг или воин 1–5 уровня)'],
    ['Pixie', 'Пикси'],
    ['Spider, Giant', 'Гигантский паук'],
    ['Skeleton', 'Скелет'],
    ['Sprite', 'Спрайт'],
    ['Zombie', 'Зомби']
  ],
  2: [
    ['Beetle, Giant', 'Гигантский жук'],
    ['Ghoul', 'Гуль'],
    ['Gargoyle', 'Гаргойл'],
    ['Hero', 'Герой'],
    ['Lycanthrope', 'Ликантроп'],
    ['Ochre Jelly', 'Охровая желе'],
    ['Ogre', 'Огр'],
    ['NRP (4th-6th level M-U or Warrior)', 'НИП (маг или воин 4–6 уровня)'],
    ['Roc', 'Птица Рух'],
    ['Scorpion, Giant', 'Гигантский скорпион'],
    ['Snake, Giant', 'Гигантская змея'],
    ['Spectre', 'Спектр'],
    ['SuperHero', 'Супергерой'],
    ['Toad, Giant', 'Гигантская жаба'],
    ['Troll', 'Тролль'],
    ['Wight', 'Вийт']
  ],
  3: [
    ['Bealuwearg', 'Беалувеарг'],
    ['Cockatrice', 'Кокатрис'],
    ['Dragon', 'Дракон'],
    ['Elemental', 'Элементаль'],
    ['Giant', 'Великан'],
    ['Hog, Giant', 'Гигантский кабан'],
    ['Hydra (7 headed)', 'Гидра (7 голов)'],
    ['Manticore', 'Мантикора'],
    ['Mhrent', 'Мрент'],
    ['Mummy', 'Мумия'],
    ['NRP (Gallant w/+1 armor and magic shield; or 5th-9th level M-U or Warrior)',
     'НИП (галант с +1 бронёй и магическим щитом; либо маг или воин 5–9 уровня)'],
    ['True Troll', 'Истинный тролль'],
    ['Weasel, Giant', 'Гигантский хорёк'],
    ['Wourme, Giant', 'Гигантский червь'],
    ['Wraith', 'Плакальщица'],
    ['Vampire', 'Вампир']
  ]
};

const GROUP_ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

/* Группа по уровню подземелья. */
function groupForLevel(level) {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  return 3;
}

/* TABLE 3-31: сложность встречи. 1 — легче, 2-5 — штатная, 6 — сложнее.
 * Результат сдвигает группу на ±1 (с зажимом в 1..3). */
function shiftGroup(group, diff) {
  const g = group + (diff === 'easier' ? -1 : diff === 'harder' ? 1 : 0);
  return Math.max(1, Math.min(3, g));
}

/* TABLE 3-32: шанс занятой комнаты по уровню. Справочная таблица для Рефери:
 * автопоток наполняет комнаты по правилу Буклета 4 (4-59: 1d100, пусто 1-39 /
 * монстр 40-86 / только сокровище 87-100), а не по этой вероятности. */
function occupiedRoomChance(level) {
  if (level <= 2) return { n: 6, ok: 1 };
  if (level <= 5) return { n: 6, ok: 2 };
  return { n: 6, ok: 3 };
}

/* Number Appearing. База по уровню: ур.1-4 → 1d6, ур.5-6 → 1d4.
 * HD у монстров нет, поэтому «заметно слабее» приближается результатом 3-31
 * (встреча «легче» → монстр слабее уровня → ×2). РЕКОНСТРУКЦИЯ. */
const NUMBER_APPEARING = {
  baseDie: level => (level >= 5 ? '1d4' : '1d6'),
  easierMultiplier: 2
};

module.exports = { GROUPS, GROUP_ROMAN, groupForLevel, shiftGroup, occupiedRoomChance, NUMBER_APPEARING };
