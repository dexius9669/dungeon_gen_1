/* =============================================================================
 * ДИКОВИНКИ — BOOKLET 4: RANDOM DUNGEON GENERATION, раздел "Oddities"
 * Первоисточник: Random_Dungeon, строки 403-545. Всего 38 пунктов.
 *
 * Правило повтора: «there is a 4-in-6 chance that the next oddity is exactly
 * the same. This may create a thematic feel for portions of the dungeon.»
 *
 * СЕМЬ ПУНКТОВ ССЫЛАЮТСЯ НА БУКЛЕТ 2 — они не пустые, а связанные:
 *   #6 Pit        → traps.Pit          (см. src/data/traps.js)
 *   #7 Fire Pit   → traps.PitFire      30'x20'
 *   #16 Cage      → traps.Cage
 *   #17 Slide     → traps.Slide
 *   #19 Living Statue  → creatures.LivingStatue   (Буклет 2)
 *   #37 Haunting Spirit→ creatures.HauntingSpirit (Буклет 2)
 *   #38 Minotaur       → creatures.Minotaur       (Буклет 2)
 *
 * ОДИН ПУНКТ ЗАПУСКАЕТ ОРАКУЛ:
 *   #25 Glowing Bronze Tablet → ui/oracles.js, тема надписи
 *
 * Поля записи:
 *   n      — номер в буклете
 *   ru/en  — текст
 *   sub    — { die, table } доп. бросок
 *   trap   — ключ в TRAPS (Буклет 2)
 *   creature — ключ в CREATURES (Буклет 2)
 *   oracle — 'tablet' → сгенерировать надпись через Оракулы
 *   need   — { cavernMinSqFt } условие, иначе переброс
 *   once   — 'dungeon' → не более одного на всё подземелье
 * ========================================================================== */

