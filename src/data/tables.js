/* =============================================================================
 * ТАБЛИЦЫ БУКЛЕТА 4 — OD&D BOOKLET 4: RANDOM DUNGEON GENERATION
 * Первоисточник: Random_Dungeon (файл в корне проекта), таблицы 4-51 … 4-61
 *
 * ФОРМАТ ТАБЛИЦЫ
 *   { ru, en, die, rows: [{ r:[from,to], out }] }
 *     rows     — диапазоны броска, НЕ пересекаются, покрывают 1..sides
 *     out      — произвольный результат (число футов, объект, ключ подтипа)
 *     extra    — если задан, движок бросает доп. кубик и берёт out из extra
 *
 * ВСЕ РАЗМЕРЫ КУБИКОВ ПРОВЕРЕНЫ ТЕСТОМ (test/validate.js):
 * сумма длин ranges == sides, без дыр и перекрытий.
 * ========================================================================== */

const T = {};

/* --- 4-51 -------------------------------------------------------------- */
T['4-51'] = {
  ru: 'Начальное направление прохода',
  en: 'Passageway Initial Direction',
  die: '1d100',
  rows: [
    { r: [1, 21],   out: 'nesw' },
    { r: [22, 44],  out: 'nwse' },
    { r: [45, 70],  out: 'ew'  },
    { r: [71, 100], out: 'ns'  }
  ],
  dirs: {
    nesw: { ru: 'северо-восток — юго-запад (45°)', en: 'Northeast-Southwest' },
    nwse: { ru: 'северо-запад — юго-восток (45°)', en: 'Northwest-Southeast' },
    ew:   { ru: 'восток — запад',                en: 'East-West' },
    ns:   { ru: 'север — юг',                    en: 'North-South' }
  }
};

/* --- 4-52 -------------------------------------------------------------- */
T['4-52'] = {
  ru: 'Длина секции прохода',
  en: 'Passageway Section Length',
  die: '1d20',
  rows: [
    { r: [1, 1],   out: 10 },
    { r: [2, 7],   out: 20 },
    { r: [8, 12],  out: 30 },
    { r: [13, 16], out: 40 },
    { r: [17, 18], out: 50 },
    { r: [19, 19], out: 60 },
    { r: [20, 20], out: 'extra', extra: { die: '1d100', table: '4-53' } }
  ]
};

/* --- 4-53 -------------------------------------------------------------- */
T['4-53'] = {
  ru: 'Экстраординарная длина секции',
  en: 'Passageway Section Extraordinary Length',
  die: '1d100',
  rows: [
    { r: [1, 44],   out: 70 },
    { r: [45, 59],  out: 80 },
    { r: [60, 69],  out: 90 },
    { r: [70, 74],  out: 100 },
    { r: [75, 81],  out: 110 },
    { r: [82, 88],  out: 120 },
    { r: [89, 94],  out: 130 },
    { r: [95, 100], out: 140 }
  ]
};

/* --- 4-54 -------------------------------------------------------------- *
 * ВНИМАНИЕ, РЕКОНСТРУКЦИЯ. В PDF колонка Sub-Type «съехала»: значения
 * идут вразнобой относительно строк Type. Восстановлено так:
 *   1-37  Bend  — 90° Turn | Diagonal      (две подстроки одной ячейки)
 *   38-56 Bend  — Turn                     (обобщённая подпись)
 *   57-74 Inter 3-way — T-junction
 *   75-87 Inter 3-way — Y-junction
 *   88-95 Inter 4-way — Cross (+) or X
 *   96-98 Inter 4-way — Staggered
 *   99-00 Inter 5- or 6-way
 * Подтверждение из Booklet 2: «passages should not only run in each of the
 * cardinal directions, but also at 45 degree angles» → диагональные повороты
 * существуют и обязательны. Поэтому и 1-37, и 38-56 трактуются как изгиб с
 * выбором подтипа 90°/диагональ. Решение зафиксировано как «выбор мастера»
 * и попадает в аудит, чтобы его можно было переиграть.
 * ---------------------------------------------------------------------- */
