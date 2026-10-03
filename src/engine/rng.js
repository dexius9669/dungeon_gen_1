/* =============================================================================
 * ДЕТЕРМИНИРОВАННЫЙ ГЕНЕРАТОР СЛУЧАЙНЫХ ЧИСЕЛ
 *
 * Требования, из-за которых всё это сложнее обычного Math.random():
 *   1. Один и тот же seed → один и тот же результат. Всегда.
 *   2. Каждый бросок виден мастеру: сколько костей, какие значения, итог,
 *      и ПОЧЕМУ он брошен (ссылка на таблицу/пункт буклета).
 *   3. Откат: игрок передумал — мастер жмёт «назад», состояние возвращается
 *      к моменту до броска, и можно бросить заново.
 *   4. Переброс: бросить тот же шаг с другим seed-вариантом, не трогая
 *      предыдущие шаги.
 *
 * Как устроен откат: генератор — это чистая функция от одного числа (state).
 * Поэтому достаточно запоминать state до каждого шага. Никаких откатов
 * «назад по истории», никаких пересчётов — просто восстановили число.
 * ========================================================================== */

/* --- PRNG -----------------------------------------------------------------
 * mulberry32: 32 бита состояния, быстрый, равномерный, проходит gjrand.
 * Состояние живёт в объекте, а не в замыкании — иначе его нельзя было бы
 * прочитать снаружи, а это нужно: откат шага = восстановить s.
 * ------------------------------------------------------------------------ */
