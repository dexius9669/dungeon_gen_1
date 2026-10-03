/* =============================================================================
 * ЛОВУШКИ И ОСОБЫЕ КОМНАТЫ — OD&D BOOKLET 2 (фрагмент)
 * Первоисточник: Booklet_2.txt (прислан пользователем), Booklet_2_notes.md
 *
 * ВАЖНО: в буклете это НЕ таблица с кубиком, а перечень из 14 описаний:
 *   «There are any number of tricks and traps for the unwary in the
 *    underworld... The Referee is encouraged to add to this list continually
 *    so that participants never become bored or complacent.»
 * Поэтому бросок 1d14 введен генератором, а не буклетом. Все 14 показываются
 * в ключе, чтобы мастер мог подменить результат вручную.
 *
 * Ссылка 4-из-6 «следующая диковинка такая же» из Booklet 4 повторяет ТИП
 * ловушки, а не позицию в таблице.
 *
 * Прямое соответствие «See Traps above» из Booklet 4:
 *   oddity #6  Pit      → traps.Pit
 *   oddity #7  Fire Pit → traps.PitFire
 *   oddity #16 Cage     → traps.Cage
 *   oddity #17 Slide    → traps.Slide
 *   oddity #20 Trap Door→ traps.TrapDoor
 *
 * Всё в HTK, не в HP.
 * ========================================================================== */