T['4-54'] = {
  ru: 'Поворот или перекрёсток',
  en: 'Passageway Bend or Intersection',
  die: '1d100',
  rows: [
    { r: [1, 37],  out: 'bend90'  },
    { r: [38, 56], out: 'bend90'  },
    { r: [57, 74], out: 't3'      },
    { r: [75, 87], out: 'y3'      },
    { r: [88, 95], out: 'x4'      },
    { r: [96, 98], out: 'stag4'   },
    { r: [99, 100], out: 'rad56'  }
  ],
  kinds: {
    bend90: {
      ru: 'Изгиб', en: 'Bend', kind: 'bend',
      subs: [
        { key: 'turn90',    ru: 'Поворот 90° (поровну влево/вправо)', en: '90° Turn' },
        { key: 'diagonal', ru: 'Диагональный поворот (1d6)',         en: 'Diagonal' }
      ],
      diag: {
        die: '1d6',
        ru: '1-2 налево 45°; 3-4 направо 45°; 5 позади слева 135°; 6 позади справа 135°',
        en: '1-2 left 45°; 3-4 right 45°; 5 behind left 135°; 6 behind right 135°',
        rows: [
          { r: [1, 2], out: -45 },
          { r: [3, 4], out: 45 },
          { r: [5, 5], out: -135 },
          { r: [6, 6], out: 135 }
        ]
      }
    },
    t3: { ru: 'Перекрёсток 3-лучевой', en: 'Intersection, 3-way (T-junction)', kind: 'junction', arms: 3, shape: 'T' },
    y3: { ru: 'Перекрёсток 3-лучевой', en: 'Intersection, 3-way (Y-junction)', kind: 'junction', arms: 3, shape: 'Y' },
    x4: { ru: 'Перекрёсток 4-лучевой', en: 'Intersection, 4-way (cross or X)',  kind: 'junction', arms: 4, shape: null },
    stag4: { ru: 'Перекрёсток 4-лучевой, смещённый', en: 'Intersection, 4-way (staggered)', kind: 'junction', arms: 4, shape: 'staggered' },
    rad56: {
      ru: 'Радиальный перекрёсток 5 или 6 лучей', en: 'Intersecting, 5-way or 6-way junction',
      kind: 'junction', arms: null, shape: 'radiating',
      // 8-из-10 → 5 лучей, 2-из-10 → 6 лучей
      chance: { n: 10, ok: 8, out: 5, elseOut: 6 }
    }
  },
  // 1-из-20: перекрёсток на деле треугольная комната 20'x20' с выходами на всех сторонах
  junctionRoomChance: { n: 20, ok: 1 },
  // для T/Y: какое плечо буквы продолжает текущую секцию
  armRoll: { die: '1d6', rows: [ { r: [1,2], out: 'back' }, { r: [3,4], out: 'left' }, { r: [5,6], out: 'right' } ] },
  // 90°: поровну влево / вправо
  sideRoll: 'even2'
};

/* --- 4-55 -------------------------------------------------------------- */
T['4-55'] = {
  ru: 'Центральная камера',
  en: 'Central Chamber',
  die: '1d10',
  rows: [
    { r: [1, 1], out: { w: 60, h: 50, shape: 'irregular', exits: 4, cavern: true } },
    { r: [2, 2], out: { w: 40, h: 40, shape: 'irregular', exits: 5, cavern: true } },
    { r: [3, 3], out: { w: 40, h: 40, shape: 'irregularGeom', exits: 5, cavern: false } },
    { r: [4, 4], out: { w: 50, h: 40, shape: 'irregularGeom', exits: 4, cavern: false } },
    { r: [5, 5], out: { w: 50, h: 50, shape: 'diamond', exits: 4, cavern: false } },
    { r: [6, 6], out: { w: 40, h: 40, shape: 'irregularGeom', exits: 4, cavern: false } },
    { r: [7, 7], out: { w: 100, h: 80, shape: 'irregularGeom', exits: 4, cavern: false } },
    { r: [8, 10], out: null }
  ]
  /* presentChance убран: те же «7-из-10» закодированы строками 1-7 против 8-10.
   * Отдельный бросок шанса множил вероятность до 49% вместо 70%. */
};