const ODDITIES = [
  { n: 1,
    ru: 'Загоны для скота (5' + "'" + ' квадрат) или dungeon-клетки (10' + "'" + ' квадрат)',
    en: "Animal Pens (5' square) or Dungeon Cells (10' square)" },

  { n: 2, sub: { die: '1d4' },
    ru: '1d4 подвесных клеток с человеческими костями. В той же зоне — прочие орудия пыток.',
    en: '1d4 hanging cages with human(oid) bones in them. Other implements of torture are in the same area.' },

  { n: 3, sub: { die: '1d8' },
    ru: '1d8 круглых или треугольных колонн',
    en: '1d8 circular or triangular pillars' },

  { n: 4,
    ru: 'Большая круглая несущая колонна',
    en: 'Large, circular, load-bearing column' },

  { n: 5,
    ru: "Колонна с потайной дверью. Внутри найдена лестница — вверх или вниз, "
      + 'заканчивается она небольшим тоннелем (3' + "'" + '–5' + "'" + ' шириной и 5' + "'" + '–6' + "'" + ' высотой), '
      + 'чуть выше или ниже текущего уровня. Тоннель ведёт к другой потайной двери где-то ещё на этом же уровне. '
      + 'Выход ищется процедурой генерации лестниц.',
    en: 'Pillar with secret door. A stairway is found inside. The stairway may lead upwards or downwards and ends in a small tunnel. '
      + "This small tunnel (3' - 5' wide and 5' - 6' high) is slightly above or below the current dungeon level. "
      + 'The tunnel leads to another secret door somewhere else on the same level. Use the stairway generation procedure to locate the exit.',
    effect: { tunnel: true, secretStair: true } },

  { n: 6, trap: 'Pit',
    ru: 'Яма — см. ловушку «Яма» (Буклет 2)',
    en: 'Pit — see Booklet 2 trap "Pit"' },

  { n: 7, trap: 'PitFire', footprint: { w: 30, h: 20 },
    ru: 'Огненная яма 30' + "'" + '×20' + "'" + ' — см. ловушку «Яма с кольями, огненная» (Буклет 2)',
    en: 'Fire Pit (30\' x 20\') — see Booklet 2 trap "Pit, Fire"' },

  { n: 8, sub: { die: '1d8' }, count: 8,
    ru: '«Призрачная комната» с 8 Призраками, Духами или Спектрами. Тип монстра соответствует уровню подземелья.',
    en: '"Ghost Room" with 8 Ghosts, Haunting Spirits, or Spectres. The type of monster is appropriate to the level of the dungeon.',
    note: 'Haunting Spirit и Spectre описаны в Буклет 2; Ghost — в таблице 4-62 (ур. 6).' },

  { n: 9, sub: { die: '1d6' },
    ru: '1d6 трупов — вздутые, синие, в окоченение и т. п., с медными монетами и обломками оружия. '
      + 'Некоторые могут быть необычными: пещерный человек (7 футов, волосатый) или другая гуманоидная раса.',
    en: '1d6 bodies - Bloated, blue, in rigor mortis, etc. accompanied by copper coins and broken weapons. '
      + 'Some bodies may be unique such as that of a caveman (7\' tall and hairy) or other humanoid race.' },

  { n: 10, sub: { die: '3d3' },
    ru: 'Щебень (заполняет 3d3 клетки)',
    en: 'Rubble (fills 3d3 squares)',
    footprint: { cells: '3d3' } },

  { n: 11,
    ru: 'Потайная дверь',
    en: 'Secret Door' },

  { n: 12, sub: { chance: { n: 4, ok: 3 } },
    ru: 'Дверь (приоткрыта 3-из-4; закрыта 1-из-4). Закрытые двери могут быть заклинены, заперты или и то и другое.',
    en: 'Door (Ajar 3-in-4 chance; Closed 1-in-4 chance). Closed doors may be stuck, locked, or both.' },

  { n: 13, footprint: { w: 10, h: 15 }, sub: { chance: { n: 2, ok: 1 } },
    ru: 'Водоём, овальный, 10' + "'" + '×15' + "'" + '. Вода либо питьевая, либо стоячая — поровну.',
    en: "Pool of Water, Oblong - 10' x 15'. The water is either potable or stagnant (even chances of either result)." },

  { n: 14,
    ru: 'Подземный ручей — петляет на 360 футов по карте, давая доступ тем, кто способен не дышать. '
      + 'К ручью присоединена одна скрытая комната, недоступная никаким иным путём.',
    en: 'Underground Stream - Meanders 360 feet across the map providing access to those who can hold their breath. '
      + 'One hidden room is connected to the stream, inaccessible in any other way.',
    effect: { streamFeet: 360, hiddenRoom: true } },

  { n: 15, need: { cavernMinSqFt: 720 },
    ru: 'Если диковинка выпала в неправильная каверна площадью не менее 720 кв. футов — большой подземный бассейн. Иначе — переброс.',
    en: 'If oddity within an Irregular Cavern of 720 square feet or greater, there is a large underground pool. Otherwise, re-roll.' },

  { n: 16, trap: 'Cage',
    ru: 'Клетка — см. ловушку «Клетка» (Буклет 2)',
    en: 'Cage — see Booklet 2 trap "Cage"' },

  { n: 17, trap: 'Slide',
    ru: 'Скользящий спуск — см. ловушку «Скольз» (Буклет 2)',
    en: 'Slide — see Booklet 2 trap "Slide"' },

  { n: 18,
    ru: 'Повалившаяся статуя Посейдона (или подобный объект почитания)',
    en: 'Fallen statue of Poseidon (or similar object of worship or adoration)' },

  { n: 19, creature: 'LivingStatue',
    ru: 'Живая статуя — см. Буклет 2',
    en: 'Living Statue — see Booklet 2' },

  { n: 20, trap: 'TrapDoor', sub: { die: '1d3' },
    ru: 'Люк-ловушка, вверх на 1d3 уровня',
    en: 'Trap Door - Up 1d3 levels' },

  { n: 21, sub: { die: '1d3' }, chance: { n: 6, ok: 5 },
    ru: 'Открытый колодец. С вероятностью 5-из-6 просто вниз на 1d3 уровня. '
      + 'С вероятностью 1-из-6 колодец практически бездонный либо заканчивается раскалённой лавой.',
    en: 'Open Shaft - There is a 5-in-6 chance that this just goes down 1d3 levels. '
      + 'There is a 1-in-6 chance that the shaft is essentially bottomless or ends in hot lava.' },

  { n: 22, sub: { die: '1d6' },
    ru: 'Дымящийся горшок — выстреливает огненными шарами до 20 футов, попадая в кого-либо на 7 или больше на 2d6. '
      + 'Попавшие получают 1d6 HTK урона без шанса на спасброск.',
    en: 'Smoking Pot - Shoots balls of fire up to 20 feet that strike anyone on a roll of 7 or greater on 2d6. '
      + 'Those struck receive 1d6 HTK of damage with no chance to save.' },

  { n: 23,
    ru: 'Фонтан с чёртовой статуей. Обсидиановый чёрт в натуральную величину с золотыми рогами; '
      + 'инкрустированное серебро выделяет нос, рот и уши; рубиновые глаза светятся тревожным красным. '
      + 'Изо рта льётся серная, но питьевая вода. Если повозиться, статуя начинает выть, земля содрогается. '
      + 'Если приключенцы продолжают — земля вокруг фонтана обрушивается.',
    en: 'Fountain with Devilish Statue - The life-sized, obsidian devil has gold horns. Inlaid silver highlights the nose, mouth, and ears. '
      + 'The ruby eyes of the statue emit an ominous red glow. From its mouth pours sulfurous (but drinkable) water. '
      + 'If meddled with, the statue begins to howl and the ground beings to tremble. If adventurers persist, '
      + 'the area around the fountain collapses.' },

  { n: 24, once: 'dungeon',
    ru: 'Светящаяся лестница. Такая в подземелье всего одна. Шириной 20 футов, ведёт с текущего уровня на самый глубокий; '
      + 'по ступив развернуться уже нельзя.',
    en: 'Glowing Stairway - Only one of these is found within the dungeon. This 20\' wide stairway travels '
      + 'from the current level to the deepest one with no chance to turn around once trod upon.' },

  { n: 25, oracle: 'tablet',
    ru: 'Светящаяся бронзовая табличка. Не волшебные письмена на ней — на общем языке. Она может говорить что угодно. '
      + 'Мастер вправе обратиться к ОРАКУЛЬСКИМ ТАБЛИЦАМ (Буклет 10), чтобы определить её тему.',
    en: 'Glowing Bronze Tablet - The non-magical writing upon it is in the common tongue. It can say anything. '
      + 'The Referee may consult BOOKLET 10: ORACULAR TABLES to determine its subject.' },

  { n: 26,
    ru: 'Деревянное ведро, наполненное кровью',
    en: 'Wooden bucket filled with blood' },

  { n: 27, sub: { die: '1d12' },
    ru: '1d12 пустых деревянных гробов',
    en: '1d12 empty wooden caskets' },

  { n: 28,
    ru: 'Невидимая стена, преграждающая путь. Может стоять посреди комнаты, прохода или даже лестницы',
    en: 'Invisible wall that blocks passage. Can be in the middle of a room, passage, or even stairway' },

  { n: 29, footprint: { w: 5, h: 5 },
    ru: 'Дверь в кладовку 5' + "'" + '×5' + "'" + ' под метлу (теперь пустую) или в отхожее место',
    en: 'A door leading to a 5\' by 5\' broom closet (now empty) or privy' },

  { n: 30,
    ru: 'Когда-то роскошная обстановка, ныне — в упадке или руинах',
    en: 'Once sumptuous furnishings are found in disrepair or ruin' },

  { n: 31, sub: { chance: { n: 2, ok: 1 } },
    ru: 'Ниша в стене с (волшебной) статуэткой прекрасной женщины / красивого мужчины. Попытки соблазнить обладателя будят его ото сна. '
      + 'Каждое соблазнение считать, как будто жертва подверглась заклинанию Очарование. '
      + 'При отказе — превращается в Гигантскую Змею и бросается в бой.',
    en: 'Notch in the wall containing a (magical) statuette of a beautiful woman / handsome man. '
      + 'Attempts to seduce possessor, waking him from sleep. Treat each seduction as though the victim has been subjected to a Charm Person spell. '
      + 'If rebuffed, will transform into a Giant Snake and attack.' },

  { n: 32,
    ru: 'Чёртова впадина в полу с алтарём по бокам от пылающих жаровен. Если потревожить — землетрясение с угрозой обвала',
    en: 'Devil shaped indentation in the floor with an altar flanked by flaming braziers. If disturbed, an earthquake threatens a cave-in.' },

  { n: 33,
    ru: 'Пятно грибов неизвестного типа. Грибы очень легко воспламеняются. Если поджечь, дым может вызвать удушье, рвоту, галлюцинации или смерть',
    en: 'A patch of fungi of unknown type. The fungi are very flammable. If inflamed, the smoke produced may induce choking, vomiting, hallucinations, or death.' },

  { n: 34, sub: { chance: { n: 6, ok: 1 } },
    ru: 'Мощный и устойчивый порыв воздуха, около 100 миль в час, накрывает комнату, проход или зал. '
      + 'Все факелы и фонари задуты. Любые двери поблизости захлопываются или распахиваются '
      + '(в зависимости от направления от источника ветра). Есть 1-из-6 шанс, что порыв ударит, '
      + 'когда приключенцы проходят мимо.',
    en: 'The chamber, passage, or room is swept with a powerful and sustained gust of air, approximately 100 miles per hour. '
      + 'All torches and lanterns are blown out. Any doors in the vicinity are slammed open or shut '
      + '(depending on direction from the source of the wind). There is a 1-in-6 chance that the wind gust occurs when adventurers pass by.' },

  { n: 35, sub: { die: '1d5', table: 'spill' },
    ru: 'Разлив. Вариант 1d5.',
    en: 'Spill — 1d5',
    tables: {
      spill: {
        ru: 'Разлив',
        en: 'Spill',
        rows: [
          { r: [1, 1], out: 'jewels' },
          { r: [2, 2], out: 'oil' },
          { r: [3, 3], out: 'steam' },
          { r: [4, 4], out: 'tar' },
          { r: [5, 5], out: 'vein' }
        ],
        detail: {
          jewels: { ru: 'Необработанные самоцветы — 1d100 штук из естественной трещины или колонны, по 10 зм каждый, пока не огранены ювелиром.',
                    en: 'Uncut jewels - 1d100 jewels spill out of a natural crack or pillar. They are worth 10 gp each until cut and polished by a jeweler.',
                    sub: { die: '1d100' } },
          oil:    { ru: 'Масло — пузырится из трещины в стене или потолке и собирается на полу. Годится немедленно. 3d10 флаконов.',
                    en: 'Oil - This bubbles out of a crack in the wall or ceiling and pools on the floor. It is suitable for immediate use. There are 3d10 flasks worth.',
                    sub: { die: '3d10' } },
          steam:  { ru: 'Пар — природная щель в стене, потолке или полу испускает пар под высоким давлением через непредсказуемые интервалы. 1-из-3 шанс ошпарить проходящего на 1 кость урона.',
                    en: 'Steam - A natural vent in the wall, ceiling, or floor emits high pressure steam at unpredictable intervals. There is a 1-in-3 chance that anyone passing by may be scalded for 1 die of damage.',
                    sub: { chance: { n: 3, ok: 1 }, die: '1d6' } },
          tar:    { ru: 'Дёготь — пол покрыт пузырящейся смолой. Проходящий оставляет следы и оставляет неуловимый запах на 1d6 ходов. Босиком — 1 кость урона.',
                    en: 'Tar - The floor is covered with bubbling tar. Anyone passing through leaves footprints and emits an unmistakeable odor for 1d6 turns. Those in bare feet take 1 die of damage.',
                    sub: { die: '1d6' } },
          vein:   { ru: 'Жила меди, серебра или золота в стене, полу или потолке. Дворф, Гном или Фея замечают автоматически, прочие — 1-из-6. Руду нужно добыть, переработать и отчеканить.',
                    en: 'Vein of copper, silver, or gold is embedded in the wall, floor, or ceiling. A Dwarf, Gnome, or Fairy automatically spots it but others passing by only have a 1-in-6 chance of noticing. The ore requires mining, refining, and minting to be worth anything.',
                    sub: { chance: { n: 6, ok: 1 } } }
        }
      }
    } },

  { n: 36, sub: { die: '1d8', table: 'gas' },
    ru: 'Газовый карман. Тип 1d8. Разрешён спасброск.',
    en: 'A Gas Pocket of one of the following types. Roll 1d8. Allow a saving throw.',
    tables: {
      gas: {
        ru: 'Газовый карман',
        en: 'Gas Pocket',
        rows: [
          { r: [1, 1], out: 'obscured' },
          { r: [2, 2], out: 'blinded' },
          { r: [3, 3], out: 'fear' },
          { r: [4, 4], out: 'sleep' },
          { r: [5, 5], out: 'attribute' },
          { r: [6, 6], out: 'poison' },
          { r: [7, 7], out: 'hypersensitive' },
          { r: [8, 8], out: null }
        ],
        detail: {
          obscured:      { ru: 'Мутное зрение на 1d6 клеток', en: 'Obscured vision for 1d6 squares', sub: { die: '1d6' } },
          blinded:       { ru: 'Слепота для подвергшихся на 1d6 ходов', en: 'Blinds those exposed for 1d6 turns', sub: { die: '1d6' } },
          fear:          { ru: 'Страх: подвергшийся убегает на одну нормальную дистанцию движения (то есть 120 футов необременённому)', en: 'Fear causes anyone exposed to run 1 normal movement distance (i.e. 120\' if unencumbered)' },
          sleep:         { ru: 'Сон 2d6 ходов', en: 'Sleep 2d6 turns', sub: { die: '2d6' } },
          attribute:     { ru: 'Случайная Характеристика затронута. Повышение / понижение на 1d3 пункта более на 1d6 часов', en: 'A random Attribute is affected. Raised / Lowered 1d3 points more for 1d6 hours', sub: { die: '1d3' } },
          poison:        { ru: 'Смертельный яд', en: 'Deadly Poison' },
          hypersensitive:{ ru: 'Сверхчувствительное зрение — потерпевший (проваливший спасброск) автоматически обнаружит следующую потайную дверь', en: 'Hypersensitive Vision - Anyone affected (failed save) can detect the next secret door automatically.' }
        }
      }
    } },

  { n: 37, creature: 'HauntingSpirit',
    ru: 'Призрачный дух — см. Буклет 2',
    en: 'Haunting Spirit — see Booklet 2' },

  { n: 38, creature: 'Minotaur',
    ru: 'Минотавр — см. Буклет 2',
    en: 'Minotaur — see Booklet 2' }
];

