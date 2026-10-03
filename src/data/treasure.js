/* =============================================================================
 * ТАБЛИЦА 4-63: SOLO TREASURE TROVE  (Random_Dungeon, строки 765-965)
 *
 * ВНИМАНИЕ О ДОСТОВЕРНОСТИ.
 * Таблица набрана в PDF в две колонки на страницу, и извлечение текста их
 * перемешало: числа и названия идут вперемешку, границы строк потеряны.
 * Прежняя версия этого файла восстанавливалась по такому тексту и была
 * НЕВЕРНОЙ на уровнях 4-6:
 *   • уровень 4 — сдвиг на одну строку: не хватало «Magic Sword» на броске 3,
 *     из-за чего в конце таблицы появился несуществующий ESP Medallion;
 *   • уровни 5-6 — раскладка была придумана по кривой ценности.
 *
 * Текущие данные — построчная сверка с текстом книги пользователем.
 * В шести уровнях строки ровно накрывают диапазон кубика, без пропусков и
 * пересечений; количество строк совпадает с количеством призов.
 * Проверка покрытия выполняется автоматически в test/validate.js.
 *
 * certainty: 'exact' — сверено с книгой, покрытие кубика сходится
 *
 * Перед боем: «Gold, by itself, is either in sacks or loose
 *              (even chances of either situation).»
 * Монеты, найденные отдельно, — это «loose», в мешках — «sacks».
 * ========================================================================== */