function mulberry32(seed) {
  const st = { s: seed | 0 };
  st.next = function () {
    let a = (st.s = (st.s + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  st.reseed = function (v) { st.s = v | 0; };
  return st;
}

/* Хеширование строки в seed — чтобы можно было вводить «dungeon-42» */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

class RNG {
  /* opts: { seed: number|string, log: array (журнал, можно передать свой) } */
  constructor(opts = {}) {
    this.setSeed(opts.seed);
    this.log = opts.log || [];
    this.steps = [];          // контрольные точки для отката
    this.steps.push({ state: this.state, count: this.log.length, label: 'начало' });
  }

  setSeed(seed) {
    if (seed === undefined || seed === null || seed === '') seed = (Date.now() ^ (Math.random() * 4294967296)) >>> 0;
    this.rawSeed = seed;
    this._p = mulberry32((typeof seed === 'number') ? (seed >>> 0) : hashSeed(seed));
  }

  /* Живое состояние генератора. Именно его снимают для отката. */
  get state() { return this._p.s; }
  set state(v) { this._p.reseed(v); }

  /* Сырое число [0,1) — не логируется. Для внутренних нужд (шум, выбор). */
  next() { return this._p.next(); }

  /* Целое [1..sides]. Не логируется — используйте roll(). */
  int(sides) { return Math.floor(this._p.next() * sides) + 1; }

  /* Целое [0..sides-1] — для индекса массива или клетки сетки.
   * int() возвращает 1-based значение, поэтому для индексов нужен отдельный
   * метод: иначе на сетке 0..53 можно получить r = 54 и выйти за край. */
  int0(sides) { return Math.floor(this._p.next() * sides); }

  /* Целое [lo..hi] включительно. */
  range(lo, hi) { return lo + Math.floor(this._p.next() * (hi - lo + 1)); }

  /* --- кубик с разбором нотации -----------------------------------------
   * Поддерживает: "1d8", "2d6", "1d3+2", "2d6-1", "1d100", "4d6/2" (среднее)
   * Возвращает { total, dice:[...], mod, formula, detail }
   * reason — строка для журнала: "4-52 длина секции прохода"
   * ---------------------------------------------------------------------- */
  roll(formula, reason) {
    const f = String(formula).trim();
    let m = f.match(/^(\d*)d(\d+)$/);
    let n, sides, mod = 0, avg = false;

    if (m) { n = +m[1]; sides = +m[2]; }
    else {
      m = f.match(/^(\d*)d(\d+)\s*([+-])\s*(\d+)$/);
      if (m) { n = +m[1]; sides = +m[2]; mod = (m[3] === '-' ? -1 : 1) * +m[4]; }
      else {
        m = f.match(/^(\d*)d(\d+)\s*\/\s*(\d+)$/);
        if (m) { n = +m[1]; sides = +m[2]; avg = +m[3]; }
        else {
          /* "12" или "12+3" — просто число, но пусть тоже будет в журнале */
          m = f.match(/^(\d+)(?:\s*([+-])\s*(\d+))?$/);
          if (m) {
            const base = +m[1];
            const off = m[2] ? (m[2] === '-' ? -1 : 1) * +m[3] : 0;
            return this._record({ total: base + off, dice: [], mod: off, formula: f,
                                  detail: 'константа', reason });
          }
          throw new Error('Не разобрана формула кубика: "' + formula + '"');
        }
      }
    }
    if (!(n > 0)) throw new Error('Формула "' + formula + '": нужно хотя бы 1 кость');
    if (!(sides > 0)) throw new Error('Формула "' + formula + '": граней должно быть > 0');

    const dice = [];
    for (let i = 0; i < n; i++) dice.push(this.int(sides));
    let total = dice.reduce((a, b) => a + b, 0);
    let detail = dice.join(' + ') || '—';

    if (avg) {
      /* «NdM/K» = сумма костей, делённая на K нацело. В буклете не встречается
       * (проверено: 4-61 это 2d6), но синтаксис оставлен для полноты. */
      const sum = total;
      total = Math.floor(sum / avg);
      detail = '(' + detail + ') / ' + avg + ' → ' + sum + ' / ' + avg;
    }
    if (mod) { total += mod; detail += (mod > 0 ? ' + ' : ' − ') + Math.abs(mod); }

    return this._record({ total, dice, mod, formula: f, detail, reason });
  }

  _record(entry) {
    const rec = { id: this.log.length + 1, reason: entry.reason || '', formula: entry.formula,
                  dice: entry.dice, detail: entry.detail, total: entry.total,
                  /* Метка этапа генерации («Проход», «Комнаты»…). Ставится
                   * генератором через this.rng.phase: без неё журнал — это
                   * 300 безымянных строк, а с ней — читаемый отчёт. */
                  phase: this.phase || '' };
    this.log.push(rec);
    return { total: rec.total, dice: rec.dice, id: rec.id, detail: rec.detail, reason: rec.reason };
  }

  /* Бросок «шанс n-из-m»: true с вероятностью n/m */
  chance(n, m, reason) {
    const roll = this.int(m);
    const rec = this._record({ total: roll, dice: [roll], formula: 'шанс ' + n + '/' + m,
                               detail: (roll <= n) ? 'успех (' + roll + ' ≤ ' + n + ')' : 'неудача (' + roll + ' > ' + n + ')',
                               reason });
    return { ok: roll <= n, total: roll, id: rec.id, detail: rec.detail };
  }

  /* Выбор из массива — всегда в журнале, «шанс 1-из-1» тоже.
   * ВНИМАНИЕ: int() возвращает 1-based значение, а индекс массива 0-based,
   * поэтому из него вычитается 1. Без этого pick() вылезал за конец массива
   * (value = undefined) и никогда не выбирал первый элемент. */
  pick(arr, reason) {
    if (!arr || !arr.length) throw new Error('pick: нечего выбирать');
    const i = this.int(arr.length) - 1;
    const item = arr[i];
    const rec = this._record({ total: i + 1, dice: [i + 1], formula: '1d' + arr.length,
                               detail: '→ ' + (item && (item.ru || item.en) || item),
                               reason });
    return { value: item, index: i, id: rec.id, total: i + 1 };
  }

  /* --- границы шага для отката ------------------------------------------
   * begin(label) — запомнить состояние перед шагом;
   * rollback(stepId) — вернуться к нему, отрезав всё, что после;
   * reroll(stepId, newSeedSalt) — тот же шаг заново с другим солью.
   * ---------------------------------------------------------------------- */
  begin(label) {
    const step = { id: this.steps.length, label: label || ('шаг ' + this.steps.length),
                   state: this.state, logStart: this.log.length,
                   seedSalt: this.salt || 0 };
    this.steps.push(step);
    return step;
  }

  rollback(stepId) {
    const s = this.steps.find(x => x.id === stepId);
    if (!s) return false;
    this.state = s.state;
    this.salt = s.seedSalt || 0;
    this.log.length = s.logStart;   /* откатываем и журнал */
    this.steps.length = stepId + 1; /* и историю шагов */
    return true;
  }

  /* Перебросить последний шаг: откатываем его и делаем с солёным seed,
   * так что базовая последовательность не «поедет» для других игр. */
  rerollLastStep(salt) {
    const s = this.steps[this.steps.length - 1];
    if (!s || s.id === 0) return false;
    this.rollback(s.id);
    this.salt = (s.salt || 0) + (salt === undefined ? 1 : salt);
    this.state = (this.state + Math.imul(this.salt | 0, 0x9E3779B1)) >>> 0;
    return this.begin(s.label);
  }

  /* Сериализация: журнал + шаги, чтобы сохранить партию в файл */
  toJSON() { return { seed: this.rawSeed, state: this.state, salt: this.salt || 0, log: this.log, steps: this.steps }; }
}

if (typeof module !== 'undefined') {
  module.exports = { RNG, mulberry32, hashSeed };
}