const TRAPS = {
  Pit: {
    ru: 'Яма',
    en: 'Pit',
    ref: '4-6',
    mech: '1d6 HTK за каждые 10 футов падения; спасброск делит урон пополам. Снизу выхода нет.',
    en_mech: '1d6 HTK per ten feet fallen; a saving throw halves it. Typically no exit at the bottom.',
    trap: true, fall: true, damage: { die: '1d6', per: 10, save: 'halve' },
    stealth: 'бывает открытой, замаскированной или закрытой; срабатывает под весом'
  },
  PitStaked: {
    ru: 'Яма с кольями',
    en: 'Pit, Staked',
    ref: null,
    mech: 'Как яма, но дно устлано кольями: 4-из-6 отравлены (спасброск или смерть). Колья дают +1d6 HTK сверх падения.',
    en_mech: 'As the pit, but the bottom is lined with stakes likely (4-in-6) poisoned. If poisoned, a saving throw avoids death. The stakes do 1d6 HTK in excess of the fall.',
    trap: true, fall: true, damage: { die: '1d6', per: 10, save: 'halve', extra: { die: '1d6' }, poison: { n: 6, ok: 4, lethal: true } }
  },
  PitFire: {
    ru: 'Огненная яма',
    en: 'Pit, Fire',
    ref: '4-7',
    footprint: { w: 30, h: 20 },
    mech: 'Как яма, но падающий оказывается в печи, горне или плавильне. Шахта, через которую он упал, подводит свежий воздух; '
       + 'рядом вторая шахта — дымоход, она может вести куда угодно. Пока он в огне — ещё 1d6/2d6 HTK каждый раунд.',
    en_mech: 'As the pit, however the character lands inside an oven, forge, or furnace. The shaft he fell down supplies fresh air; '
       + 'another shaft nearby is the chimney and may lead elsewhere in the dungeon or to the surface. He takes additional damage (1d6 or 2d6) each round he remains in the fire.',
    trap: true, fall: true, damage: { die: '1d6', per: 10, save: 'halve', burn: { die: '2d6', perRound: true } }
  },
  Cage: {
    ru: 'Клетка',
    en: 'Cage',
    ref: '4-16',
    mech: 'При срабатывании клетка падает на одного или нескольких персонажей и держит их 1d6 ходов. '
       + 'Если клетка в комнате, приманкой часто служит случайный клад — и для заманивания, и как награда за обход.',
    en_mech: 'When triggered, a cage falls on one or more characters, trapping them for 1d6 turns before they can escape. '
       + 'If the cage is in a room, a randomly determined treasure is often the bait to entice adventurers into the trap, or to reward them if it is circumvented.',
    trap: true, hold: { die: '1d6' }, bait: 'treasure'
  },
  Slide: {
    ru: 'Скольз',
    en: 'Slide',
    ref: '4-17',
    goesDown: true,
    mech: 'Приключенец проваливается через люк и съезжает на склоне на следующий уровень. Если склоз в комнате, мастер бросает '
       + 'случайный клад как приманку. Игрок сам называет число — оно определяет, в какую камеру следующего уровня его выбросит. '
       + 'Если там монстр — бой без шанса на сюрприз, у монстра автоматически враждебная реакция.',
    en_mech: 'An adventurer falls through a trapdoor and onto a slide descending to the next level. If the slide is in a room, the Referee rolls a random treasure as bait. '
       + 'The player picks a number; it determines which chamber on the next level he is dumped into. If there is a monster there, he must fight it — no chance of surprise, '
       + 'and the monster automatically has a negative reaction.',
    trap: true, goesDown: true, bait: 'treasure', playerPicksTarget: true
  },
  TrapDoor: {
    ru: 'Люк-ловушка',
    en: 'Trap Door',
    ref: '4-20',
    goesDown: true, sub: { die: '1d3' },
    mech: 'Вес одного или нескольких приключенцев проваливает люк, и они падают на следующий уровень подземелья.',
    en_mech: 'The weight of one or more adventurers causes it to give way, dropping them to the next level of the dungeon.',
    trap: true, goesDown: true
  },
  Chute: {
    ru: 'Жёлоб',
    en: 'Chute',
    ref: null,
    goesDown: true,
    mech: 'Панель в полу проваливается, и сработавший уносится вниз на уровень ниже. Часто есть механизмы против подъёма: '
       + 'смазка, ряд односторонних панелей, втягивающиеся шипы (как в современном гараже).',
    en_mech: 'A panel in the floor gives way and the adventurer who triggered it is swept downward to a lower level. '
       + 'Often the chute has mechanisms to prevent climbing back up: grease, one-way panels, retracting spikes.',
    trap: true, goesDown: true
  },
  ElevatorRoom: {
    ru: 'Лифтовая комната',
    en: 'Elevator Room',
    ref: null,
    sub: { die: '1d3' },
    mech: 'Как только определённое число участников входит в комнату, двери запечатываются и комната уходит вниз на 1d3 уровня. '
       + 'Вернётся на место со временем — но не если она занята.',
    en_mech: 'After a certain number of participants enter, the doors seal and the room descends 1d3 levels. '
       + 'It will eventually return to its original location, though not if occupied.',
    trap: true, sub: { die: '1d3' }
  },
  AcidBath: {
    ru: 'Кислотная ванна',
    en: 'Acid Bath',
    ref: null,
    mech: 'Яма или целая камера, залитая едкой жидкостью, которая может выделять ядовитые пары. Обычно есть способ перебраться '
       + 'на другую сторону — шаткая лестница, гнилая верёвка или что-нибудь столь же рискованное. Решают навык или чистая удача. '
       + 'Броня даёт несколько раундов защиты.',
    en_mech: 'A pit or entire chamber filled with a highly corrosive substance that may give off poisonous fumes. Typically a means to cross is provided — '
       + 'a rickety ladder, dodgy rope, or other risky means. Skill or blind luck often determines who lives. Armor may provide a few rounds of protection.',
    trap: true, hazard: 'acid', armorRounds: 'few'
  },
  MagicalPortal: {
    ru: 'Волшебный портал',
    en: 'Magical Portal',
    ref: null,
    sub: { die: '1d6' },
    mech: 'Прошедших переносит из одного места в другое, но космический баланс должен сохраниться. Поэтому HTK всех '
       + 'перенесённых существ подсчитывается, и в течение 1d6 ходов из портала выходят случайные существа, пока HTK '
       + 'с обеих сторон не сравняются.',
    en_mech: 'Those who pass through are transported elsewhere, but cosmic balance must be maintained. The HTK of any creatures sent through '
       + 'are tallied, and within 1d6 turns one or more creatures (at random) emerge from the portal until the HTKs are equal on both sides.',
    trap: true, sub: { die: '1d6' }
  },
  PileOfBones: {
    ru: 'Куча костей',
    en: 'Pile of Bones',
    ref: null,
    sub: { die: '1d4' },
    mech: 'Разобранный скелет. Если собрать заново, он сделает одно из четырёх: 1) нападёт на собравшего; '
       + '2) будет служить собравшему до уничтожения; 3) отведёт его к случайному кладу; '
       + '4) отведёт к своему хозяину — могучему Магу, способному воскрешать мёртвых.',
    en_mech: 'A deconstructed skeleton which, if reassembled, can do one of four things: 1. Attack the builder. 2. Serve the builder until destroyed. '
       + '3. Lead the builder to a randomly determined treasure. 4. Lead the builder to its master — a high level Magic-User capable of animating the dead.',
    trap: true, sub: { die: '1d4' },
    outcomes: [
      { ru: 'Нападёт на собравшего', en: 'Attack the builder' },
      { ru: 'Будет служить собравшему до уничтожения', en: 'Serve the builder until destroyed' },
      { ru: 'Отведёт собравшего к случайному кладу', en: 'Lead the builder to a randomly determined treasure' },
      { ru: 'Отведёт к своему хозяину — могучему Магу', en: 'Lead the builder to its master — a high level Magic-User' }
    ]
  },
  SlidingPanel: {
    ru: 'Сдвижная панель',
    en: 'Sliding Panel',
    ref: null,
    sub: { chance: { n: 6, ok: 1 } },
    mech: 'Когда кто-то проходит под панелью, она внезапно съезжает вниз, отрезая отход. Партия может попытаться открыть её '
       + 'один раз: 1-из-6, что панель уедет обратно. Панель может быть металлической, каменной или деревянной. '
       + 'Металлическую не обойти без нескольких часов работы.',
    en_mech: 'When one of the adventurers passes underneath, a panel slides down into place, blocking retreat. The party may make one attempt to open it, '
       + 'with a 1-in-6 chance it slides back up. The panel can be metal, stone, or wood. If metal, it cannot be circumvented without several hours of work.',
    trap: true, sub: { chance: { n: 6, ok: 1 } }
  },
  ManEatingSeaWeed: {
    ru: 'Пожирающий моревод',
    en: 'Man Eating Sea Weed',
    ref: null, htk: 150, creature: true,
    mech: 'Целый коридор, пещера или камера заполнена (или начинает заполняться) огромной массой пожирающего моревода — 150 HTK. '
       + 'Иногда существо лежит на дне жёлоба, ямы или лифта. Иногда приключенец открывает шиберную заслонку и едкая масса '
       + 'наливается вниз.',
    en_mech: 'An entire corridor, cavern, or chamber is filled (or starts filling) with an enormous quantity of Man Eating Sea Weed (150 HTK). '
       + 'Sometimes the monster is at the bottom of a chute, pit, or elevator. Other times an adventurer triggers a sluice gate and the corrosive '
       + 'substance pours into the area.',
    trap: false, creature: true, htk: 150
  },
  UnderworldSea: {
    ru: 'Подземное море',
    en: 'Underworld Sea',
    ref: null,
    mech: 'Приключенцы находят вход в огромное подземное море. Без способа построить плот дальше не пройти. Мастер может '
       + 'предоставить причал и корабль, если такая фантастическая вылазка по нраву. А может, это всего лишь иллюзия?',
    en_mech: 'The adventurers discover an entryway to a massive underworld sea. Unless they can construct a raft, there is no way to explore further. '
       + 'The Referee might provide a pier and ship. Or perhaps it is just an illusion?',
    trap: false, terrain: true
  }
};