/* --- 4-56 -------------------------------------------------------------- */
T['4-56'] = {
  ru: 'Прочие комнаты и камеры',
  en: 'Other Rooms and Chambers',
  die: '1d12',
  rows: [
    { r: [1, 2], out: { w: 15, h: 15, shape: 'square', note: 'closedDoor' } },
    { r: [3, 4], out: { w: 20, h: 20, shape: 'square' } },
    { r: [5, 6], out: { w: 20, h: 10, shape: 'rect' } },
    { r: [7, 7], out: { w: 20, h: 15, shape: 'rect' } },
    { r: [8, 8], out: { w: 30, h: 15, shape: 'rect', alt: { w: 40, h: 15, shape: 'rect' } } },
    { r: [9, 9], out: { w: 20, h: 15, shape: 'irregularGeom' } },
    { r: [10, 10], out: { w: 25, h: 20, shape: 'irregularGeom' } },
    { r: [11, 11], out: { w: 30, h: 20, shape: 'cavern' } },
    { r: [12, 12], out: { exceptional: true } }
  ]
  // * комнаты 15'x15' ВСЕГДА имеют закрытую дверь, когда найдены
  // ** на 8 — поровну 30'x15' или 40'x15'
};

/* --- 4-57 -------------------------------------------------------------- */
T['4-57'] = {
  ru: 'Исключительный тип комнаты',
  en: 'Other Rooms and Chambers — Exceptional Type',
  die: '1d6',
  rows: [
    { r: [1, 1], out: { w: 20, h: 20, shape: 'octagon',   round: true } },
    { r: [2, 2], out: { w: 25, h: 25, shape: 'pentagon',  round: true } },
    { r: [3, 3], out: { w: 25, h: 25, shape: 'cross' } },
    { r: [4, 4], out: { w: 40, h: 40, shape: 'diamond' } },
    { r: [5, 5], out: { w: 50, h: 50, shape: 'diamond' } },
    { r: [6, 6], out: { w: 30, h: 25, shape: 'L' } }
  ]
};

/* --- 4-58 -------------------------------------------------------------- */
T['4-58'] = {
  ru: 'Направление выхода',
  en: 'Location of Exit',
  die: '1d6',
  rows: [
    { r: [1, 1], out: 'N'  },
    { r: [2, 2], out: 'S'  },
    { r: [3, 3], out: 'E'  },
    { r: [4, 4], out: 'W'  },
    { r: [5, 5], out: { pick: ['NE', 'NW'] } },
    { r: [6, 6], out: { pick: ['SE', 'SW'] } }
  ],
  dirs: {
    N:  { ru: 'Север',  en: 'North' },
    S:  { ru: 'Юг',    en: 'South' },
    E:  { ru: 'Восток', en: 'East' },
    W:  { ru: 'Запад',  en: 'West' },
    NE: { ru: 'Северо-восток', en: 'Northeast' },
    NW: { ru: 'Северо-запад', en: 'Northwest' },
    SE: { ru: 'Юго-восток', en: 'Southeast' },
    SW: { ru: 'Юго-запад', en: 'Southwest' }
  },
  // Перебрасывать дубли. Ставить по возможности в середину стены.
  // Если пространство сразу за указанным выходом уже заполнено — потайная дверь.
  rerollDuplicates: true,
  blockedBecomesSecretDoor: true
};

/* --- 4-59 -------------------------------------------------------------- *
 * Не Irregular Cavern: бросаем 1d100.
 * Если Irregular Cavern: 1-из-6 монстр, иначе пусто. Если монстр — 5-из-6 сокровище.
 * Соло-правило: «A non-wandering monster will always have treasure in solo play.»
 * ---------------------------------------------------------------------- */
T['4-59'] = {
  ru: 'Содержимое комнаты или камеры',
  en: 'Room or Chamber Contents',
  die: '1d100',
  rows: [
    { r: [1, 39],  out: 'empty' },
    { r: [40, 86], out: 'monster' },
    { r: [87, 100], out: 'treasure' }
  ],
  cavern: {
    monsterChance: { n: 6, ok: 1 },
    // монстр найден → 5-из-6 сокровище
    treasureChance: { n: 6, ok: 5 }
  }
};

