/* =============================================================================
 * ТАБЛИЦА 4-62: SOLO MONSTER ENCOUNTER MATRIX  (Random_Dungeon, строки 570-757)
 *
 * ВНИМАНИЕ О ДОСТОВЕРНОСТИ.
 *
 * Таблица в PDF набрана в ДВЕ колонки на страницу (стр. 157-158), по три уровня
 * подземелья на колонку. Обычное извлечение текста перемешивает колонки: числа
 * и названия монстров идут вперемешку, границы строк теряются. Прежняя версия
 * этого файла (уровни 1-2) была восстановлена именно по такому тексту и была
 * НЕВЕРНОЙ — в ней смешаны кубики 1d8/1d10 и перепутаны строки.
 *
 * Текущие данные получены из OCR скриншотов (стр. 157-158), колонки разделены
 * пополам, каждая колонка распознана отдельно, спорные ячейки перечитаны
 * крупным планом. См. .ocr/p157_L.png, p157_R.png, p158_L.png, p158_R.png.
 *
 * Ключевая проверка достоверности: в каждом уровне строки («Dice Roll»)
 * ровно накрывают диапазон 1..N кубика, без пропусков и пересечений:
 *   ур.1 1d8  → 7 групп  = 8 значений   ✓
 *   ур.2 1d8  → 7 групп  = 8 значений   ✓
 *   ур.3 1d10 → 9 групп  = 10 значений  ✓
 *   ур.4 1d8  → 8 групп  = 8 значений   ✓
 *   ур.5 1d12 → 8 групп  = 12 значений  ✓
 *   ур.6 1d10 → 7 групп  = 10 значений  ✓
 * Эта проверка выполняется автоматически в test/validate.js.
 *
 * certainty: 'exact'          — сверено с текстом книги
 *             'reconstructed'  — восстановлено из OCR, арифметика сходится
 *
 * Объём: Dungeon Level 1-6. Уровней 7-12 в буклете НЕТ (см. levelRange):
 * последний блок 4-62 — "6 (Roll 1d10)", дальше сразу примечание про племена
 * орков. Если партия уходит глубже, мастер берёт монстров из verifiedPool сам.
 * ========================================================================== */

const T = (ru, en, extra) => Object.assign({ ru, en }, extra || {});

/* Общие для всех монстров замечания из преамбулы таблицы:
 * «HTK may be halved or doubled if only a single creature (qty 1) is
 *  indicated by the encounter matrix below.»
 * и
 * «Orcs within a single dungeon are usually of the same tribe. Exceptions
 *  such as escaped prisoners are also possible.»                              */

const SOLO_RULES = {
  qty1: { halve: true, double: true,
    ru: 'Если указано «(кол-во 1)», HTK можно уменьшить вдвое или увеличить вдвое.',
    en: 'HTK may be halved or doubled if only a single creature (qty 1) is indicated.' },
  orcTribe: { same: true,
    ru: 'Все орки одного подземелья обычно из одного племени. Исключения — сбежавшие пленные.',
    en: 'Orcs within a single dungeon are usually of the same tribe. Exceptions such as escaped prisoners are also possible.' }
};