/* порядок для 1d14 и для показа мастеру */
const TRAP_ORDER = [
  'AcidBath', 'Cage', 'Chute', 'ElevatorRoom', 'ManEatingSeaWeed', 'MagicalPortal',
  'PileOfBones', 'Pit', 'PitStaked', 'PitFire', 'Slide', 'SlidingPanel', 'TrapDoor', 'UnderworldSea'
];

/* =============================================================================
 * ОСОБЫЕ КОМНАТЫ — Special Rooms, Booklet 2
 *
 * ВНИМАНИЕ: присланный фрагмент ОБОРВАН на середине описания Movie Theater.
 * Известны только эти две комнаты. Список расширяемый — при получении полного
 * текста дописывается сюда.
 * ============================================================================= */
const SPECIAL_ROOMS = [
  { key: 'Casino', ru: 'Казино', en: 'Casino',
    body: 'Игроков телепортирует в зал в стиле Лас-Вегаса, где им предлагают сыграть в азартную игру с Мудрецом: '
        + 'настольную, карточную или кости. В ходу пригодятся обычные заряженные кости, а также магические '
        + 'Undetectable Stacked Deck и Undetectable Loaded Dice. Мудрец назначает шансы, ставки и выигрыши, какие захочет. '
        + 'Проигравшие платят золотом, HTK или вовсе ничем. Например, Мудрец может предложить сыграть в «Yahtzee» и выдать '
        + 'победителю 25 очков опыта без всякого штрафа за проигрыш.',
    en_body: 'Players are teleported to a Las Vegas style room where they play games of chance against a Sage: a board game, card game, or dice game. '
        + 'Mundane loaded dice, as well as the magical Undetectable Stacked Deck and Undetectable Loaded Dice, are of use. '
        + 'The Sage might offer any odds, stakes, and winnings the Referee desires. Losers might sacrifice gold, HTK, nothing at all, etc. '
        + 'For example, the Sage might offer to play Yahtzee and grant the winner 25 experience points with no penalty for losing.',
    sub: { chance: { n: 2, ok: 1 } },
    busted: {
      ru: 'Если «разорился» — Мудрец отвечает на один вопрос по своей специальности: живые существа, сверхъестественное '
        + 'или физический мир (алхимия, астрология, физика). Очень трудные вопросы недоступны — Мудрец в отпуске и не может '
        + 'пользоваться библиотекой.\n'
        + 'Нанять Мудреца можно за 20d10 gp в год либо за 500 gp за один очень трудный вопрос. При найме по годовой ставке '
        + 'и увольнении без уважительной причины нанявший больше никогда не наймёт другого Мудреца.',
      en_body: 'If "busted," a Sage may answer a question concerning his area of specialization: living things, the supernatural, or the physical world '
        + '(Alchemy, Astrology, Physics, etc.). Very difficult questions cannot be attempted since the Sage is vacationing and cannot consult his library. '
        + 'A "busted" Sage can be hired for either 20d10 gp per year, or to answer a single very difficult question for a flat 500 gp. '
        + 'If hired at the annual rate and dismissed without just reason, the hiring character may never hire another Sage.',
      sub: { die: '20d10' }, flat: 500
    },
    curse: {
      ru: 'Кто атакует Мудреца — автоматически становится Хаотичным, если только сам Мудрец не был Хаотичным (1-из-3). '
        + 'Умирая, Мудрец накладывает проклятие: 1-из-4 — разрушительное (например, убийца больше никогда не сможет сделать спасброск), '
        + 'иначе — малое (например, у убийцы выпадают все волосы). Снять проклятие можно только выполнив религиозный квест '
        + 'Клирику или Патриарху.',
      en_body: 'Anyone who attacks a Sage is automatically changed to Chaotic alignment unless the Sage himself was Chaotic (1-in-3). '
        + 'When a Sage is about to die, he casts a curse on the one who reduced him to zero HTK. There is a 1-in-4 chance the curse is devastating '
        + '(e.g. preventing the cursed slayer from ever making a saving throw); otherwise it is lesser (e.g. all of the murderer\'s hair falls out). '
        + 'The only means to remove such a curse is to complete a religious Quest for a Cleric or Patriarch.',
      sub: { chance: { n: 4, ok: 1 } }, sageChaotic: { n: 3, ok: 1 }
    } },

  { key: 'MovieTheater', ru: 'Кинотеатр', en: 'Movie Theater', truncated: true,
    body: 'Как и казино — даёт участникам временный побег в «реальный мир». Скорее всего, этим пользовались для перерыва, '
        + 'чтобы посмотреть телевизор, особенно если шёл фильм про меч и сандалии или хоррор.',
    en_body: 'Just as with the Casino, this room provides a temporary escape to the "real world". Most likely it was used as a break to watch television, '
        + 'especially if a sword and sandal movie or horror flick was programmed.',
    note: 'Описание оборвано в присланном фрагменте Booklet 2.' }
];

if (typeof module !== 'undefined') {
  module.exports = { TRAPS, TRAP_ORDER, SPECIAL_ROOMS };
}
