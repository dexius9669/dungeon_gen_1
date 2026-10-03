/* =============================================================================
 * ИНТЕРФЕЙС — журнал бросков
 *
 * Оформление повторяет Dungeon_Gen_DB: сайдбар со столами слева, журнал
 * карточек справа, цветная левая грань по категории, появление карточки
 * анимацией. Отличия, которые здесь осознанны:
 *   • никакой карты — мастер рисует её сам, программа не знает про клетки;
 *   • «далее вероятно» — рекомендация; мастер вправе бросать что угодно;
 *   • автоцепочка (как setChainedTimeout в DB) — опция, по умолчанию выключена;
 *   • каждая карточка показывает ВСЕ кости своего броска.
 * ========================================================================== */

'use strict';

const { Flow, TABLES, RU, oracleFor } = require('../engine/flow.js');
const T = require('../data/tables.js');

const GROUPS = ['Вход', 'Проход', 'Комнаты', 'Лестницы', 'Содержимое', 'Прочее', 'Оракул'];

const CHAIN_DELAY = 600;   /* мс между карточками, как в эталоне */
/* Предохранитель от бесконечного цикла проходов (4-52↔4-54). Должен быть
 * заведомо больше штатной подготовки: до 17 лестниц × 4 броска = 68 шагов плюс
 * камера, содержимое и вход, поэтому 50 обрывало цепочку прямо на лестницах. */
const CHAIN_LIMIT = 200;

const state = {
  flow: null,
  level: 1,
  seed: '',
  chain: { on: false, timer: null, steps: 0, delay: CHAIN_DELAY, limit: CHAIN_LIMIT }
};

function $(id) { return document.getElementById(id); }

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

/* Категория карточки → цвет левой грани, как в Dungeon_Gen_DB. */
function category(table) {
  if (['4-55', '4-56', '4-57', '4-58', '4-59', 'room-exits'].indexOf(table) !== -1) return 'room-box';
  if (['4-51', '4-52', '4-53', '4-54', 'room-find', 'collision'].indexOf(table) !== -1) return 'passage-box';
  if (table === '4-62') return 'monster-box';
  if (table === '4-63') return 'treasure-box';
  if (['oddity', 'trap', 'secret'].indexOf(table) !== -1) return 'trick-box';
  if (table === 'oracle' || table.indexOf('oracle-') === 0) return 'trick-box';
  return '';
}

/* --- инициализация ------------------------------------------------------- */
function init() {
  const params = new URLSearchParams(location.search);
  state.level = clampLevel(params.get('level') || 1);
  state.seed = params.get('seed') || '';
  $('level').value = state.level;
  $('seed').value = state.seed;
  buildButtons();
  newRun(state.seed);
  bind();
  log('Открыт журнал бросков. Выберите таблицу — или начните с 4-51, вход в подземелье.', 'hint');
}

/* Кнопки строятся из TABLES, чтобы новый стол в буклете не требовал правок
 * здесь: добавили таблицу в данные — появилась кнопка. Название слева,
 * кость справа, как в эталоне. */
function buildButtons() {
  const box = $('tables');
  box.innerHTML = '';
  for (const g of GROUPS) {
    const items = TABLES.filter(t => t.group === g);
    if (!items.length) continue;
    box.appendChild(el('div', 'group', g));
    for (const t of items) {
      const b = el('button', 'tbtn');
      b.appendChild(el('code', null, t.id));       /* первый child — id: так его ищут тесты */
      b.appendChild(el('span', null, RU[t.id] || t.id));
      b.appendChild(el('span', 'tdie', (T[t.id] && T[t.id].die) || ''));
      b.onclick = () => doRoll(t.id);
      box.appendChild(b);
    }
  }
  const feet = el('div', 'group', 'Поиск потайной двери');
  const wrap = el('div', 'row');
  const inp = el('input');
  inp.type = 'number';
  inp.min = '0';
  inp.step = '10';
  inp.value = '30';
  inp.id = 'secretFeet';
  inp.title = 'Футов стены: бросок 1-из-12 за каждые 10 футов';
  const go = el('button', 'tbtn');
  go.appendChild(el('code', null, 'secret'));
  go.appendChild(el('span', null, 'стена, футов'));
  go.onclick = () => doRoll('secret', { feet: inp.value });
  wrap.appendChild(inp);
  wrap.appendChild(go);
  box.appendChild(feet);
  box.appendChild(wrap);
}

