/* =============================================================================
 * ПОТОК ТАБЛИЦ БУКЛЕТА 4 — OD&D BOOKLET 4: RANDOM DUNGEON GENERATION
 *
 * Инструмент НЕ строит план подземелья. Мастер рисует карту сам, программа
 * отвечает только за одно: правильно бросать кости и переводить результат на
 * язык правил. Всё, чего нельзя увидеть на карте, — длина секции, расстояние
 * лестницы, содержимое комнаты — приходит сюда как текст.
 *
 * Механика повторяет Dungeon_Gen_DB: кнопка на каждый стол, мастер сам решает,
 * что бросать следующим. Автоперехода нет, но подсказка «далее вероятно»
 * вычисляется из состояния партии и повторяет порядок буклета:
 *
 *   1. 4-51 ось входа
 *   2. вход: куда ведёт входная лестница (2-из-6 камера, иначе 2-из-3 комната,
 *      иначе проход) — один бросок
 *   3. исследование по ходу: 4-52 секция (с шансом 1-из-20 на лестницу) →
 *      4-54 → room-find (8-из-10 за 100 футов) → 4-56 комната → выходы →
 *      содержимое
 *
 * ВАЖНО: это отход от буклета. Буклет требует разметить центральную камеру и
 * ВСЕ лестницы до всего остального; здесь они раскрываются по ходу, потому что
 * инструмент рассчитан на соло-игру «вслепую» — игрок не должен видеть будущее.
 *
 * Один вызов roll(id) = одна карточка, сколько бы костей внутри.
 * ========================================================================== */

'use strict';

const { RNG } = require('./rng.js');
const T = require('../data/tables.js');
const { MONSTERS } = require('../data/monsters.js');
const { TREASURE } = require('../data/treasure.js');
const { ODDITIES, CREATURES } = require('../data/oddities.js');
const {
  GROUPS, GROUP_ROMAN, groupForLevel, shiftGroup, NUMBER_APPEARING
} = require('../data/wandering.js');
const {
  VERBS: O_VERBS, NOUNS: O_NOUNS, ADJECTIVES: O_ADJ, ADVERBS: O_ADV,
  ADV_VERB: O_ADVVERB, PREP: O_PREP, PREP_ARTICLE: O_PREPART, SPECIALTY: O_SPEC
} = require('../data/oracles.js');
const { TRAPS, TRAP_ORDER } = require('../data/traps.js');

const SHAPES = {
  square: 'квадрат', rect: 'прямоугольник', diamond: 'ромб', octagon: 'восьмиугольник',
  pentagon: 'пятиугольник', cross: 'крест', L: 'Г-образная', irregular: 'неправильная',
  irregularGeom: 'неправильная (геометрическая)', cavern: 'каверна', round: 'круглая',
  staggered: 'смещённая', radiating: 'радиальная'
};

/* Кнопки. group — раздел сайдбара. next — ЗАПАСНОЙ вариант подсказки;
 * основной считает hintFor() из состояния партии. */
const TABLES = [
  { id: '4-51', group: 'Вход' },
  { id: 'entry', group: 'Вход' },

  { id: '4-52', group: 'Проход' },
  { id: '4-53', group: 'Проход' },
  { id: '4-54', group: 'Проход' },
  { id: 'room-find', group: 'Проход' },
  { id: 'collision', group: 'Проход' },

  { id: '4-55', group: 'Комнаты' },
  { id: '4-56', group: 'Комнаты' },
  { id: '4-57', group: 'Комнаты' },
  { id: 'room-exits', group: 'Комнаты' },
  { id: '4-58', group: 'Комнаты' },
  { id: '4-59', group: 'Комнаты' },

  { id: '4-60', group: 'Лестницы' },
  { id: 'stairway', group: 'Лестницы' },
  { id: 'stair-general', group: 'Лестницы' },
  { id: 'stair-surround', group: 'Лестницы' },

  { id: '4-62', group: 'Содержимое' },
  { id: '4-63', group: 'Содержимое' },

  { id: 'oracle-an', group: 'Оракул' },
  { id: 'oracle-vn', group: 'Оракул' },
  { id: 'oracle-adv', group: 'Оракул' },
  { id: 'oracle-q', group: 'Оракул' },
  { id: 'oracle-prep', group: 'Оракул' },
  { id: 'oracle-color', group: 'Оракул' },
  { id: 'oracle-troops', group: 'Оракул' },
  { id: 'oracle-weapon', group: 'Оракул' },
  { id: 'oracle-armor', group: 'Оракул' },
  { id: 'oracle-spell', group: 'Оракул' },
  { id: 'oracle-artillery', group: 'Оракул' },
  { id: 'oracle-cover', group: 'Оракул' },
  { id: 'oracle-culture', group: 'Оракул' },
  { id: 'oracle-personage', group: 'Оракул' },
  { id: 'oracle-monster', group: 'Оракул' },
  { id: 'wander', group: 'Прочее' },
  { id: 'oddity', group: 'Прочее' },
  { id: 'trap', group: 'Прочее' },
  { id: 'secret', group: 'Прочее' }
];

const RU = {
  '4-51': 'Начальное направление прохода',
  'entry': 'Вход на уровень (куда ведёт лестница)',
  '4-52': 'Длина секции прохода',
  '4-53': 'Экстраординарная длина секции',
  '4-54': 'Поворот или перекрёсток',
  'room-find': 'Проверка: комната за каждые 100 футов',
  'collision': 'Столкновение прохода с другой особенностью',
  '4-55': 'Центральная камера',
  '4-56': 'Прочие комнаты и камеры',
  '4-57': 'Исключительный тип комнаты',
  'room-exits': 'Число выходов комнаты',
  '4-58': 'Направление выхода',
  '4-59': 'Содержимое комнаты или камеры',
  '4-60': 'Число лестниц',
  'stairway': 'Лестница',
  'stair-general': 'Общие параметры лестницы',
  'stair-surround': 'Окружение лестницы',
  '4-62': 'Монстр по уровню',
  'loot': 'Обыскать',
  'light': 'Свет',
  '4-63': 'Сокровище по уровню',
  'oracle': 'Оракул',
  'oracle-an': 'Описание: прилагательное · существительное',
  'oracle-vn': 'Действие: глагол · существительное',
  'oracle-adv': 'Как: наречие · глагол',
  'oracle-q': 'Вопрос (предлог)',
  'oracle-prep': 'Предлог-артикль · существительное',
  'oracle-color': 'Цвет',
  'oracle-troops': 'Войска',
  'oracle-weapon': 'Оружие',
  'oracle-armor': 'Броня',
  'oracle-spell': 'Заклинания',
  'oracle-artillery': 'Артиллерия',
  'oracle-cover': 'Укрытия',
  'oracle-culture': 'Культуры',
  'oracle-personage': 'Персоны',
  'oracle-monster': 'Фантастические монстры',
  'wander': 'Бродячие монстры уровня',
  'oddity': 'Диковинка',
  'trap': 'Ловушка',
  'secret': 'Поиск потайной двери',
  /* короткая метка бейджа: нумерованные столы знаем по номеру, служебные —
   * по-русски. «entry» в русском интерфейсе смотрится как сломавшийся интерфейс */
  SHORT: {
    entry: 'вход',
    'room-find': 'проверка',
    'room-exits': 'выходы',
    collision: 'столкновение',
    stairway: 'лестница',
    'stair-general': 'параметры',
    'stair-surround': 'окружение',
    loot: 'обыск',
    light: 'свет',
    oracle: 'оракул',
    'oracle-an': 'описание',
    'oracle-vn': 'действие',
    'oracle-adv': 'как',
    'oracle-q': 'вопрос',
    'oracle-prep': 'предлог',
    'oracle-color': 'цвет',
    'oracle-troops': 'войска',
    'oracle-weapon': 'оружие',
    'oracle-armor': 'броня',
    'oracle-spell': 'заклинания',
    'oracle-artillery': 'артиллерия',
    'oracle-cover': 'укрытия',
    'oracle-culture': 'культуры',
    'oracle-personage': 'персоны',
    'oracle-monster': 'монстры',
    wander: 'бродячие',
    oddity: 'диковинка',
    trap: 'ловушка',
    secret: 'тайная дверь'
  }
};

function pickRow(rows, total) {
  for (const row of rows) if (total >= row.r[0] && total <= row.r[1]) return row;
  throw new Error('Бросок ' + total + ' не попал ни в один диапазон таблицы');
}

/* Шанс «7-из-10» из объекта таблицы. Порядок аргументов в rng.chance() —
 * (сколько счастливых, из скольких), а в данных он лежит как {n, ok}, то есть
 * НАОБОРОТ. Ошибка молчаливая: chance(10, 7) = int(7) <= 10 → всегда успех,
 * поэтому все шансы в буклете «срабатывали». */
function chanceOf(rng, ch, reason) {
  return rng.chance(ch.ok, ch.n, reason);
}