/* --- Существа из Буклет 2 (три ссылки «See BOOKLET 2») ------------------ *
 * HTK, как везде в этой системе. Детали безумия оставлены мастеру.
 * ---------------------------------------------------------------------- */
const CREATURES = {
  LivingStatue: {
    ru: 'Живая статуя',
    en: 'Living Statue',
    htk: '2d6',
    body: 'Ожившая статуя из глины, камня или металла. Все двигаются; некоторые умеют произнести послание или вступить в короткий диалог. '
        + 'Размеру нет предела, но обычно она больше человека и меньше великана. Одни вооружены, другие сминают и разбивают противника руками. '
        + 'Обычно связана инструкциями — чаще всего охраняет место или клад. Есть и красивые, вроде высеченной Пигмалионом.',
    en_body: 'An animated clay, stone, or metal statue. All can move, while some are imbued with a limited ability to speak a message or have a brief interaction. '
        + 'There is seemingly no limit to the size of the statue but most are larger than a man yet smaller than a giant. Some are armed, '
        + 'others use their arms and hands to crush or smash an opponent. A Living Statue is usually bound to follow a set of instructions; '
        + 'most are used to guard a location or treasure trove. A handful are quite beautiful like the one sculpted by Pygmalion.'
  },
  HauntingSpirit: {
    ru: 'Призрачный дух',
    en: 'Haunting Spirit',
    htk: '1d6',
    attack: { die: '1d3', severe: { die: '1d6', chance: { n: 6, ok: 1 }, severeChance: 'storm night' } },
    body: 'Дух, привязанный к определённому месту: комнате, жилищу, кладбищу, холму, усадьбе или целой топи. '
        + 'Не обязательно человеческий — может быть духом любимого питомца, например собаки или кошки. Появляется редко, '
        + 'обычно только краем глаза или в тени; те, кто чувствует психическую энергию (Маг, Клирик), замечают первыми. '
        + 'Обычно только пугает, но отдельные предпочитают шутить: швыряют мелкие предметы, кричат, воспроизводят сцену насилия, '
        + 'предвещают гибель. Некоторые действуют физически: царапают, толкают, роняют, поднимают жертву и тащат её. '
        + 'Обычные атаки — 1d3 HTK. Худшие (в бурную ночь, на пике силы) — 1d6 HTK с спасброском, иначе смерть или безумие.',
    en_body: 'A spirit bound to a particular location. The location can be a single room, dwelling, graveyard, hilltop, manse, or an entire marsh. '
        + 'The spirit need not be that of a human; it can be that of a beloved pet such as a dog or cat. Seldom seen, except out of the corner of the eye, '
        + 'or moving in the shadows. Those sensitive to psychic energy (such as a Magic-User or Cleric) may sense it first. '
        + 'Often just frightening, though a few prefer practical jokes. Some act out physically: clawing at a victim, pushing or tripping someone, '
        + 'or lifting the person off the ground and carrying them about. Such attacks do 1d3 HTK. The worst of these can cause death or insanity, '
        + 'especially during a stormy night when their powers are at the peak; such attacks do 1d6 HTK but the victim gets a saving throw to avoid harm.'
  },
  Minotaur: {
    ru: 'Минотавр',
    en: 'Minotaur',
    htk: '3d6',
    attack: { die: '3d6', mult: 2 },
    body: 'Плотоядный зверь с бычьей головой на могучем теле мужчины или женщины. Вспыльчив, не слишком умён, силён как бык. '
        + 'Бьёт двойным уроном. Не проверяет мораль — автоматически атакует и преследует, пока жертва в поле зрения.',
    en_body: 'A flesh-eating beast with a bovine head atop the powerful body of a man or woman. Bad-tempered, not too bright, and as strong as a bull. '
        + 'It does twice damage when it strikes. Does not check morale: will automatically attack and pursue so long as its prey is in sight.'
  }
};

if (typeof module !== 'undefined') {
  module.exports = { ODDITIES, CREATURES };
}