function bind() {
  $('start').onclick = startDungeon;
  if ($('litTorch')) $('litTorch').onclick = () => doLight('torch');
  if ($('litLantern')) $('litLantern').onclick = () => doLight('lantern');
  if ($('litMirror')) $('litMirror').onclick = () => doLight('mirror');
  if ($('litOff')) $('litOff').onclick = () => doLight('off');
  $('clear').onclick = () => {
    cancelChain('очистка');
    $('log').innerHTML = '';
    clearCardNodes();
    log('Журнал очищен.', 'hint');
  };
  $('save').onclick = doSave;
  $('load').onclick = doLoad;
  $('export').onclick = doExport;
  const ch = $('chain');
  if (ch) {
    state.chain.on = !!ch.checked;
    ch.onchange = e => {
      state.chain.on = !!e.target.checked;
      state.chain.steps = 0;
      if (state.chain.on) setChainStatus('готова — нажмите «Начать генерацию»');
      else cancelChain(null);
    };
  }
}

/* «Начать»: чистая партия. При включённой автоцепочке сразу бросаем 4-51 и
 * дальше идём по подсказкам, как startDungeon() в эталоне. */
function startDungeon() {
  cancelChain(null);
  newRun($('seed').value, $('level').value);
  if (state.chain.on) {
    state.chain.steps = 0;
    doRoll('4-51', null, true);
  }
}

/* --- бросок -------------------------------------------------------------- */
/* auto = true — шаг автоцепочки (не отменяет её и продолжает); иначе ручной
 * бросок мастера, который цепочку останавливает. */
function doRoll(id, opts, auto) {
  if (auto !== true) cancelChain('ручной бросок');
  let card;
  try {
    card = state.flow.roll(id, opts);
  } catch (e) {
    log('Ошибка броска: ' + e.message, 'err');
    cancelChain('ошибка');
    return;
  }
  draw(card);
  autoScroll();
  if (auto === true) scheduleNext(card);
}

/* Решение мастера: подтип изгиба, форма перекрёстка или вид входа. Оно не
 * отменяет цепочку — после выбора цепочка (если включена) продолжается. */
function doResolve(key, sourceCard) {
  cancelChain(null);
  let card;
  try {
    card = state.flow.resolve(key, sourceCard);
  } catch (e) {
    log('Ошибка: ' + e.message, 'err');
    return;
  }
  draw(card);
  autoScroll();
  if (state.chain.on) scheduleNext(card);
}

/* --- время и свет ------------------------------------------------------- */
function doLight(kind) {
  let card;
  try { card = state.flow.lightSource(kind); }
  catch (e) { log('Свет: ' + e.message, 'err'); return; }
  draw(card);
  updateLight();
  autoScroll();
}

function updateLight() {
  const st = state.flow.state;
  const L = T.lights[st.light.kind] || T.lights.none;
  if ($('timeNow')) $('timeNow').textContent = Math.round(st.minutes) + ' мин (' + st.turns + ' ходов)';
  if ($('lightNow')) {
    $('lightNow').textContent = st.light.kind === 'none'
      ? 'нет (темнота)'
      : L.ru + ', осталось ' + Math.round(st.light.minutesLeft) + ' мин; радиус ' + L.radius +
        (L.half ? ' (полукруг)' : '') + ', отражения ' + L.reflect;
  }
  if ($('stockNow')) $('stockNow').textContent = 'факелы ' + st.stock.torches + ', масло ' + st.stock.oil;
}

/* --- автоцепочка --------------------------------------------------------- */
function setChainStatus(text) {
  const a = $('chainState');
  if (a) a.textContent = text;
  const b = $('chainNow');
  if (b) b.textContent = text ? '· ' + text : '';
}

function cancelChain(reason) {
  if (state.chain.timer) { clearTimeout(state.chain.timer); state.chain.timer = null; }
  state.chain.steps = 0;
  if (reason) setChainStatus(state.chain.on ? 'остановлена: ' + reason : 'выключена');
  else if (!state.chain.on) setChainStatus('выключена');
}

/* Планирует следующий шаг цепочки по карточке. Останавливается на решении
 * мастера, на конце маршрута и на предохранителе. */