function rollTable(rng, id, reason) {
  const t = T[id];
  const r = rng.roll(t.die, reason || (t.ru + ' · ' + t.die));
  const row = pickRow(t.rows, r.total);
  return { total: r.total, out: row.out, row };
}

function roomSize(o) {
  return o.w + "'x" + o.h + "' футов" + (o.shape ? ', ' + (SHAPES[o.shape] || o.shape) : '');
}

const ARM_RU = { back: 'низ буквы (назад)', left: 'левое плечо', right: 'правое плечо' };

/* Встроенные в текст кости и шансы.
 *
 * В буклете результат часто сам требует броска: «1d3 x 250 gp», «3d10
 * flasks», «Sleep 2d6 turns», «there is a 5-in-6 chance». Если такой текст
 * показать мастеру как есть, он обязан сам считать — а этого делать не должен
 * никто: количество золота обязано получиться в карточке.
 *
 * Шаблон Dungeon_Gen_DB делал ровно это внутри resolve(): вложенные броски
 * выполнялись сразу, наружу выходила готовая цифра. Здесь тот же приём.
 *
 * Порядок альтернатив в одном регулярном выражении важен: сначала умножение
 * «1d3 x 250», потом шанс «5-из-6», и только потом одиночная кость «1d6».
 * String.replace с /g не пересканирует подставленное, поэтому замены
 * безопасны. */
const INLINE = /(\d*)d(\d+)\s*[×x]\s*(\d+)|(\d*)d(\d+)/g;

/* Похоже ли, что в тексте уже есть кость. Нужно для диковинок, у которых в
 * данных лежит `sub.die`, а в тексте он не написан словами: тогда кость надо
 * бросить явно, но нельзя бросать дважды там, где она уже есть в тексте. */
const HAS_DIE_RE = /\d*d\d+/i;

/* Падежи после подставленного числа: «22 флаконов» -> «22 флакона».
 * Формы хранятся целиком, потому что в русском их три, а слово стоит
 * ПОСЛЕ числа. */
const PLURAL = {
  флакон: ['флакон', 'флакона', 'флаконов'],
  клетк: ['клетка', 'клетки', 'клеток'],
  штук: ['штука', 'штуки', 'штук'],
  ход: ['ход', 'хода', 'ходов'],
  уровен: ['уровень', 'уровня', 'уровней'],
  пункт: ['пункт', 'пункта', 'пунктов'],
  час: ['час', 'часа', 'часов'],
  фут: ['фут', 'фута', 'футов'],
  попыт: ['попытка', 'попытки', 'попыток'],
  самоцвет: ['самоцвет', 'самоцвета', 'самоцветов']
};

/* Глубокий клон карточки журнала. Нужен при восстановлении партии: иначе две
 * Flow, загруженные из одного файла, делили бы вложенные rolls/lines/next. */
function cloneCard(c) {
  return {
    n: c.n, table: c.table, title: c.title, group: c.group, level: c.level,
    rolls: (c.rolls || []).map(r => ({ f: r.f, d: r.d, t: r.t })),
    lines: (c.lines || []).slice(),
    next: (c.next || []).slice(),
    warn: c.warn || null,
    choice: c.choice ? c.choice.map(o => Object.assign({}, o)) : null,
    action: c.action || null,
    chosen: c.chosen || null,
    halt: c.halt || false
  };
}

/* Единый источник состояния партии. Раньше дефолты были продублированы здесь
 * и в restore(), причём вторая копия отстала: загрузка старого сохранения
 * оставляла новые поля = undefined, и логика молча отключалась. Теперь оба
 * места берут одно определение. */
function defaultState() {
  return {
    lastOddity: null, axis: null, feet: 0, sinceRoom: 0,
    /* время: ход = 10 минут; turns = floor(minutes/10) */
    minutes: 0, turns: 0,
    /* свет и запас */
    /* ротация бродячих монстров уровня (3-4) и уровень, для которого она собрана */
    wanderSet: [], wanderLevel: 0,
    /* лестница стоит в комнате? и нужно ли сгенерировать её комнату (4-56) */
    stairRoom: false, stairRoomPending: false,
    light: { kind: 'none', minutesLeft: 0 },
    stock: { torches: 0, oil: 0 },
    entered: false, exitsLeft: 0, roomCavern: false,
    /* площадь текущей комнаты в кв. футах — нужна диковинке #15
     * («в каверне не меньше 720 кв. футов, иначе переброс») */
    roomSqFt: 0,
    /* комната уже наполнена? без этого 4-59 можно бросить дважды и получить
     * «сокровище» и «пусто» из одной комнаты */
    roomStocked: false,
    /* диковинки, уже выпадавшие за партию: нужно правилу once (#24, светящаяся
     * лестница — одна на подземелье) */
    odditiesSeen: [],
    /* монстр получил сокровище: после 4-62 надо отыграть 4-63, а уже потом
     * возвращаться в проход. next[0] без флага уводил дальше, теряя сокровище. */
    monsterLoot: null,
    /* направление найденной лестницы: 'down' | 'up' | 'both' — для развилки
     * «спуститься / идти дальше» */
    stairKind: 'down',
    /* вход ведёт в комнату/камеру: после её содержимого идём в проход (4-52),
     * а не назад в 4-54. Флаг снимается, когда содержимое отыграно. */
    entryRoom: false,
    entryRoomDone: true
  };
}

/* Переходы «далее вероятно» фазы исследования: id -> массив или функция
 * (state, out) -> массив. Условные переходы (нашлась комната, остались выходы,
 * остались лестницы) — функции, прямые — массивы. */
/* Переходы «далее вероятно»: id -> массив или функция (state, out) -> массив.
 * После наполнения комнаты возвращаемся в проход; для входной комнаты/камеры —
 * в первый проход (4-52), иначе в 4-54. */
function roomFollowUp(s) {
  if (s.entryRoom && !s.entryRoomDone) { s.entryRoomDone = true; return ['4-52']; }
  return ['4-54'];
}

const NEXT = {
  '4-51': ['entry'],
  'entry': ['4-52'],                 /* запасной: t_entry ставит next явно */
  '4-52': s => s.sinceRoom >= 100 ? ['room-find', '4-54'] : ['4-54'],
  '4-53': s => s.sinceRoom >= 100 ? ['room-find', '4-54'] : ['4-54'],
  'room-find': (s, out) => out.found ? ['4-56'] : ['4-54'],
  collision: ['4-52'],
  '4-54': ['4-52'],
  '4-55': s => s.exitsLeft > 0 ? ['4-58'] : ['4-59'],
  '4-56': ['room-exits'],
  '4-57': ['room-exits'],
  'room-exits': s => s.exitsLeft > 0 ? ['4-58'] : ['4-59'],
  '4-58': s => s.exitsLeft > 0 ? ['4-58', '4-59'] : ['4-59'],
  stairway: ['4-54'],
  '4-60': ['stairway'],
  'stair-general': ['stair-surround'],
  'stair-surround': ['4-52'],
  '4-62': s => roomFollowUp(s),
  loot: s => roomFollowUp(s),
  '4-63': s => roomFollowUp(s),
  trap: s => roomFollowUp(s)
};

/* Разрешает запись перехода: массив возвращается копией, функция — вызовом.
 * Так в таблицах можно держать и прямые списки, и условные переходы. */
function nextOf(entry, s, out) {
  if (!entry) return null;
  return typeof entry === 'function' ? entry(s, out || {}) : entry.slice();
}

/* По какому элементу какой оракул спрашивать. Комната/камера — описание и
 * действие; проходы/выходы/монстр/сокровище — описание; диковинка/ловушка —
 * действие. Выдаётся по требованию (кнопка на карточке). */
const ORACLE_PRESET = {
  '4-55': ['oracle-an', 'oracle-vn'],
  '4-56': ['oracle-an', 'oracle-vn'],
  '4-57': ['oracle-an', 'oracle-vn'],
  '4-52': ['oracle-an'],
  '4-53': ['oracle-an'],
  '4-54': ['oracle-an'],
  '4-58': ['oracle-an'],
  collision: ['oracle-an'],
  '4-62': ['oracle-an'],
  '4-63': ['oracle-an'],
  oddity: ['oracle-vn'],
  trap: ['oracle-vn']
};
function oracleFor(table) { return ORACLE_PRESET[table] || null; }

class Flow {
  constructor(opts = {}) {
    this.setLevel(opts.level || 1);
    this.rng = new RNG({ seed: opts.seed });
    this.cards = [];
    this.state = defaultState();
    if (opts.cards) this.restore(opts);
  }

  setLevel(level) {
    const n = Math.max(1, Math.min(12, parseInt(level, 10) || 1));
    this.level = n;
    return n;
  }