/* --- 4-60 -------------------------------------------------------------- *
 * Бросок 2d6+3. Если больше 12 — перебросить.
 * ---------------------------------------------------------------------- */
T['4-60'] = {
  ru: 'Число лестниц',
  en: 'Stairway — Number',
  die: '2d6+3',
  rerollAbove: 12,
  /* В книге первая строка «5 → 4» (подтверждено пользователем по буклету).
   * Ранее стояло 5 — ошибка оцифровки, из-за которой на минимальном броске
   * появлялась лишняя лестница. */
  rows: [
    { r: [5, 5],   out: 4  },
    { r: [6, 7],   out: 9  },
    { r: [8, 9],   out: 10 },
    { r: [10, 10], out: 14 },
    { r: [11, 12], out: 17 }
  ]
};

/* --- 4-61 -------------------------------------------------------------- *
 * 2d6 → полоса расстояния от центра, затем 1d5 → точное значение внутри полосы.
 * ---------------------------------------------------------------------- */
T['4-61'] = {
  ru: 'Расстояние от центра',
  en: 'Stairway — Distance from Central Point',
  die: '2d6',
  rows: [
    { r: [2, 2],   out: { from: 0,   to: 50 }  },
    { r: [3, 5],   out: { from: 51,  to: 100 } },
    { r: [6, 8],   out: { from: 101, to: 150 } },
    { r: [9, 10],  out: { from: 151, to: 200 } },
    { r: [11, 11], out: { from: 201, to: 250 } },
    { r: [12, 12], out: { from: 251, to: null } }
  ],
  // 1d5 = половина десятигранника, уточняет расстояние внутри 50-футовой полосы
  fine: { die: '1d5', bandWidth: 50 }
};

/* --- Направление лестницы (1d8), 45-градусные сектора от центра --------- */
T['stair-dir'] = {
  ru: 'Направление лестницы от центра',
  en: 'Stairway — Direction from center',
  die: '1d8',
  rows: [
    { r: [1, 1], out: 'N'  },
    { r: [2, 2], out: 'NE' },
    { r: [3, 3], out: 'E'  },
    { r: [4, 4], out: 'SE' },
    { r: [5, 5], out: 'S'  },
    { r: [6, 6], out: 'SW' },
    { r: [7, 7], out: 'W'  },
    { r: [8, 8], out: 'NW' }
  ]
};

/* --- Общие параметры лестниц ------------------------------------------- */
T['stairway-general'] = {
  // «There is a 1-in-100 chance that a stairway goes both up and down.
  //  Otherwise, there is an even chance that a stairway goes up or down.»
  bothChance: { n: 100, ok: 1 },
  // «There is a 1-in-10 chance that the stairway spirals. All of these should
  //  be indicated by a circular chamber 20 feet in diameter. Otherwise, the
  //  stairway is represented by a 5' wide and 10' long (more or less).»
  spiralChance: { n: 10, ok: 1 },
  spiralFootprint: { w: 20, h: 20, shape: 'round' },
  plainFootprint: { w: 5, h: 10, shape: 'rect' },
  // «Dungeon levels are separated by 20 to 30 feet of earth or stone.»
  levelGapFeet: [20, 30]
};

/* --- Окружение лестницы (1d6) ------------------------------------------ */
T['stair-surround'] = {
  ru: 'Окружение лестницы',
  en: 'Stairway — Surroundings',
  die: '1d6',
  rows: [
    { r: [1, 2], out: 'passage' },
    { r: [3, 6], out: 'room', maxSize: 30 }
  ],
  // «Any stairway in the first distance band is likely found somewhere in the
  //  central chamber.» → 0-50 футов
  centralBandMax: 50
};

/* --- Число выходов комнаты (1d6) --------------------------------------- */
T['room-exits'] = {
  ru: 'Число выходов комнаты',
  en: 'Number of Exits',
  die: '1d6',
  rows: [
    { r: [1, 1], out: 1 },
    { r: [2, 5], out: 2 },
    { r: [6, 6], out: 3 }
  ]
};