function scheduleNext(card) {
  if (!state.chain.on) return;
  if (card.choice) { setChainStatus('ждёт решения мастера'); return; }
  /* монстр/встреча: цепочка встаёт, пока мастер не разберётся */
  if (card.halt) { setChainStatus('остановлена: монстр — ждёт мастера'); return; }
  if (!card.next || !card.next.length) { setChainStatus('остановлена: дальше некуда'); return; }
  if (state.chain.steps >= state.chain.limit) {
    setChainStatus('остановлена: предел ' + state.chain.limit + ' шагов');
    log('Автоцепочка остановлена после ' + state.chain.limit +
        ' шагов подряд. Продолжите вручную кнопкой «далее вероятно».', 'hint');
    return;
  }
  const id = card.next[0];
  setChainStatus('идёт… ' + id);
  state.chain.timer = setTimeout(() => {
    state.chain.steps++;
    doRoll(id, null, true);
  }, state.chain.delay);
}

/* --- карточка ------------------------------------------------------------ */
/* Узлы карточек по номеру: решение мастера переписывает ту же карточку, и
 * если бы draw() всегда добавлял узел, в журнале появился бы визуальный дубль
 * «4-54» или «вход», хотя движок новую карточку не создавал. */
const cardNodes = {};

function clearCardNodes() {
  for (const k of Object.keys(cardNodes)) delete cardNodes[k];
}

function draw(card) {
  const c = el('div', ('card ' + category(card.table)).trim());
  const head = el('div', 'head');
  head.appendChild(el('span', 'n', '#' + card.n));
  head.appendChild(el('code', 'tid', RU.SHORT[card.table] || card.table));
  head.appendChild(el('span', 'ttl', card.title));
  head.appendChild(el('span', 'lvl', 'ур. ' + card.level));
  c.appendChild(head);

  const dice = el('div', 'dice');
  for (const r of card.rolls) {
    const chip = el('span', 'chip');
    chip.appendChild(el('b', null, r.f));
    chip.appendChild(el('span', 'eq', '='));
    chip.appendChild(el('b', 'tot', String(r.t)));
    chip.title = r.d.length > 90 ? r.d.slice(0, 90) + '…' : r.d;
    dice.appendChild(chip);
  }
  c.appendChild(dice);

  const body = el('div', 'body');
  for (const l of card.lines) body.appendChild(el('div', 'line', l));
  if (card.warn) body.appendChild(el('div', 'warn', '⚠ ' + card.warn));
  if (card.chosen) body.appendChild(el('div', 'chose', '\u2713 ' + card.chosen));
  c.appendChild(body);

  if (card.choice) {
    const ch = el('div', 'choice');
    ch.appendChild(el('div', 'clabel', 'Решение мастера:'));
    for (const o of card.choice) {
      const b = el('button', 'cbtn', o.label);
      /* запрещённый вариант гасим, но оставляем видимым с причиной — иначе
       * мастер не поймёт, почему в центральную камеру нельзя войти */
      if (o.disabled) { b.setAttribute('disabled', 'disabled'); b.className = 'cbtn off'; }
      b.onclick = () => { if (!o.disabled) doResolve(o.key, card); };
      ch.appendChild(b);
    }
    c.appendChild(ch);
  }

  if (card.next && card.next.length) {
    const nx = el('div', 'next');
    nx.appendChild(el('span', 'nlabel', 'далее вероятно:'));
    for (const id of card.next) {
      const b = el('button', 'nbtn', id);
      b.title = RU[id] || id;
      b.onclick = () => doRoll(id);
      nx.appendChild(b);
    }
    c.appendChild(nx);
  }

  /* («Комната выглядит пустой» — обыскать можно всегда, тратя ход.)
   * Обыск — на КАЖДОЙ карточке: постоянное присутствие ничего не выдаёт. */
  {
    const row = el('div', 'next');
    const b = el('button', 'nbtn search', 'обыскать');
    b.title = 'Обыскать комнату или монстра — занимает ход';
    b.onclick = () => doRoll('loot');
    row.appendChild(b);
    c.appendChild(row);
  }

  /* Оракул по требованию: только для элементов, где он уместен. */
  const preset = oracleFor(card.table);
  if (preset) {
    const row = el('div', 'next');
    const b = el('button', 'nbtn oracle', 'оракул: ' + preset.map(k => RU.SHORT[k] || k).join(' + '));
    b.title = 'Подсказки Booklet 10 для этого элемента';
    b.onclick = () => doOracle(card.table);
    row.appendChild(b);
    c.appendChild(row);
  }

  const prev = cardNodes[card.n];
  if (prev && prev.parentNode) prev.parentNode.replaceChild(c, prev);
  else $('log').appendChild(c);
  cardNodes[card.n] = c;
  $('count').textContent = state.flow.cards.length;
  updateLight();
}