  /* --- карточка ----------------------------------------------------------
   * Единственное место, где рождается карточка: запоминает позицию в журнале
   * костей, запускает бросок и собирает срез — так в карточку попадают ВСЕ
   * кости вызова, даже вложенные (4-53 внутри 4-52). */
  _card(id, produce) {
    const mark = this.rng.log.length;
    const meta = TABLES.find(t => t.id === id) || {};
    this.rng.phase = meta.group || '';
    const out = produce() || {};
    const rolls = this.rng.log.slice(mark).map(r => ({ f: r.formula, d: r.detail, t: r.total }));
    const card = {
      n: this.cards.length + 1,
      table: id,
      title: RU[id] || id,
      group: this.rng.phase,
      level: this.level,
      rolls,
      lines: out.lines || [],
      /* Пока мастер не выбрал, следующий шаг неизвестен: подсказка «далее
       * вероятно» на карточке-решении предлагала проскочить мимо решения и
       * добавляла в журнал лишние карточки (клик по «вход» порождал ещё один
       * «вход»). После выбора next уже известен — его ставит resolve(). */
      next: out.choice ? (out.next || []) : (out.next || this.hintFor(id, out)),
      warn: out.warn || null,
      choice: out.choice || null,
      action: out.choice ? (out.action || 'bend') : null,
      /* выбор мастера появляется после resolve(); поле объявлено сразу, чтобы
       * карточка до и после решения имела одинаковый набор ключей — иначе
       * сравнение restore-копии с оригиналом ломается на порядке/наборе полей */
      chosen: null,
      /* событие, на котором автоцепочка обязана встать (монстр/встреча) */
      halt: !!out.halt
    };
    this.cards.push(card);
    return card;
  }

  /* Что делать, когда комната наполнена. Для входной комнаты/камеры — в первый
   * проход (4-52), иначе возврат в проход 4-54. */
  afterRoom() {
    return roomFollowUp(this.state);
  }

  /* Подсказка «далее вероятно». Порядок задаёт NEXT; фазы-очереди больше нет —
   * уровень раскрывается по ходу. */
  hintFor(id, out) {
    return nextOf(NEXT[id], this.state, out) || [];
  }

  /* Прогоняет строку через резолвер встроенных костей: «1d3 x 250 gp» ->
   * «750 gp», «3d10 flasks» -> «17 флаконов», «5-из-6» -> «успех». Каждый
   * бросок попадает в журнал RNG, то есть виден в карточке как кость. */
resolveText(text) {
    const out = String(text).replace(INLINE, (m, dN, dS, mul, sN, sS) => {
      const count = (dS !== undefined ? dN : sN) || '1';
      const size = dS !== undefined ? dS : sS;
      const r = this.rng.roll(count + 'd' + size, 'Вложенный бросок: ' + m.trim());
      return mul !== undefined ? String(r.total * +mul) : String(r.total);
    });
    return this.pluralize(out);
  }

  /* Падежи ставим по всему тексту сразу: резолвер костей выше возвращает
   * только число, а форму приписывает pluralize. */
  pluralize(text) {
    return String(text).replace(/(\d+)\s([а-я]+)/g, (m, num, word) => {
      const key = Object.keys(PLURAL).find(k => word.indexOf(k) === 0);
      if (!key) return m;
      const n = +num;
      const f = PLURAL[key];
      const i = (n % 100 >= 11 && n % 100 <= 14) ? 2 : (n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2);
      return n + ' ' + f[i];
    });
  }

  /* Бросок структурированного шанса {n, ok} с человекочитаемой строкой-исходом.
   * Комплементарные шансы («приоткрыта 3-из-4; закрыта 1-из-4») — это ОДИН
   * бросок с двумя исходами. Раньше regex по прозе бросал их независимо и мог
   * выдать «выпал» сразу у обоих. */
  _rollChance(ch, what) {
    const c = chanceOf(this.rng, ch, what + ' (' + ch.ok + '-из-' + ch.n + ')');
    return {
      ok: c.ok,
      line: what + ': ' + (c.ok ? 'выпал' : 'не выпал') + ' (бросок ' + c.total + ').'
    };
  }

  /* Разворачивает одну диковинку в строки карточки. Структурные шансы и кости
   * берутся из данных (item.chance / item.sub), текст — как fallback. */
  _resolveOddity(item) {
    const lines = [];
    /* подтаблица (#35 разлив, #36 газ): 1d5/1d8 -> вариант */
    if (item.sub && item.sub.table) {
      const tbl = item.tables[item.sub.table];
      const r = this.rng.roll(item.sub.die, item.ru.split('.')[0] + ' · ' + item.sub.die);
      const row = pickRow(tbl.rows, r.total);
      if (row.out === null) {
        /* 1d8 в буклете, а непустых типов газа только семь — восьмой выходит
         * за пределы стола, это дефект первоисточника, а не наш просчёт */
        return [tbl.ru + ', вариант ' + r.total + ' — пусто: в буклете только ' +
          tbl.rows.filter(x => x.out !== null).length + ' непустых вариантов из ' +
          tbl.rows.length + '.'];
      }
      const det = (tbl.detail && tbl.detail[row.out]) || null;
      lines.push(tbl.ru + ', вариант ' + r.total + ':');
      if (det) lines.push(...this._resolveDetail(det));
      else lines.push(String(row.out));
      return lines;
    }
    /* шанс, управляющий веткой (#21 колодец: 5-из-6 вниз / 1-из-6 бездна).
     * Кость ветки бросается ТОЛЬКО при выпавшем шансе. */
    if (item.chance) {
      const c = this._rollChance(item.chance, 'Шанс ' + item.chance.ok + '-из-' + item.chance.n);
      lines.push(c.line);
      if (!c.ok) { lines.push('Выпала вторая ветка — подробности в тексте диковинки.'); return lines; }
    }
    /* одиночный шанс без ветки-кости (#12 дверь, #13 водоём, #31 статуэтка,
     * #34 ветер): один бросок, исход строкой, проза как есть */
    if (item.sub && item.sub.chance) {
      const c = this._rollChance(item.sub.chance, 'Шанс ' + item.sub.chance.ok + '-из-' + item.sub.chance.n);
      lines.push(c.line);
      lines.push(this.resolveText(item.ru));
      return lines;
    }
    lines.push(this.resolveText(item.ru));
    /* объявленная кость, которой нет в тексте (напр. 1d8 типа призрака) */
    if (item.sub && item.sub.die && !HAS_DIE_RE.test(item.ru)) {
      const r = this.rng.roll(item.sub.die, item.ru.split('.')[0] + ' · ' + item.sub.die);
      lines.push('Бросок ' + item.sub.die + ': ' + r.total + '.');
    }
    return lines;
  }

  /* Разворачивает выбранный вариант подтаблицы. У варианта может быть свой
   * условный шанс (пар, жила): кость его ветки не бросается при провале. */
  _resolveDetail(det) {
    const lines = [];
    if (det.sub && det.sub.chance) {
      const c = this._rollChance(det.sub.chance, 'Шанс ' + det.sub.chance.ok + '-из-' + det.sub.chance.n);
      lines.push(c.line);
      if (!c.ok) { lines.push('Эффект варианта не срабатывает.'); return lines; }
    }
    lines.push(this.resolveText(det.ru));
    if (det.sub && det.sub.die && !HAS_DIE_RE.test(det.ru)) {
      const r = this.rng.roll(det.sub.die, 'Эффект: ' + det.sub.die);
      lines.push('Бросок ' + det.sub.die + ': ' + r.total + '.');
    }
    return lines;
  }

  roll(id, opts) {
    const fn = this['t_' + id.replace(/-/g, '_')];
    if (!fn) throw new Error('Нет такой таблицы: ' + id);
    return this._card(id, () => fn.call(this, opts || {}));
  }

  /* Решение мастера: подтип изгиба или форма перекрёстка. Вход — бросок, не выбор. */
  /* key — выбранный вариант; card — карточка, чья кнопка нажата. Без card
   * (старый вызов) берётся последняя. Раньше всегда брали последнюю, и если
   * после карточки-решения появлялась ещё одна (например, оракульная),
   * нажатие на старое решение падало с «последняя карточка без выбора». */
  resolve(key, card) {
    const target = card || this.cards[this.cards.length - 1];
    const action = target && target.action;
    if (!target || !target.choice) throw new Error('Нечего решать: карточка без выбора');
    /* Решение мастера дописывается В ТУ ЖЕ карточку. */
    /* Запрещённый вариант (disabled) отклоняем ДО обработчика, чтобы не
     * испортить состояние. */
    const opt = target.choice.find(o => o.key === key) || {};
    if (opt.disabled) {
      throw new Error(opt.label.replace(/\s\(.*\)/, '') + ' — такого варианта на уровне нет');
    }
    const mark = this.rng.log.length;
    const out = (action === 'cross' ? this._crossChoice(key)
      : action === 'stairway' ? this._stairwayChoice(key)
        : this._bendChoice(key)) || {};
    target.rolls = target.rolls.concat(this.rng.log.slice(mark)
      .map(r => ({ f: r.formula, d: r.detail, t: r.total })));
    /* У лестницы описание (вид, окружение) важнее исхода выбора — дописываем,
     * а не заменяем. Для изгиба/перекрёстка строка-заглушка заменяется. */
    target.lines = action === 'stairway'
      ? target.lines.concat(out.lines || [])
      : (out.lines || target.lines);
    target.warn = out.warn || target.warn;
    target.chosen = opt.label || String(key);
    target.choice = null;
    target.action = null;
    target.next = out.next || this.hintFor(target.table, out);
    return target;
  }