/* --- Поиск потайной двери в комнате-тупике ----------------------------- *
 * «For each 10 feet searched, there is a 1-in-12 chance of discovering a
 *  secret door. Neither the floor nor ceiling may be searched in this manner.»
 * ---------------------------------------------------------------------- */
T['secret-door-search'] = {
  ru: 'Поиск потайной двери в тупике',
  en: 'Secret door search in a dead end',
  perFeet: 10,
  chance: { n: 12, ok: 1 },
  note: 'так обыскивают только стены; пол и потолок искать нельзя'
};

/* --- Параметры подземелья --------------------------------------------- */
T['dungeon'] = {
  /* Размер листа (42×54 клетки) и «клетка = 10 футов» убраны вместе с
   * геометрией: карту рисует мастер, программа в клетках не считает.
   * Остались только правила бросков. */
  passageWidthFeet: 10,
  // «There is a 1in-20 chance that the passage is either 5' wide or 20' wide.
  //  If it is a secret passage, the width is always 5 feet.»
  widthVarianceChance: { n: 20, ok: 1 },
  widthVariance: [5, 20],
  secretPassageWidth: 5,
  // «A passageway that 'collides' with another feature can either be
  //  transformed into a dead end, or a secret door (even chances of either).»
  collisionSplit: ['deadend', 'secretdoor'],
  // «A passageway that reaches the edge of the map should dead end 5 to 10
  //  feet prior to the map edge.»
  edgeDeadEndMargin: [5, 10],
  // «For every 100 feet of passageway travelled ... there is a 8-in-10
  //  chance that a room or chamber has been found.»
  roomChancePer100ft: { n: 10, ok: 8 },
  // «Every 2,000 square feet explored (i.e. every 20 squares) the solo player
  //  must roll for an oddity.»
  oddityEverySqFt: 2000,
  // альтернатива: 5% за каждый пройденный квадрат
  oddityAltChancePerSquare: 0.05,
  // «there is a 4-in-6 chance that the next oddity is exactly the same»
  oddityRepeatChance: { n: 6, ok: 4 },
  // «There is a 1-in-5 chance per level that the dungeon extends beyond the
  //  border of the graph paper.»
  extraordinaryMagnitudeChance: { n: 5, ok: 1 },
  // «Orcs within a single dungeon are usually of the same tribe. Exceptions
  //  such as escaped prisoners are also possible.»
  orcSameTribe: true,
  /* Случайная встреча за ход. РЕКОНСТРУКЦИЯ: буклет частоту не задаёт (упоминает
   * лишь «wandering monster check» как следствие шума); 1-из-6 — классика OD&D.
   * Ход = 10 минут: 90 футов движения, обыск комнаты или 10 футов стены. */
  wanderChance: { n: 6, ok: 1 },
  minutesPerTurn: 10,
  feetPerTurn: 90,      /* 90 футов пути = 10 минут */
  wallFeetPerTurn: 10,  /* 10 футов стены = 10 минут */
  // «any underground encounter takes place at 1d6 x 10 feet» (Booklet 2)
  encounterDistance: { die: '1d6', per: 10 }
};

/* Свет. ВНИМАНИЕ: факел здесь 10 минут (6 в час) — это ОСОЗНАННОЕ переопределение
 * буклета 2 («Each torch lasts one hour») по указанию пользователя. */
T.lights = {
  torch:   { ru: 'Факел',               burn: 10, radius: 15, reflect: 30, fuel: 'torch', fuelRu: 'факел' },
  lantern: { ru: 'Фонарь',              burn: 30, radius: 15, reflect: 30, fuel: 'oil',   fuelRu: 'масло' },
  mirror:  { ru: 'Фонарь с зеркалом',   burn: 30, radius: 30, half: true, reflect: 60, fuel: 'oil', fuelRu: 'масло' }
};
/* Без света — полная темнота. */
T.lights.none = { ru: 'Нет света (темнота)', burn: 0, radius: 0, reflect: 0, fuel: null };

if (typeof module !== 'undefined') module.exports = T;