/* Оракул по требованию: для стола карточки — свой пресет (комната/проход/...).
 * Ничего не бросается, пока мастер не нажмёт. */
function doOracle(table) {
  let card;
  try {
    card = state.flow.oraclePreset(table);
  } catch (e) {
    log('Оракул: ' + e.message, 'err');
    return;
  }
  draw(card);
  autoScroll();
}

function log(text, cls) {
  const c = el('div', 'card ' + (cls || ''));
  c.appendChild(el('div', 'line', text));
  $('log').appendChild(c);
  autoScroll();
}

function autoScroll() {
  const l = $('log');
  if (l) l.scrollTop = l.scrollHeight;
}

/* --- уровень, зерно, партия --------------------------------------------- */
function clampLevel(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 1 : Math.max(1, Math.min(12, n));
}

function newRun(seed, level) {
  state.level = clampLevel(level || $('level').value || 1);
  state.seed = seed === undefined ? $('seed').value : seed;
  $('level').value = state.level;
  $('seed').value = state.seed;
  state.flow = new Flow({ seed: state.seed || undefined, level: state.level });
  $('log').innerHTML = '';
  clearCardNodes();
  $('count').textContent = '0';
  $('seedNow').textContent = String(state.flow.rng.rawSeed);
  /* стартовый запас света — из полей (ввод вручную) */
  const kind = $('lightKind') ? $('lightKind').value : 'torch';
  const tl = T.lights[kind];
  state.flow.state.stock.torches = Math.max(0, parseInt($('torches') && $('torches').value, 10) || 0);
  state.flow.state.stock.oil = Math.max(0, parseInt($('oil') && $('oil').value, 10) || 0);
  state.flow.state.light = { kind: 'none', minutesLeft: 0 };
  if (tl && tl.fuel === 'torch' && state.flow.state.stock.torches > 0) {
    state.flow.state.stock.torches--; state.flow.state.light = { kind: kind, minutesLeft: tl.burn };
  } else if (tl && tl.fuel === 'oil' && state.flow.state.stock.oil > 0) {
    state.flow.state.stock.oil--; state.flow.state.light = { kind: kind, minutesLeft: tl.burn };
  }
  updateLight();
  log('Уровень ' + state.level + '. Зерно: ' + state.flow.rng.rawSeed, 'hint');
  log('Вход в подземелье — таблица 4-51. Дальше решаете вы.', 'hint');
}

/* --- сохранение ---------------------------------------------------------- */
function doSave() {
  const json = JSON.stringify(state.flow.toJSON());
  download('dungeon-' + state.level + '-' + Date.now() + '.json', json, 'application/json');
}

function doExport() {
  download('dungeon-' + state.level + '.txt', asText(), 'text/plain');
}

function asText() {
  const out = [];
  out.push('ПОДЗЕМЕЛЬЕ, УРОВЕНЬ ' + state.level);
  out.push('Зерно: ' + state.flow.rng.rawSeed);
  out.push('');
  for (const c of state.flow.cards) {
    out.push('#' + c.n + '  ' + c.table + ' — ' + c.title);
    if (c.rolls.length) out.push('    ' + c.rolls.map(r => r.f + ' = ' + r.t).join('; '));
    for (const l of c.lines) out.push('    ' + l);
    if (c.warn) out.push('    ! ' + c.warn);
    out.push('');
  }
  return out.join('\n');
}

function doLoad() {
  const inp = el('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        cancelChain('загрузка');
        state.flow.restore(JSON.parse(fr.result));
        state.level = state.flow.level;
        $('level').value = state.level;
        $('seed').value = state.flow.rng.rawSeed;
        $('log').innerHTML = '';
        clearCardNodes();
        for (const c of state.flow.cards) draw(c);
        $('count').textContent = state.flow.cards.length;
        updateLight();
        log('Партия загружена.', 'hint');
      } catch (e) {
        log('Не удалось прочитать файл: ' + e.message, 'err');
      }
    };
    fr.readAsText(f);
  };
  inp.click();
}

function download(name, text, mime) {
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

if (typeof module !== 'undefined') {
  module.exports = { init, doRoll, doResolve, newRun, asText, state, category };
} else {
  document.addEventListener('DOMContentLoaded', init);
}