  /* --- Вход -------------------------------------------------------------- */
  t_4_51() {
    const a = rollTable(this.rng, '4-51');
    this.state.axis = a.out;
    return { lines: ['Ось подземелья: ' + T['4-51'].dirs[a.out].ru] };
  }

  /* Вход: куда ведёт входная лестница. Буклет: «If the chosen stairway leads to
   * the central chamber... If it does not, there is a 2-in-3 chance that the
   * stairway enters a room, otherwise it ends in a passageway». Шанс «в камеру»
   * в буклете не задан (зависел от предразметки) — принято 2-из-6. */
  t_entry() {
    const s = this.state;
    s.entered = true;
    const central = chanceOf(this.rng, { n: 6, ok: 2 }, 'Вход ведёт в центральную камеру? (2-из-6)');
    if (central.ok) {
      s.entryRoom = true; s.entryRoomDone = false;
      return { lines: ['Входная лестница ведёт в центральную камеру.'], next: ['4-55'] };
    }
    const room = chanceOf(this.rng, { n: 3, ok: 2 }, 'Вход в комнату (2-из-3) или в проход?');
    if (room.ok) {
      s.entryRoom = true; s.entryRoomDone = false;
      return { lines: ['Входная лестница ведёт в комнату.'], next: ['4-56'] };
    }
    s.entryRoom = false; s.entryRoomDone = true;
    return { lines: ['Входная лестница кончается проходом — начинаем исследование.'], next: ['4-52'] };
  }

  /* --- Проход ----------------------------------------------------------- */
  t_4_52() {
    const a = rollTable(this.rng, '4-52');
    let len = a.out;
    const extra = a.out === 'extra';
    if (extra) len = rollTable(this.rng, '4-53').out;
    const s = this.state;
    s.feet += len;
    s.sinceRoom += len;
    const lines = ['Длина секции: ' + len + ' футов' + (extra ? ' (экстраординарная, 20 + 4-53)' : '')];
    lines.push('Всего пройдено: ' + s.feet + ' футов, с последней проверки — ' + s.sinceRoom + '.');
    if (s.sinceRoom >= 100) {
      lines.push('Прошло ' + s.sinceRoom + ' футов: пора на проверку комнаты (8-из-10 за каждые 100).');
    }
    const tt = this._spendTime(len * T.dungeon.minutesPerTurn / T.dungeon.feetPerTurn);
    lines.push(...tt.lines);
    /* Лестницы не размечаются заранее (отход от буклета): секция может упереться
     * в лестницу на другой уровень — как «один из исходов» в эталоне DB. */
    const stair = chanceOf(this.rng, { n: 20, ok: 1 }, 'В секции — лестница на другой уровень? (1-из-20)');
    if (stair.ok) {
      lines.push('В этой секции — лестница на другой уровень.');
      return { lines, next: ['stairway'], halt: tt.enc };
    }
    return { lines, halt: tt.enc };
  }

  t_4_53() {
    const a = rollTable(this.rng, '4-53');
    return { lines: ['Экстраординарная длина секции: ' + a.out + ' футов'] };
  }

  /* 4-54: три разных предмета решения мастера, поэтому три вида выбора. */
  t_4_54() {
    const a = rollTable(this.rng, '4-54');
    const k = T['4-54'].kinds[a.out];
    if (k.kind === 'bend') {
      return {
        lines: ['Изгиб прохода. Подтип выбирает мастер.'],
        choice: [
          { key: 'turn90', label: 'Поворот 90° (поровну влево/вправо)' },
          { key: 'diagonal', label: 'Диагональный поворот (1d6)' }
        ],
        action: 'bend'
      };
    }
    const lines = ['Перекрёсток: ' + k.ru + (k.arms ? ' (' + k.arms + ' луча)' : '')];
    if (a.out === 'rad56') {
      const five = chanceOf(this.rng, T['4-54'].kinds.rad56.chance, '5 лучей или 6?');
      lines.push('Лучей: ' + (five.ok ? 5 : 6));
    }
    if (a.out === 't3' || a.out === 'y3') {
      /* «1d6: 1-2 bottom; 3-4 left; 5-6 right — какое плечо буквы держит
       * конец текущей секции» */
      const r = this.rng.roll(T['4-54'].armRoll.die, 'Какое плечо буквы продолжает секцию? · 1d6');
      lines.push('Конец секции идёт по плечу: ' + ARM_RU[pickRow(T['4-54'].armRoll.rows, r.total).out]);
    }
    if (a.out === 'x4') {
      return {
        lines: lines.concat(['Форма перекрёстка зависит от направления движения — решает мастер.']),
        choice: [
          { key: 'cross', label: 'Перекрёсток (+)' },
          { key: 'x', label: 'Перекрёсток (Х)' }
        ],
        action: 'cross'
      };
    }
    if (a.out === 'stag4') lines.push('Смещённый: одно или несколько других лучей не дальше 10 футов.');
    const jr = chanceOf(this.rng, T['4-54'].junctionRoomChance, 'Перекрёсток — на деле треугольная комната?');
    lines.push(jr.ok
      ? "На деле треугольная комната 20'x20' с выходами на всех сторонах"
      : 'Обычный перекрёсток');
    return { lines };
  }

  _bendChoice(key) {
    const k = T['4-54'].kinds.bend90;
    if (key === 'diagonal') {
      const r = this.rng.roll(k.diag.die, 'Диагональный поворот (4-54) · 1d6');
      const deg = pickRow(k.diag.rows, r.total).out;
      const dir = deg === -45 ? 'налево 45°' : deg === 45 ? 'направо 45°'
        : deg === -135 ? 'позади слева 135°' : 'позади справа 135°';
      return { lines: ['Диагональный поворот: ' + dir] };
    }
    const r = this.rng.roll('1d2', 'Поворот 90°: 1 — влево, 2 — вправо');
    return { lines: ['Поворот на 90°: ' + (r.total === 1 ? 'влево' : 'вправо')] };
  }

  _crossChoice(key) {
    const note = key === 'cross'
      ? 'Перекрёсток (+): лучи под 90° друг к другу.'
      : 'Перекрёсток (Х): лучи под 45° друг к другу.';
    const jr = chanceOf(this.rng, T['4-54'].junctionRoomChance, 'Перекрёсток — на деле треугольная комната?');
    return {
      lines: [note, jr.ok ? "На деле треугольная комната 20'x20' с выходами на всех сторонах" : 'Обычный перекрёсток']
    };
  }

  /* «For every 100 feet of passageway travelled, there is a 8-in-10 chance
   * that a room or chamber has been found.» Ролей столько, на сколько полных
   * сотен футов набежало с прошлой проверки. */
  t_room_find() {
    const s = this.state;
    const blocks = Math.floor(s.sinceRoom / 100);
    const feet = s.sinceRoom;
    /* «For every 100 feet of passageway travelled» — проверка за каждый полный
     * сотенный блок. Остаток надо сохранить: 130 футов = одна проверка и ещё
     * 30 футов в счёт следующей. Раньше here обнулялось и 30 футов терялись,
     * из-за чего уровок систематически недобирал комнат. */
    s.sinceRoom = feet % 100;
    if (blocks < 1) {
      return { lines: ['Проверять рано: с прошлой проверки прошло ' + feet + ' футов, нужно 100.'] };
    }
    const lines = ['Пройдено ' + feet + ' футов — проверок: ' + blocks + '.'];
    let found = false;
    for (let i = 0; i < blocks; i++) {
      if (chanceOf(this.rng, T.dungeon.roomChancePer100ft, 'Комната или камера? (8-из-10)').ok) found = true;
    }
    if (!found) {
      lines.push('Комната не найдена.');
      return { lines, found: false };
    }
    lines.push('Комната или камера найдена: она либо в конце секции, либо сбоку от прохода.');
    lines.push('Если сбоку — сначала разыграйте комнату с выходами (4-56), затем определите сторону.');
    return { lines, found: true };
  }

  /* «A passageway that "collides" with another feature can either be
   * transformed into a dead end, or a secret door (even chances).» */
  t_collision() {
    const r = this.rng.roll('1d2', 'Столкновение: 1 — тупик, 2 — потайная дверь');
    return {
      lines: [r.total === 1
        ? 'Проход превращается в тупик.'
        : 'Стена за потайной дверью (секретный проход всегда 5 футов шириной).']
    };
  }