/* Уровни 1-4 — сканшот 225757 (стр. 157), уровни 5-6 — сканшот 225805 (стр. 158). */
const MONSTERS = {
  certainty: { 1: 'reconstructed', 2: 'reconstructed', 3: 'reconstructed',
               4: 'reconstructed', 5: 'exact', 6: 'reconstructed' },

  levels: {
    /* --- сканшот 225757, ЛЕВАЯ колонка: заголовки «1 (Roll 1d8)» и «2 (Roll 1d8)» --- */
    1: { die: '1d8', certainty: 'reconstructed', rows: [
      { r: [1, 1],   m: T('Гигантская ящерица', 'Lizard, Giant') },
      { r: [2, 2],   m: T('Собака',             'Dog') },
      { r: [3, 3],   m: T('Человеческая шваль', 'Human Scum') },
      { r: [4, 5],   m: T('Гоблин',             'Goblin') },
      { r: [6, 6],   m: T('Орки',               'Orcs'), qty: 2 },
      { r: [7, 7],   m: T('Скелет',             'Skeleton') },
      { r: [8, 8],   m: T('Фея',                'Fairy') }
    ] },

    /* Блок уровня 2 начат в левой колонке стр. 157 и продолжен в правой
     * (строки 7 «Robot» и 8 «Amazon» — верх правой колонки). */
    2: { die: '1d8', certainty: 'reconstructed', rows: [
      { r: [1, 1],   m: T('Антигерой (4 уровень, хаотичный воин)',
                          'Anti-Hero (4th level Chaotic Warrior)'), qty: 1 },
      { r: [2, 3],   m: T('Гуль',               'Ghoul') },
      { r: [4, 4],   m: T('Гигантская ящерица', 'Lizard, Giant') },
      { r: [5, 5],   m: T('Гигантский паук',   'Spider, Giant') },
      { r: [6, 6],   m: T('Орки',               'Orcs'), qty: 3 },
      { r: [7, 7],   m: T('Робот',              'Robot') },
      { r: [8, 8],   m: T('Амазонка',           'Amazon') }
    ] },

    /* --- сканшот 225757, ПРАВАЯ колонка: заголовок «3 (Roll 1d10)» ---
     * ВНИМАНИЕ: строка 1 здесь такая же, как строка 1 уровня 4 —
     * «Анти-супергерой (8 уровень, хаотичный воин)». Это НЕ ошибка OCR:
     * так напечатано в книге (подтверждено при сверке). */
    3: { die: '1d10', certainty: 'reconstructed', rows: [
      { r: [1, 1],   m: T('Анти-супергерой (8 уровень, хаотичный воин)',
                          'Anti-Super Hero (8th level Chaotic Warrior)'), qty: 1 },
      { r: [2, 2],   m: T('Гаргойл',            'Gargoyle') },
      { r: [3, 3],   m: T('Гигантская жаба',    'Toad, Giant') },
      { r: [4, 4],   m: T('Гигантский паук',    'Spider, Giant') },
      { r: [5, 5],   m: T('Вийт',               'Wight') },
      { r: [6, 6],   m: T('Огр',                'Ogre') },
      { r: [7, 7],   m: T('Тролль',             'Troll') },
      { r: [8, 9],   m: T('Ликантроп (оборотень)', 'Lycanthrope (Werewolf)') },
      { r: [10, 10], m: T('Жак д\'Омбр',        'Jacques d\'Ombre') }
    ] },

    /* Заголовок «4 (Roll 1d8)» — внизу правой колонки стр. 157,
     * строки 2-8 продолжаются в левой колонке стр. 158. */
    4: { die: '1d8', certainty: 'reconstructed', rows: [
      { r: [1, 1],   m: T('Анти-супергерой (8 уровень, хаотичный воин)',
                          'Anti-Super Hero (8th level Chaotic Warrior)'), qty: 1 },
      { r: [2, 2],   m: T('Великан',            'Giant') },
      { r: [3, 3],   m: T('Гоплит',             'Hoplite') },
      { r: [4, 4],   m: T('Пожирающий моревод', 'Seaweed, Man-Eating') },
      { r: [5, 5],   m: T('Плакальщица',        'Wraith') },
      { r: [6, 6],   m: T('Мумия',              'Mummy'), qty: 1 },
      { r: [7, 7],   m: T('Истинный тролль',    'True Troll') },
      { r: [8, 8],   m: T('Гигантский жук (4 HD)', 'Beetle, Giant (4 HD)') }
    ] },

    /* --- сканшот 225805, ЛЕВАЯ колонка: заголовок «5 (Roll 1d12)»,
     *     строки 8-9, 10, 11-12 продолжаются в правой колонке. ---
     * Уровень 5 СВЕРЕН с текстом книги (8 строк из 8, полное совпадение),
     * поэтому certainty: 'exact' — единственный подтверждённый уровень. */
    5: { die: '1d12', certainty: 'exact', rows: [
      { r: [1, 1],     m: T('Пудинг',            'Pudding') },
      { r: [2, 3],     m: T('Великан',          'Giant') },
      { r: [4, 4],     m: T('Пожирающий моревод', 'Seaweed, Man-Eating') },
      { r: [5, 5],     m: T('Охровая желе',     'Ochre Jelly') },
      { r: [6, 7],     m: T('Гигантский червь', 'Wourme, Giant') },
      { r: [8, 9],     m: T('Истинный тролль',  'True Troll') },
      { r: [10, 10],   m: T('Вампир',           'Vampire'), qty: 1 },
      { r: [11, 12],   m: T('Ведьма (прекрасная или уродливая)',
                            'Witch (Beautiful or Ugly)'), qty: 1 }
    ] },

    /* --- сканшот 225805, ПРАВАЯ колонка: заголовок «6 (Roll 1d10)» --- */
    6: { die: '1d10', certainty: 'reconstructed', rows: [
      { r: [1, 1],   m: T('Пудинг',              'Pudding') },
      { r: [2, 3],   m: T('Кобальтовый дракон',  'Dragon, Cobalt'), qty: 1 },
      { r: [4, 5],   m: T('Волшебник (хаотичный)', 'Wizard (Chaotic)'), qty: 1 },
      { r: [6, 6],   m: T('Гигантский червь',   'Wourme, Giant') },
      { r: [7, 7],   m: T('Ужасный дракон',      'Dragon, Horrible'), qty: 1 },
      { r: [8, 9],   m: T('Вампир',              'Vampire'), qty: 1 },
      { r: [10, 10], m: T('Призрак',             'Ghost') }
    ] },
  },

  /* Буклет НЕ содержит уровней 7-12: последний блок 4-62 — "6 (Roll 1d10)",
   * дальше сразу примечание про племена орков. Если партия уходит глубже,
   * мастер берёт монстров из verifiedPool сам. */
  levelRange: { min: 1, max: 6, beyond: 'verifiedPool' },

  /* Полный пул названий, встречающихся в 4-62. Используется движком, когда
   * уровень выходит за пределы levelRange. Ничего не потеряно. */
  verifiedPool: [
    T('Гигантская ящерица', 'Lizard, Giant'),
    T('Собака',             'Dog'),
    T('Человеческая шваль', 'Human Scum'),
    T('Гоблин',             'Goblin'),
    T('Орки',               'Orcs'),
    T('Скелет',             'Skeleton'),
    T('Фея',                'Fairy'),
    T('Антигерой (4 уровень, хаотичный воин)', 'Anti-Hero (4th level Chaotic Warrior)'),
    T('Гуль',               'Ghoul'),
    T('Гигантский паук',    'Spider, Giant'),
    T('Робот',              'Robot'),
    T('Амазонка',           'Amazon'),
    T('Анти-супергерой (8 уровень, хаотичный воин)', 'Anti-Super Hero (8th level Chaotic Warrior)'),
    T('Гаргойл',            'Gargoyle'),
    T('Гигантская жаба',    'Toad, Giant'),
    T('Вийт',               'Wight'),
    T('Огр',                'Ogre'),
    T('Тролль',             'Troll'),
    T('Ликантроп (оборотень)', 'Lycanthrope (Werewolf)'),
    T('Жак д\'Омбр',        'Jacques d\'Ombre'),
    T('Великан',            'Giant'),
    T('Гоплит',             'Hoplite'),
    T('Пожирающий моревод', 'Seaweed, Man-Eating'),
    T('Плакальщица',        'Wraith'),
    T('Мумия',              'Mummy'),
    T('Истинный тролль',    'True Troll'),
    T('Гигантский жук (4 HD)', 'Beetle, Giant (4 HD)'),
    T('Пудинг',             'Pudding'),
    T('Охровая желе',       'Ochre Jelly'),
    T('Гигантский червь',   'Wourme, Giant'),
    T('Вампир',             'Vampire'),
    T('Ведьма (прекрасная или уродливая)', 'Witch (Beautiful or Ugly)'),
    T('Кобальтовый дракон',  'Dragon, Cobalt'),
    T('Волшебник (хаотичный)', 'Wizard (Chaotic)'),
    T('Ужасный дракон',      'Dragon, Horrible'),
    T('Призрак',             'Ghost')
  ],

  rules: SOLO_RULES
};

if (typeof module !== 'undefined') {
  module.exports = { MONSTERS };
}