const TREASURE = {
  status: 'все 6 уровней сверены с книгой (exact)',
  certainty: { 1: 'exact', 2: 'exact', 3: 'exact', 4: 'exact', 5: 'exact', 6: 'exact' },

  levels: {
    1: { die: '1d8', rows: [
      { r: [1, 6],   item: { ru: '1d3 × 250 зм',            en: '1d3 x 250 gp' } },
      { r: [7, 7],   item: { ru: '1 000 зм',                 en: '1,000 gp' } },
      { r: [8, 8],   item: { ru: 'Магический меч',           en: 'Magic Sword' }, magic: true }
    ] },

    2: { die: '1d8', rows: [
      { r: [1, 1],   item: { ru: '500 зм',    en: '500 gp' } },
      { r: [2, 2],   item: { ru: '750 зм',    en: '750 gp' } },
      { r: [3, 4],   item: { ru: '1 000 зм',  en: '1,000 gp' } },
      { r: [5, 6],   item: { ru: 'Серебряная Чаша Любви (1 000 зм)', en: 'Silver Loving Cup (1,000 gp)' } },
      { r: [7, 7],   item: { ru: 'Кольцо с самоцветом (2 000 зм)',  en: 'Jeweled Ring (2,000 gp)' } },
      { r: [8, 8],   item: { ru: 'Магический меч',                     en: 'Magic Sword' }, magic: true }
    ] },

    3: { die: '3d6', rows: [
      { r: [3, 5],     item: { ru: 'Золотая Чаша Любви (2 500 зм)', en: 'Gold Loving Cup (2,500 gp)' } },
      { r: [6, 7],     item: { ru: 'Золотое кольцо (3 000 зм)',     en: 'Gold Ring (3,000 gp)' } },
      { r: [8, 9],     item: { ru: '750 зм',                       en: '750 gp' } },
      { r: [10, 11],   item: { ru: '1 000 зм',                     en: '1,000 gp' } },
      { r: [12, 14],   item: { ru: 'Серебряная Чаша Любви (1 000 зм)', en: 'Silver Loving Cup (1,000 gp)' } },
      { r: [15, 17],   item: { ru: 'Кольцо с самоцветом (2 000 зм)',   en: 'Jeweled Ring (2,000 gp)' } },
      { r: [18, 18],   item: { ru: 'Медальон ESP',                 en: 'ESP Medallion' }, magic: true }
    ] },

    4: { die: '3d6', rows: [
      { r: [3, 3],     item: { ru: 'Магический меч',                en: 'Magic Sword' }, magic: true },
      { r: [4, 4],     item: { ru: 'Крупный изумруд (5 000 зм)',    en: 'Sizable Emerald (5,000 gp)' } },
      { r: [5, 6],     item: { ru: 'Идол из нефрита (5 000 зм)',     en: 'Jade Idol (5,000 gp)' } },
      { r: [7, 8],     item: { ru: 'Золотая Чаша Любви (2 500 зм)',  en: 'Gold Loving Cup (2,500 gp)' } },
      { r: [9, 9],     item: { ru: 'Серебряная Чаша Любви (1 000 зм)', en: 'Silver Loving Cup (1,000 gp)' } },
      { r: [10, 10],   item: { ru: '1 000 зм',                      en: '1,000 gp' } },
      { r: [11, 12],   item: { ru: 'Кольцо с самоцветом (2 000 зм)', en: 'Jeweled Ring (2,000 gp)' } },
      { r: [13, 14],   item: { ru: 'Золотое кольцо (3 000 зм)',      en: 'Gold Ring (3,000 gp)' } },
      { r: [15, 16],   item: { ru: 'Серебряный сундук (4 000 зм)',   en: 'Silver Coffer (4,000 gp)' } },
      { r: [17, 17],   item: { ru: 'Крупный сапфир (6 000 зм)',     en: 'Sizable Sapphire (6,000 gp)' } },
      { r: [18, 18],   item: { ru: 'Хрустальный шар',               en: 'Crystal Ball' }, magic: true }
    ] },

    5: { die: '3d6', rows: [
      { r: [3, 3],     item: { ru: 'Крупный рубин (8 000 зм)',      en: 'Sizable Ruby (8,000 gp)' } },
      { r: [4, 5],     item: { ru: 'Идол из нефрита (5 000 зм)',     en: 'Jade Idol (5,000 gp)' } },
      { r: [6, 7],     item: { ru: 'Серебряный сундук (4 000 зм)',  en: 'Silver Coffer (4,000 gp)' } },
      { r: [8, 9],     item: { ru: 'Золотое кольцо (3 000 зм)',     en: 'Gold Ring (3,000 gp)' } },
      { r: [10, 11],   item: { ru: 'Золотая Чаша Любви (2 500 зм)', en: 'Gold Loving Cup (2,500 gp)' } },
      { r: [12, 12],   item: { ru: 'Кольцо с самоцветом (2 000 зм)', en: 'Jeweled Ring (2,000 gp)' } },
      { r: [13, 14],   item: { ru: 'Крупный изумруд (5 000 зм)',    en: 'Sizable Emerald (5,000 gp)' } },
      { r: [15, 16],   item: { ru: 'Крупный сапфир (6 000 зм)',     en: 'Sizable Sapphire (6,000 gp)' } },
      { r: [17, 17],   item: { ru: 'Ожерелье с самоцветом (7 000 зм)', en: 'Jeweled Necklace (7,000 gp)' } },
      { r: [18, 18],   item: { ru: 'Медальон ESP',                 en: 'ESP Medallion' }, magic: true }
    ] },

    6: { die: '1d12', rows: [
      { r: [1, 1],     item: { ru: 'Магический меч',                en: 'Magic Sword' }, magic: true },
      { r: [2, 2],     item: { ru: 'Крупный бриллиант (10 000 зм)', en: 'Sizable Diamond (10,000 gp)' } },
      { r: [3, 3],     item: { ru: 'Ожерелье с самоцветом (7 000 зм)', en: 'Jeweled Necklace (7,000 gp)' } },
      { r: [4, 5],     item: { ru: 'Крупный изумруд (5 000 зм)',    en: 'Sizable Emerald (5,000 gp)' } },
      { r: [6, 7],     item: { ru: 'Идол из нефрита (5 000 зм)',     en: 'Jade Idol (5,000 gp)' } },
      { r: [8, 8],     item: { ru: 'Серебряный сундук (4 000 зм)',  en: 'Silver Coffer (4,000 gp)' } },
      { r: [9, 9],     item: { ru: 'Крупный сапфир (6 000 зм)',     en: 'Sizable Sapphire (6,000 gp)' } },
      { r: [10, 10],   item: { ru: 'Крупный рубин (8 000 зм)',      en: 'Sizable Ruby (8,000 gp)' } },
      { r: [11, 11],   item: { ru: 'Золотая корона (9 000 зм)',      en: 'Gold Crown (9,000 gp)' } },
      { r: [12, 12],   item: { ru: 'Хрустальный шар',               en: 'Crystal Ball' }, magic: true }
    ] }
  },

  /* Золото отдельно от предметов: «either in sacks or loose (even chances)». */
  coinRule: { sacks: 0.5, loose: 0.5 },

  /* «Orcs within a single dungeon are usually of the same tribe» — это про 4-62,
     но та же логика применима к любой группе орков из разных бросков. */
  note: 'Все орки одного подземелья обычно из одного племени; исключения — сбежавшие пленные.'
};

if (typeof module !== 'undefined') {
  module.exports = { TREASURE };
}