  /* --- Комнаты ---------------------------------------------------------- */
  /* Центральная камера разыгрывается ТОЛЬКО когда вход в неё ведёт. Строки
   * 8-10 (N/A) в этом случае перебрасываются: камера уже есть по факту. */
  t_4_55() {
    let a, tries = 0;
    do { a = rollTable(this.rng, '4-55'); tries++; } while (!a.out && tries < 30);
    if (!a.out) return { lines: ['Не удалось получить тип камеры — перебросьте 4-55.'] };
    /* «begin by numbering and locating the OTHER exits»: вход уже есть. */
    this.state.roomStocked = false;
    this.state.exitsLeft = a.out.exits - 1;
    this.state.roomCavern = !!a.out.cavern;
    this.state.roomSqFt = a.out.w * a.out.h;
    const lines = ['Центральная камера: ' + roomSize(a.out),
      'Выходов: ' + a.out.exits + ' (включая вход — нумеруем остальные)'];
    if (a.out.cavern) lines.push('Пещерного типа — 4-59 для неё бросается по правилам каверны.');
    if (tries > 1) lines.push('Пустые строки 8–10 переброшены: вход ведёт в камеру, значит она есть.');
    return { lines };
  }

  t_4_56() {
    /* началась новая комната: счётчик «уже наполнена» и скрытая добыча
     * предыдущей сбрасываются */
    this.state.roomStocked = false;
    this.state.monsterLoot = null;
    /* Комната лестницы — не более 30' (буклет: «keep rolling ... until this
     * result is obtained»); исключительные типы сюда не берём. */
    const maxSize = this.state.stairRoomPending ? 30 : 0;
    let a, tries = 0;
    do {
      a = rollTable(this.rng, '4-56');
      tries++;
    } while (maxSize && tries < 40 &&
             (a.out.exceptional || !a.out.w || Math.max(a.out.w, a.out.h) > maxSize ||
              /* у строки 8 вариант 40'x15' — он тоже не годится */
              (a.out.alt && Math.max(a.out.alt.w, a.out.alt.h) > maxSize)));
    if (maxSize) this.state.stairRoomPending = false;
    if (a.out.exceptional) {
      this.state.roomCavern = false;   /* исключительный тип бросится в 4-57 */
      this.state.roomSqFt = 0;
      return { lines: ['Исключительная комната — тип бросается в 4-57.'] };
    }
    let o = a.out;
    const lines = [];
    if (o.alt) {
      const p = this.rng.roll('1d2', "Поровну 30'x15' или 40'x15'");
      o = p.total === 1 ? o : o.alt;
      lines.push('Вариант с броском: ' + (p.total === 1 ? 'первый' : 'второй'));
    }
    /* Каверна определяется самим типом комнаты (4-56, результат 11), а не
     * галочкой мастера: от этого зависят правила содержимого в 4-59. Флаг
     * выставляется на КАЖДОЙ комнате, поэтому он и сбрасывается сам —
     * пещерная центральная камера больше не «отравляет» обычные комнаты. */
    this.state.roomCavern = o.shape === 'cavern';
    this.state.roomSqFt = o.w * o.h;
    lines.unshift('Комната: ' + roomSize(o));
    if (o.note === 'closedDoor') lines.push("По правилу буклета комната 15'x15' всегда с закрытой дверью.");
    return { lines };
  }

  t_4_57() {
    const a = rollTable(this.rng, '4-57');
    /* исключительные формы (октагон, пентагон, крест, ромб, L) — каверной
     * не являются */
    this.state.roomCavern = false;
    this.state.roomSqFt = a.out.w * a.out.h;
    const lines = ['Исключительная комната: ' + roomSize(a.out)];
    if (a.out.round) lines.push('Круглая в плане.');
    return { lines };
  }

  t_room_exits() {
    const a = rollTable(this.rng, 'room-exits');
    this.state.exitsLeft = Math.max(0, a.out - 1);
    const lines = ['Выходов из комнаты: ' + a.out +
      (a.out === 1
        ? ' — единственный, обратно: комната тупик, её можно обыскать на потайную дверь.'
        : ' (включая вход) — новых выходов к нумерации: ' + this.state.exitsLeft)];
    if (a.out > 1) lines.push('Бросьте 4-58 по одному разу на каждый новый выход, затем 4-59.');
    return { lines };
  }

  t_4_58() {
    /* нумеровать выходы сверх нужного бессмысленно: в логе пользователя комната
     * с одним новым выходом получила два «Направления выхода», потому что
     * лишний бросок проходил молча. */
    const over = this.state.exitsLeft <= 0;
    const a = rollTable(this.rng, '4-58');
    let dir = a.out;
    if (dir && dir.pick) dir = this.rng.pick(dir.pick, 'Выбор стороны из пары').value;
    if (this.state.exitsLeft > 0) this.state.exitsLeft--;
    const lines = [
      'Выход: ' + T['4-58'].dirs[dir].ru,
      'Дубли перебрасываются; выход — по возможности в середину стены.',
      'Если пространство сразу за этим направлением уже занято — считайте выход потайной дверью.'
    ];
    lines.push(this.state.exitsLeft > 0
      ? 'Осталось пронумеровать выходов: ' + this.state.exitsLeft + '.'
      : 'Все выходы пронумерованы — можно наполнять комнату через 4-59.');
    if (over) {
      lines.push('ВНИМАНИЕ: выходы этой комнаты уже все пронумерованы, это лишний бросок.');
      return {
        lines,
        warn: '4-58 брошен сверх нужного: комната уже получила все выходы. ' +
              'Если вы нумеруете выходы новой комнаты, сначала бросьте 4-56 и room-exits.'
      };
    }
    return { lines };
  }

  /* 4-59 (Booklet 4): содержимое комнаты. Обычная комната — 1d100:
   * 1-39 пусто, 40-86 монстр, 87-100 «только сокровище». Нерегулярная каверна
   * идёт по своему правилу: 1-из-6 монстр, иначе пусто; у монстра 5-из-6
   * сокровище. Монстр берётся из Stocking Monsters (Группа по уровню, сложность
   * 3-31, Number Appearing). Соло: неподвижный (keyed) монстр обычной комнаты
   * всегда с сокровищем — скрыто (Обыскать). */
  t_4_59() {
    const s = this.state;
    if (s.roomStocked) {
      return {
        lines: ['Эта комната уже наполнена — второй раз 4-59 не бросается.'],
        warn: 'повторный бросок 4-59: комната наполняется один раз. ' +
              'Если вы наполняете новую комнату, сначала бросьте 4-56 и room-exits.',
        next: ['4-54']
      };
    }
    s.roomStocked = true;
    const level = this.level;

    /* Нерегулярная каверна: 1-из-6 монстр, иначе пусто; монстр 5-из-6 с добычей. */
    if (s.roomCavern) {
      const occ = chanceOf(this.rng, T['4-59'].cavern.monsterChance, 'Каверна: монстр? (1-из-6)');
      if (!occ.ok) {
        s.monsterLoot = null;
        return { lines: ['Каверна выглядит пустой.'], next: this.afterRoom() };
      }
      const loot = chanceOf(this.rng, T['4-59'].cavern.treasureChance, 'У монстра есть сокровище? (5-из-6)');
      return this._stockedMonster(level, loot.ok, 'Каверна занята.');
    }

    const a = rollTable(this.rng, '4-59', 'Содержимое комнаты · 1d100');
    if (a.out === 'empty') {
      s.monsterLoot = null;
      return { lines: ['Комната выглядит пустой.'], next: this.afterRoom() };
    }
    if (a.out === 'treasure') {
      s.monsterLoot = null;
      const t = this.t_4_63();
      return {
        lines: ['Комната пуста, но здесь спрятано сокровище.'].concat(t.lines),
        next: this.afterRoom(),
        warn: t.warn || null
      };
    }
    return this._stockedMonster(level, true, 'Комната занята.');
  }

  /* Карточка занятой комнаты: монстр из Группы Stocking Monsters.
   * withLoot — гарантировано ли сокровище (обычная комната: всегда; каверна: 5-из-6). */
  _stockedMonster(level, withLoot, title) {
    const diff = this._difficulty();
    const g = shiftGroup(groupForLevel(level), diff);
    const mon = this._pickGroupMonster(g);
    const num = this._numberAppearing(level, diff);
    this.state.monsterLoot = !!withLoot;
    return {
      lines: [title,
        mon[1] + (num.n > 1 ? ' ×' + num.n : '') + ' (группа ' + GROUP_ROMAN[g] + ')' +
        (diff === 'same' ? '' : diff === 'easier' ? ' — слабее обычного' : ' — сильнее обычного'),
        this._reactionLine()],
      next: this.afterRoom(),
      halt: true
    };
  }

  /* --- Содержимое ------------------------------------------------------- */
  /* Обыскать монстра (по требованию, без предварительного анонса). Для соло
   * неподвижный монстр всегда с сокровищем; каверна — 5-из-6, что решилось
   * скрыто в 4-59. */
  t_loot() {
    const s = this.state;
    /* Разыгрывать содержимое надо, если это ещё комната. Но бродячий монстр
     * встречается в проходе, где roomStocked = false — его обыскивать можно. */
    if (!s.roomStocked && s.monsterLoot === null) {
      return { lines: ['Сначала разыграйте содержимое комнаты (4-59).'] };
    }
    let lines;
    if (s.monsterLoot === true) {
      s.monsterLoot = null;
      lines = this.t_4_63().lines;
    } else if (s.monsterLoot === false) {
      s.monsterLoot = null;
      lines = ['Обыскали монстра и комнату — добычи нет.'];
    } else {
      lines = ['Обыскали комнату — ничего не найдено.'];
    }
    const tt = this._spendTime(T.dungeon.minutesPerTurn);
    return { lines: lines.concat(tt.lines), halt: tt.enc };
  }

  /* Бросок монстра по матрице 4-62. Общий для комнат и случайных встреч. */
  _monsterPick() {
    const L = this.level;
    if (L > 6) {
      const p = this.rng.pick(MONSTERS.verifiedPool, 'Имя из общего пула');
      return {
        lines: [p.value.ru + ' ×1'],
        warn: 'уровень ' + L + ' в буклете не восстановлен: имя взять из общего пула и заменить'
      };
    }
    const lv = MONSTERS.levels[L];
    const r = this.rng.roll(lv.die, 'Монстр, уровень ' + L + ' · ' + lv.die);
    const row = pickRow(lv.rows, r.total);
    const lines = [row.m.ru + (row.qty ? ' ×' + row.qty : '')];
    if (row.qty === 1) lines.push('(кол-во 1) — HTK можно уменьшить или увеличить вдвое.');
    return { lines, warn: null };
  }

  t_4_62() { return this._monsterPick(); }

  /* Ротация бродячих монстров уровня (справка Рефери). */
  t_wander() {
    const r = this._ensureRoster();
    const group = groupForLevel(this.level);
    const lines = ['Бродячие монстры уровня ' + this.level + ' — группа ' + GROUP_ROMAN[group] + ', ' + r.set.length + ':']
      .concat(r.set.map(m => '— ' + m[1]));
    return { lines };
  }

  /* TABLE 3-31: сложность встречи. */
  _difficulty() {
    const r = this.rng.roll('1d6', 'Сложность встречи (3-31) · 1d6').total;
    return r <= 1 ? 'easier' : r >= 6 ? 'harder' : 'same';
  }

  /* Ротация бродячих монстров уровня: 3 или 4 из Группы, без повторов. */
  _ensureRoster() {
    const s = this.state;
    if (s.wanderLevel === this.level && s.wanderSet.length) return { set: s.wanderSet, fresh: false };
    const group = groupForLevel(this.level);
    const pool = GROUPS[group].slice();
    const count = this.rng.roll('1d2', 'Число бродячих в ротации (3 или 4) · 1d2').total === 1 ? 3 : 4;
    const set = [];
    for (let i = 0; i < count && pool.length; i++) {
      const p = this.rng.pick(pool, 'Бродячий монстр уровня · группа ' + GROUP_ROMAN[group]).value;
      pool.splice(pool.indexOf(p), 1);
      set.push(p);
    }
    s.wanderLevel = this.level;
    s.wanderSet = set;
    return { set: set, fresh: true };
  }

  _pickGroupMonster(group) {
    return this.rng.pick(GROUPS[group], 'Монстр группы ' + GROUP_ROMAN[group]).value;
  }

  /* Number Appearing: база по уровню (1d6 / 1d4), ×2 при «более лёгкой» группе. */
  _numberAppearing(level, diff) {
    const die = NUMBER_APPEARING.baseDie(level);
    const base = this.rng.roll(die, 'Число появляющихся · ' + die).total;
    const mult = diff === 'easier' ? NUMBER_APPEARING.easierMultiplier : 1;
    return { n: base * mult, base: base, mult: mult };
  }

  /* Реакция монстра (2d6). Общая для бродячих и комнатных. */
  _reactionLine() {
    const rr = this.rng.roll('2d6', 'Реакция · 2d6').total;
    const react = rr <= 2 ? 'немедленная атака' : rr <= 5 ? 'враждебность'
      : rr <= 8 ? 'неопределённость' : rr <= 11 ? 'дружелюбие' : 'энтузиазм';
    return 'Реакция (2d6=' + rr + '): ' + react + '.';
  }

  /* Случайная встреча: монстр из ротации уровня (или соседней Группы при
   * сложности 3-31), число появляющихся, дистанция 1d6×10 футов, реакция 2d6.
   * Добыча бродячего монстра — скрыто 1-из-6 (берётся действием «Обыскать»). */
  _encounterLines() {
    const d = T.dungeon;
    const level = this.level;
    const diff = this._difficulty();
    const baseGroup = groupForLevel(level);
    let mon, g;
    if (diff === 'same') {
      mon = this.rng.pick(this._ensureRoster().set, 'Бродячий монстр уровня').value;
      g = baseGroup;
    } else {
      g = shiftGroup(baseGroup, diff);
      mon = this._pickGroupMonster(g);
    }
    const num = this._numberAppearing(level, diff);
    const dist = this.rng.roll(d.encounterDistance.die, 'Дистанция встречи · 1d6×10 футов').total * d.encounterDistance.per;
    this.state.monsterLoot = chanceOf(this.rng, { n: 6, ok: 1 }, 'У бродячего монстра есть добыча? (1-из-6)').ok;
    const head = mon[1] + (num.n > 1 ? ' ×' + num.n : '') + ' (группа ' + GROUP_ROMAN[g] +
      (diff === 'same' ? '' : diff === 'easier' ? ', легче' : ', сложнее') + ')';
    return [head,
      'Дистанция: ' + this.pluralize(dist + ' футов') + '.',
      this._reactionLine()];
  }

  _fmtMin(m) { return (Math.round(m * 10) / 10).toString().replace('.', ','); }

  /* Догорел ли источник; при нуле — автозамена ЛЮБЫМ доступным (сначала тем же
   * видом, затем по топливу); если запаса нет — полная темнота. */
  _relight() {
    const s = this.state;
    const cur = s.light.kind;
    const order = [];
    if (cur && cur !== 'none') order.push(cur);
    order.push('torch', 'lantern');
    for (const k of order) {
      const L = T.lights[k];
      if (!L || !L.fuel) continue;
      if (L.fuel === 'torch' && s.stock.torches > 0) { s.stock.torches--; s.light = { kind: k, minutesLeft: L.burn }; return k; }
      if (L.fuel === 'oil' && s.stock.oil > 0) { s.stock.oil--; s.light = { kind: k, minutesLeft: L.burn }; return k; }
    }
    return null;
  }

  _burnLight(minutes) {
    const s = this.state;
    const events = [];
    let m = minutes, guard = 0;
    while (m > 1e-9 && guard++ < 1000) {
      const L = s.light;
      if (L.kind === 'none') { events.push('Полная темнота — нужен свет.'); break; }
      if (m < L.minutesLeft - 1e-9) { L.minutesLeft -= m; m = 0; break; }
      m -= L.minutesLeft;
      L.minutesLeft = 0;
      events.push('«' + T.lights[L.kind].ru + '» догорел.');
      const next = this._relight();
      if (!next) { L.kind = 'none'; events.push('Света больше нет — полная темнота.'); break; }
      events.push('Зажжён «' + T.lights[next].ru + '».');
    }
    return events;
  }

  /* Трата времени. Ход = 10 минут (90 футов пути / обыск / 10 футов стены).
   * На КАЖДЫЙ пройденный 10-минутный тик — проверка случайной встречи. */
  _spendTime(minutes) {
    const s = this.state;
    const before = Math.floor((s.minutes + 1e-9) / T.dungeon.minutesPerTurn);
    s.minutes += minutes;
    const after = Math.floor((s.minutes + 1e-9) / T.dungeon.minutesPerTurn);
    s.turns = after;
    const lines = ['Время: +' + this._fmtMin(minutes) + ' мин (всего ' + this._fmtMin(s.minutes) + ', ходов: ' + after + ').'];
    lines.push(...this._burnLight(minutes));
    let hit = false;
    for (let t = before; t < after; t++) {
      const ch = chanceOf(this.rng, T.dungeon.wanderChance, 'Случайная встреча? (1-из-6)');
      if (!ch.ok) { lines.push('Проверка встречи (ход ' + (t + 1) + '): тихо.'); continue; }
      hit = true;
      lines.push('Проверка встречи (ход ' + (t + 1) + '): ВСТРЕЧА!');
      lines.push(...this._encounterLines());
    }
    return { lines: lines, enc: hit };
  }

  /* Зажечь источник (действие мастера). Тратит 1 единицу топлива. */
  lightSource(kind) {
    const s = this.state;
    if (!kind || kind === 'off' || kind === 'none') {
      s.light = { kind: 'none', minutesLeft: 0 };
      return this._card('light', () => ({ lines: ['Свет погашен — полная темнота.'], next: [] }));
    }
    const L = T.lights[kind];
    if (!L) return this._card('light', () => ({ lines: ['Неизвестный источник света.'], next: [] }));
    if (L.fuel === 'torch' && s.stock.torches <= 0) return this._card('light', () => ({ lines: ['Факелов не осталось.'], next: [] }));
    if (L.fuel === 'oil' && s.stock.oil <= 0) return this._card('light', () => ({ lines: ['Масла не осталось.'], next: [] }));
    if (L.fuel === 'torch') s.stock.torches--; else s.stock.oil--;
    s.light = { kind: kind, minutesLeft: L.burn };
    return this._card('light', () => ({ lines: ['Зажжён «' + L.ru + '»: ' + L.burn + ' мин, радиус ' + L.radius + ' футов' + (L.half ? ' (полукруг)' : '') + ', отражения ' + L.reflect + ' футов.'], next: [] }));
  }

  t_4_63() {
    const L = Math.min(this.level, 6);
    const lv = TREASURE.levels[L];
    const r = this.rng.roll(lv.die, 'Сокровище, уровень ' + L + ' · ' + lv.die);
    const row = pickRow(lv.rows, r.total);
    /* «1d3 x 250 gp» — это бросок, а не инструкция мастеру: считаем здесь,
     * иначе карточка велит бы пользователю самому прикинуть сумму */
    const lines = [this.resolveText(row.item.ru)];
    if (row.magic) lines.push('Магический предмет.');
    return { lines, warn: this.level > 6 ? 'уровень ' + this.level + ' не восстановлен: взяты значения 6-го уровня' : null };
  }

  /* --- Лестницы --------------------------------------------------------- */
  t_4_60() {
    let r, tries = 0;
    do {
      r = this.rng.roll(T['4-60'].die, 'Число лестниц · 2d6+3 (выше 12 — переброс)');
      tries++;
    } while (r.total > T['4-60'].rerollAbove && tries < 30);
    const n = pickRow(T['4-60'].rows, r.total).out;
    const lines = ['Лестниц на уровне: ' + n +
      '. Справочно: уровень размечается по ходу, заранее счётчик не используется.'];
    if (tries > 1) lines.push('Перебросов: ' + (tries - 1) + '.');
    return { lines };
  }

  /* Найденная по ходу лестница. Расстояние и направление «от центра» НЕ
   * бросаются: в соло-игре «вслепую» карты и центра уровня ещё нет, эти строки
   * были наследием старой предразмеченной генерации. Остаётся суть: куда ведёт,
   * какая, где стоит. */
  t_stairway() {
    const gen = this.t_stair_general();
    const sur = this.t_stair_surround();
    const s = this.state;
    const down = /вниз/.test(gen.brief), up = /вверх/.test(gen.brief);
    s.stairKind = (down && up) ? 'both' : (down ? 'down' : 'up');
    const depth = s.stairKind === 'up' ? -1 : 1;
    const target = Math.max(1, Math.min(12, this.level + depth));
    const same = (target === this.level);
    const verb = depth > 0 ? 'Спуститься' : 'Подняться';
    return {
      lines: ['Найдена лестница на другой уровень.'].concat(gen.lines, sur.lines),
      choice: [
        same
          ? { key: 'descend', disabled: true,
              label: depth > 0
                ? 'Уровень ' + this.level + ' — глубже буклет не идёт'
                : 'Выше некуда: это выход на поверхность' }
          : { key: 'descend', label: verb + ' на уровень ' + target },
        { key: 'continue', label: 'Идти дальше (остаться на уровне ' + this.level + ')' }
      ],
      action: 'stairway',
      next: []
    };
  }

  /* Развилка на найденной лестнице. «Спуститься» фиксирует переход: меняет
   * уровень, сбрасывает поуровневое состояние (футы, проверка комнаты, каверна,
   * выходы) и начинает новый уровень с оси 4-51. «Идти дальше» — продолжаем
   * текущий проход. */
  _stairwayChoice(key) {
    const s = this.state;
    if (key !== 'descend') {
      /* Лестница в комнате: сначала разыграть саму комнату (4-56), затем её
       * выходы и содержимое, и только потом продолжить проход. */
      if (s.stairRoom) {
        s.stairRoomPending = true;
        return { lines: ['Идём дальше — сначала комната, в которой стоит лестница.'], next: ['4-56'] };
      }
      return { lines: ['Идём дальше по уровню ' + this.level + '.'], next: ['4-54'] };
    }
    const depth = s.stairKind === 'up' ? -1 : 1;
    const target = Math.max(1, Math.min(12, this.level + depth));
    s.feet = 0; s.sinceRoom = 0; s.roomStocked = false; s.roomCavern = false;
    s.roomSqFt = 0; s.exitsLeft = 0; s.entryRoom = false; s.entryRoomDone = true;
    s.lastOddity = null; s.monsterLoot = null; s.stairRoom = false; s.stairRoomPending = false;
    this.setLevel(target);
    const verb = depth > 0 ? 'Спуск' : 'Подъём';
    return {
      lines: [verb + ' на уровень ' + target + '. Поуровневое состояние сброшено.',
              'Ось нового уровня — 4-51.'],
      next: ['4-51']
    };
  }

  t_stair_general() {
    const g = T['stairway-general'];
    const both = chanceOf(this.rng, g.bothChance, 'Лестница вверх-вниз?');
    const kind = both.ok ? 'both'
      : (this.rng.roll('1d2', 'Вверх или вниз (поровну)').total === 1 ? 'up' : 'down');
    const spiral = chanceOf(this.rng, g.spiralChance, 'Винтовая лестница?');
    const fp = spiral.ok ? g.spiralFootprint : g.plainFootprint;
    const kindRu = kind === 'both' ? 'вверх и вниз' : kind === 'up' ? 'вверх' : 'вниз';
    const lines = [kind === 'both' ? 'Лестница вверх и вниз' : kind === 'up' ? 'Лестница вверх' : 'Лестница вниз'];
    if (kind !== 'both') lines.push('Между уровнями ' + g.levelGapFeet[0] + '–' + g.levelGapFeet[1] + ' футов камня.');
    lines.push(spiral.ok
      ? "Винтовая: круглая камера 20' диаметром"
      : 'Обычная: ' + roomSize(fp));
    return { lines: lines, brief: (spiral.ok ? 'винтовая, ' : '') + kindRu };
  }

  t_stair_surround() {
    const a = rollTable(this.rng, 'stair-surround');
    /* если лестница в комнате — её надо разыграть (4-56), см. _stairwayChoice */
    this.state.stairRoom = a.out !== 'passage';
    const line = a.out === 'passage'
      ? 'Лестница прямо в проходе.'
      : 'Лестница в комнате, размером не более ' + a.row.maxSize + "'. Форма на усмотрение мастера.";
    return { lines: [line], brief: a.out === 'passage' ? 'проход' : "комната ≤" + a.row.maxSize + "′" };
  }

  /* --- Оракул (Booklet 10) ---------------------------------------------- *
   * Выдаёт «слова-подсказки» для фантазии: описание, действие, вопрос,
   * специальные столы. Всё — по требованию мастера, не автоматически.
   * Слова русского списка соседствуют без согласования («ветхий · сокровищница»). */

  _oraclePick(arr, what) { return this.rng.pick(arr, what + ' · 1d' + arr.length).value; }
  _oracleSeed(pair) { return pair[1]; }   /* [en, ru] -> ru */

  _oracleLines(kind) {
    const P = (arr, what) => this._oracleSeed(this._oraclePick(arr, what));
    const Q_RU = { who: 'кто', what: 'что', when: 'когда', where: 'где', why: 'почему', how: 'как', howMuch: 'сколько' };
    const SPEC_RU = {
      color: 'цвет', troops: 'войска', weapon: 'оружие', armor: 'броня',
      spell: 'заклинания', artillery: 'артиллерия', cover: 'укрытия',
      culture: 'культуры', personage: 'персоны', monster: 'монстры'
    };
    switch (kind) {
      case 'oracle-an':
        return ['Описание: ' + P(O_ADJ, 'Оракул: прилагательное') + ' · ' + P(O_NOUNS, 'Оракул: существительное')];
      case 'oracle-vn':
        return ['Действие: ' + P(O_VERBS, 'Оракул: глагол') + ' · ' + P(O_NOUNS, 'Оракул: существительное')];
      case 'oracle-adv':
        return ['Как: ' + P(O_ADV, 'Оракул: наречие') + ' · ' + P(O_VERBS, 'Оракул: глагол')];
      case 'oracle-q': {
        const cats = ['who', 'what', 'when', 'where', 'why', 'how', 'howMuch'];
        const c = this._oraclePick(cats, 'Оракул: категория вопроса');
        return ['Вопрос (' + (Q_RU[c] || c) + '): ' + P(O_PREP[c], 'Оракул: ' + c)];
      }
      case 'oracle-prep':
        return ['Предлог: ' + P(O_PREPART, 'Оракул: предлог-артикль') + ' ' + P(O_NOUNS, 'Оракул: существительное')];
      default: {
        const key = kind.replace('oracle-', '');
        const map = {
          color: 'colors', troops: 'troops', weapon: 'weapons', armor: 'armor',
          spell: 'spells', artillery: 'artillery', cover: 'cover',
          culture: 'cultures', personage: 'personages', monster: 'fantasticMonsters'
        };
        const tbl = O_SPEC[map[key]];
        if (!tbl) return ['Оракул: неизвестный стол ' + kind];
        let pair = this._oraclePick(tbl, 'Оракул · ' + key);
        let guard = 0;
        while ((pair[0] === 'Roll again' || pair[1] === 'переброс') && guard++ < 20) {
          pair = this._oraclePick(tbl, 'Оракул · ' + key);
        }
        return ['Оракул (' + (SPEC_RU[key] || key) + '): ' + this._oracleSeed(pair)];
      }
    }
  }

  /* Все оракульные псевдо-столы сведены к одному методу. */
  _oracle(kind) { return { lines: this._oracleLines(kind), next: [] }; }
  t_oracle_an() { return this._oracle('oracle-an'); }
  t_oracle_vn() { return this._oracle('oracle-vn'); }
  t_oracle_adv() { return this._oracle('oracle-adv'); }
  t_oracle_q() { return this._oracle('oracle-q'); }
  t_oracle_prep() { return this._oracle('oracle-prep'); }
  t_oracle_color() { return this._oracle('oracle-color'); }
  t_oracle_troops() { return this._oracle('oracle-troops'); }
  t_oracle_weapon() { return this._oracle('oracle-weapon'); }
  t_oracle_armor() { return this._oracle('oracle-armor'); }
  t_oracle_spell() { return this._oracle('oracle-spell'); }
  t_oracle_artillery() { return this._oracle('oracle-artillery'); }
  t_oracle_cover() { return this._oracle('oracle-cover'); }
  t_oracle_culture() { return this._oracle('oracle-culture'); }
  t_oracle_personage() { return this._oracle('oracle-personage'); }
  t_oracle_monster() { return this._oracle('oracle-monster'); }

  /* Пресет для конкретной карточки: комната, проход, монстр и т.д. */
  oraclePreset(table) {
    const kinds = ORACLE_PRESET[table];
    if (!kinds) throw new Error('для стола «' + table + '» оракульного пресета нет');
    const lines = [];
    for (const k of kinds) lines.push(...this._oracleLines(k));
    return this._card('oracle', () => ({ lines: lines, next: [] }));
  }

  /* --- Прочее ----------------------------------------------------------- */
  /* Выбор диковинки с учётом условий. `need` (напр. #15: только в каверне не
   * меньше 720 кв. футов) — иначе «Otherwise, re-roll». `once` (#24: светящаяся
   * лестница) — не больше одной на подземелье. Раньше оба поля просто
   * игнорировались. */
  _pickOddity() {
    const seen = this.state.odditiesSeen || (this.state.odditiesSeen = []);
    for (let tries = 0; tries < 60; tries++) {
      const item = this.rng.pick(ODDITIES, 'Диковинка · 1d' + ODDITIES.length).value;
      if (item.once === 'dungeon' && seen.indexOf(item.n) !== -1) continue;
      if (item.need && !this._oddityNeedMet(item.need)) continue;
      seen.push(item.n);
      return item;
    }
    /* защита от бесконечного перебора: возвращаем что угодно */
    return this.rng.pick(ODDITIES, 'Диковинка (повтор) · 1d' + ODDITIES.length).value;
  }

  _oddityNeedMet(need) {
    if (need.cavernMinSqFt) {
      return !!this.state.roomCavern && this.state.roomSqFt >= need.cavernMinSqFt;
    }
    return true;
  }

  t_oddity() {
    const d = T.dungeon;
    let item = null;
    if (this.state.lastOddity) {
      if (chanceOf(this.rng, d.oddityRepeatChance, 'Следующая диковинка — та же?').ok) item = this.state.lastOddity;
    }
    if (!item) item = this._pickOddity();
    this.state.lastOddity = item;
    const lines = this._resolveOddity(item);
    /* Ссылки на другие буклеты: трапы и существа Booklet 2 подставляем в
     * карточку, чтобы мастеру не искать вручную. Оракул (#25) отложен. */
    if (item.trap && TRAPS[item.trap]) {
      lines.push('Буклет 2, ловушка: ' + TRAPS[item.trap].mech);
    }
    if (item.creature && CREATURES[item.creature]) {
      const cr = CREATURES[item.creature];
      lines.push('Буклет 2: ' + cr.ru + ' — HTK ' + cr.htk + '. ' + cr.body);
    }
    if (item.oracle) {
      lines.push('Подсказку по теме можно взять в разделе «Оракул» (Буклет 10).');
    }
    if (item.once === 'dungeon') lines.push('Такая диковинка в подземелье одна.');
    lines.push('Диковинка выпадает каждые ' + d.oddityEverySqFt + ' кв. футов исследованной площади.');
    return { lines };
  }

  t_trap() {
    const p = this.rng.pick(TRAP_ORDER, 'Ловушка · 1d' + TRAP_ORDER.length);
    const tr = TRAPS[p.value];
    return { lines: [tr.ru + ' — ' + tr.mech] };
  }

  /* «A dead end room may be searched for a single secret door. For each 10 feet
   * searched, there is a 1-in-12 chance.» Пол и потолок так не ищут. */
  t_secret(opts) {
    const s = T['secret-door-search'];
    const feet = Math.max(0, parseInt(opts.feet, 10) || 0);
    const tries = Math.floor(feet / s.perFeet);
    const lines = [this.pluralize('Исследовано ' + feet + ' футов стены — это ' + tries + ' попыток по 10 футов.')];
    if (!tries) {
      lines.push('Меньше 10 футов — ни одного броска.');
      const tt0 = this._spendTime(feet * T.dungeon.minutesPerTurn / T.dungeon.wallFeetPerTurn);
      lines.push(...tt0.lines);
      return { lines: lines, halt: tt0.enc };
    }
    let found = 0;
    for (let i = 0; i < tries; i++) {
      if (chanceOf(this.rng, s.chance, 'Потайная дверь, попытка ' + (i + 1)).ok) found++;
    }
    lines.push(found ? 'Найдено потайных дверей: ' + found : 'Ни одной потайной двери.');
    lines.push(s.note.charAt(0).toUpperCase() + s.note.slice(1) + '.');
    const tt1 = this._spendTime(feet * T.dungeon.minutesPerTurn / T.dungeon.wallFeetPerTurn);
    lines.push(...tt1.lines);
    return { lines: lines, halt: tt1.enc };
  }

  /* --- сохранение -------------------------------------------------------- */
  toJSON() {
    return { format: 'dungeon-flow/2', level: this.level, state: this.state, rng: this.rng.toJSON(), cards: this.cards };
  }

  restore(data) {
    if (!data || !Array.isArray(data.cards)) {
      throw new TypeError('restore() ждёт полный toJSON(): {level, state, rng, cards}');
    }
    this.setLevel(data.level);
    /* Копия, а не ссылка: иначе resolve первой восстановленной партии допишет
     * карточку в чужой журнал (общий массив), и вторая копия уже не разрешит
     * свой выбор. Клон ГЛУБОКИЙ: вложенные rolls/lines/next не должны шариться
     * между восстановленными партиями. */
    this.cards = data.cards.map(cloneCard);
    /* defaultState() ← сохранённое состояние. Сохранения формата /1 не знали
     * новые поля (entryRoom и т.п.) — они добираются из дефолтов, а не
     * остаются undefined (иначе логика фазы молча ломается). */
    this.state = Object.assign(defaultState(), data.state || {});
    /* odditiesSeen — массив; копируем, чтобы две партии из одного файла не
     * делили его (иначе правило once протекает между партиями) */
    this.state.odditiesSeen = Array.isArray(this.state.odditiesSeen)
      ? this.state.odditiesSeen.slice() : [];
    this.state.wanderSet = Array.isArray(this.state.wanderSet) ? this.state.wanderSet.slice() : [];
    this.state.light = Object.assign({ kind: 'none', minutesLeft: 0 }, this.state.light || {});
    this.state.stock = Object.assign({ torches: 0, oil: 0 }, this.state.stock || {});
    const r = data.rng || {};
    this.rng = new RNG({ seed: r.seed, log: r.log || [] });
    if (typeof r.state === 'number') this.rng.state = r.state;
    if (r.steps) this.rng.steps = r.steps;
    this.rng.rawSeed = r.seed;
    return true;
  }
}

module.exports = { TABLES, RU, SHAPES, pickRow, rollTable, roomSize, Flow, ORACLE_PRESET, oracleFor };