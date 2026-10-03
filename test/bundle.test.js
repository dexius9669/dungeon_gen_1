/* Тест СОБРАННОГО Dungeon_Gen.html в mock-окружении.
 *
 * Проверять src/ui/app.js отдельно бессмысленно: он рассчитан на реальный
 * DOM, а ломается всё на склейке (не тот id, потерян onclick, модуль не
 * попал в бандл). Поэтому берём файл, вытаскиваем из него <script> и
 * выполняем в поддельном документе — ровно то, что сделает браузер.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'Dungeon_Gen.html');
const { TABLES } = require(path.join(ROOT, 'src', 'engine', 'flow.js'));

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

/* --- mock DOM ------------------------------------------------------------ */
function El(tag) {
  return {
    tag: tag || 'div', id: '', children: [], className: '', textContent: '', title: '',
    onclick: null, onchange: null, type: '', accept: '', value: '', checked: false,
    files: [], scrollTop: 0, scrollHeight: 0, _html: '',
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    click() { if (typeof this.onclick === 'function') this.onclick(); },
    /* решение мастера перерисовывает ту же карточку: без replaceChild в
     * заглушке нельзя проверить, что в журнале не появляется дубль */
    get parentNode() { return this.parent; },
    replaceChild(next, prev) {
      const p = prev.parent;
      if (!p) throw new Error('replaceChild: узел не привязан');
      const i = p.children.indexOf(prev);
      if (i < 0) throw new Error('replaceChild: узла нет в родителе');
      p.children[i] = next;
      next.parent = p;
    },
    setAttribute() {},
    all() {
      const out = [];
      (function walk(n) { for (const c of n.children) { out.push(c); walk(c); } })(this);
      return out;
    },
    byClass(cls) { return this.all().filter(n => String(n.className || '').split(' ').includes(cls)); },
    text() { return this.all().map(n => n.textContent || '').join('\n'); }
  };
}

const IDS = ['level', 'seed', 'start', 'clear', 'save', 'load', 'export',
             'tables', 'log', 'count', 'seedNow', 'chain', 'chainState', 'chainNow',
             'torches', 'oil', 'lightKind', 'timeNow', 'lightNow', 'stockNow',
             'litTorch', 'litLantern', 'litMirror', 'litOff'];
const byId = {};
for (const id of IDS) byId[id] = El('div');

let lastBlob = null;
class BlobMock {
  constructor(parts) { this.parts = parts; this.text = parts.join(''); lastBlob = this; }
}

/* Управляемые таймеры. С реальным setTimeout тест автоцепочки ждал бы по 600 мс
 * на шаг; здесь очередь, которую мы проигрываем вручную и детерминированно. */
const clock = { queue: [], nextId: 1 };
function fakeSetTimeout(fn, ms) {
  const id = clock.nextId++;
  clock.queue.push({ id, fn, ms });
  return id;
}
function fakeClearTimeout(id) {
  const i = clock.queue.findIndex(t => t.id === id);
  if (i >= 0) clock.queue.splice(i, 1);
}
/* проиграть РОВНО один запланированный шаг (самый ранний) */
function tick() {
  if (!clock.queue.length) return false;
  const t = clock.queue.shift();
  t.fn();
  return true;
}
/* проиграть всё, что запланировано, но не больше limit шагов */
function drain(limit) {
  let n = 0;
  while (clock.queue.length && n < (limit || 500)) { clock.queue.shift().fn(); n++; }
  return n;
}

const html = fs.readFileSync(HTML_FILE, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('  FAIL в файле нет <script>'); process.exit(1); }
const script = m[1];

const ctx = {
  document: {
    getElementById: id => byId[id] || null,
    createElement: t => El(t),
    addEventListener: () => {}
  },
  location: { search: '' },
  Blob: BlobMock,
  URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
  URLSearchParams,
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, console
};

console.log('== собранный файл ==');
{
  check('есть doctype и русский lang', /<!DOCTYPE html>/i.test(html) && /lang="ru"/.test(html));
  check('нет ни одной карты: ни <svg>, ни renderMap, ни #mapwrap',
    !/<svg/i.test(html) && !/renderMap/.test(html) && !/mapwrap/.test(html));
  /* Проверяем ДАННЫЕ о сетке, а не прозу: в комментарии «42×54» упомянуть
   * можно, параметров cols/rows/feetPerSquare в файле быть не должно. */
  check('в файле нет параметров сетки (cols/rows/feetPerSquare)',
    !/\bcols:\s*\d/.test(html) && !/\brows:\s*\d\d/.test(html) && !/feetPerSquare/.test(html));
  check('есть тёмная тема', /--bg:\s*#111827/.test(html));

  /* Правовые уведомления обязаны ехать вместе с автономным файлом: адаптация
   * текста/таблиц идёт по CC-BY-4.0, нужны атрибуция, ссылка на лицензию и
   * Restricted-оговорка. */
  check('в <title> нет чужих торговых марок',
    !/OD&amp;D|OD&D|Dungeons ?&amp; ?Dragons|AD&amp;D/.test((html.match(/<title>[\s\S]*?<\/title>/) || [''])[0]));
  check('есть copyright notice источника',
    /Midwest Fantasy Wargame: The Primeval RPG/.test(html) && /Rod Hampton/.test(html));
  check('есть ссылка на CC-BY-4.0', /creativecommons\.org\/licenses\/by\/4\.0/.test(html));
  check('есть Restricted-оговорка', /Restricted Material/.test(html));
  check('панель старта выше панели времени и света',
    html.indexOf('Уровень подземелья') < html.indexOf('Время и свет'));
  check('указано, что изображения оригинала не используются',
    /Изображения оригинала не\s+используются|No source imagery/.test(html));
}

console.log('\n== запуск в mock DOM ==');
vm.runInNewContext(script, ctx, { filename: 'Dungeon_Gen.html' });

check('скрипт отработал без исключений', true);
check('в журнале есть стартовая подсказка', byId.log.children.length >= 1);
check('зерно партии показано', /^\d+$/.test(String(byId.seedNow.textContent)),
  JSON.stringify(byId.seedNow.textContent));

console.log('\n== кнопки столов ==');
const btns = byId.tables.byClass('tbtn');
check('кнопка на каждый стол буклета + поиск по стене',
  btns.length === TABLES.length + 1, btns.length + ' вместо ' + (TABLES.length + 1));

function btnFor(id) {
  return btns.find(b => b.children[0] && b.children[0].textContent === id);
}
const missing = TABLES.filter(t => !btnFor(t.id)).map(t => t.id);
check('для каждой таблицы из TABLES есть кнопка', missing.length === 0, missing.join(','));

console.log('\n== бросок по кнопке ==');
btnFor('4-51').click();
check('счётчик стал 1', String(byId.count.textContent) === '1', byId.count.textContent);
const card1 = byId.log.children[byId.log.children.length - 1];
check('в карточке есть номер стола', card1.byClass('tid')[0].textContent === '4-51');
check('в карточке видны кости', card1.byClass('chip').length >= 1);
check('в карточке есть текст результата', card1.byClass('line').length >= 1);

btnFor('4-52').click();
check('второй бросок добавил карточку', String(byId.count.textContent) === '2');
check('у 4-52 есть подсказка «далее вероятно»',
  byId.log.children[byId.log.children.length - 1].byClass('nbtn').length >= 1);

console.log('\n== изгиб: решение мастера ==');
byId.seed.value = 'bend';
byId.start.click();
check('«Начать» очистил журнал', String(byId.count.textContent) === '0');
let bendCard = null;
for (let i = 0; i < 30 && !bendCard; i++) {
  btnFor('4-54').click();
  const c = byId.log.children[byId.log.children.length - 1];
  if (c.byClass('cbtn').length) bendCard = c;
}
check('изгиб спрашивает решение мастера', !!bendCard);
if (bendCard) {
  const before = Number(byId.count.textContent);
  bendCard.byClass('cbtn')[0].click();
  /* Решение мастера дописывается в ту же карточку. Раньше появлялась вторая с
   * тем же заголовком — в журнале это читалось как «две карточки 4-54». */
  check('решение дописано в ту же карточку, а не создало вторую',
    Number(byId.count.textContent) === before);
  /* карточка перерисована, поэтому bendCard — уже отсоединённый узел;
   * берём свежий по той же позиции */
  const drawn = byId.log.children[byId.log.children.length - 1];
  check('принятый выбор виден в карточке',
    drawn.byClass('chose').length === 1,
    drawn.byClass('chose')[0] ? drawn.byClass('chose')[0].textContent : 'нет отметки');
  check('старая нода карточки отсоединена — дубля в журнале нет',
    byId.log.all().filter(n => n.byClass('cbtn').length).length === 0 ||
    byId.log.children.length === Number(byId.count.textContent),
    byId.log.children.length + ' узлов на ' + byId.count.textContent + ' карточек');
  check('в выборе было два варианта', bendCard.byClass('cbtn').length === 2);
}

console.log('\n== каверна определяется типом комнаты, а не галочкой ==');
{
  /* Раньше был чекбокс «каверна»: мастер вручную отмечал, что 4-59 надо
   * бросать по правилам каверны. Теперь это знает движок (shape комнаты),
   * а чекбокса в интерфейсе нет. */
  check('в собранном HTML нет чекбокса каверны', !/id="cavern"/.test(html));

  /* Booklet 4-59: у нерегулярной каверны своё правило (1-из-6 монстр, иначе
   * пусто). Карточка 4-59 обязана явно пойти по каверной ветке. */
  let found = false, ok = true;
  for (let i = 0; i < 200 && !found; i++) {
    byId.seed.value = 'cav' + i;
    byId.start.click();
    btnFor('4-56').click();
    const room = byId.log.children[byId.log.children.length - 1];
    if (/каверна/.test(room.text())) {
      found = true;
      btnFor('4-59').click();
      const card = byId.log.children[byId.log.children.length - 1];
      if (!/Каверна/.test(card.text())) ok = false;
    }
  }
  check('каверна идёт по правилу каверны в 4-59',
    found && ok, found ? (ok ? '' : 'ветка не помечена') : 'не нашлась');
}

console.log('\n== поиск потайной двери ==');
byId.seed.value = 'sec';
byId.start.click();
const feet = byId.tables.all().find(n => n.id === 'secretFeet');
check('поле для футов есть', !!feet);
feet.value = '120';
const secretBtn = btns[btns.length - 1];
secretBtn.click();
check('120 футов стены = 12 попыток', /12 попыток/.test(byId.log.children[byId.log.children.length - 1].text()));
check('12 бросков двери (+ кость хода)', (() => {
  const chips = byId.log.children[byId.log.children.length - 1].byClass('chip');
  return chips.filter(ch => /1\/12/.test(ch.text())).length === 12;
})());

console.log('\n== выгрузка и сохранение ==');
byId.export.click();
check('экспорт отдаёт читаемый текст партии',
  lastBlob && /^ПОДЗЕМЕЛЬЕ, УРОВЕНЬ 1/.test(lastBlob.text) && /#1\s+secret/.test(lastBlob.text),
  lastBlob ? lastBlob.text.slice(0, 60) : 'нет блоба');
byId.save.click();
let payload = null;
try { payload = JSON.parse(lastBlob.text); } catch (e) { payload = null; }
check('сохранение — валидный JSON с нашим форматом',
  payload && payload.format === 'dungeon-flow/2');
check('в сохранении есть карточки и состояние генератора',
  payload && Array.isArray(payload.cards) && payload.cards.length > 0 &&
  payload.rng && typeof payload.rng.state === 'number');

console.log('\n== РЕГРЕСС: кликаем «далее вероятно» до комнаты ==');
{
  /* Именно этот сценарий прислал пользователь: он кликал подсказки и ни разу
   * не увидел 4-56. Раньше подсказки зацикливались на 4-52 <-> 4-54, потому
   * что next был статическим. Здесь идём ТОЛЬКО по кнопкам «далее вероятно»,
   * как мастер в браузере, и ждём проверку комнаты. */
  byId.seed.value = 'walk2';
  byId.level.value = '1';
  byId.start.click();

  /* последняя КАРТОЧКА, а не последний элемент: в журнале вперемешку с карточками
   * лежат подсказки «Уровень 1. Зерно…», у них нет метки стола */
  function lastCard() {
    for (let i = byId.log.children.length - 1; i >= 0; i--) {
      if (byId.log.children[i].byClass('tid').length) return byId.log.children[i];
    }
    return null;
  }
  function step() {
    const n = lastCard().byClass('nbtn');
    if (!n.length) return false;
    n[0].click();
    return true;
  }
  /* выбираем ветку, если карточка её требует (вход, изгиб, форма перекрёстка) */
  function pickIfAsked() {
    const c = lastCard().byClass('cbtn');
    if (c.length) { c[c.length - 1].click(); return true; }
    return false;
  }

  /* первый бросок мастер делает сам: журнал пуст, идти по подсказкам не от чего */
  btnFor('4-51').click();

  const seen = [];
  let reachedRoom = false, steps = 0, stuck = false;
  for (; steps < 120; steps++) {
    if (!step()) { stuck = true; break; }
    pickIfAsked();
    const t = lastCard().byClass('tid')[0].textContent;
    seen.push(t);
    if (t === '4-56' || t === 'проверка') { reachedRoom = true; break; }
  }
  check('подсказки не зациклились (пропали дальше 120 кликов)', !stuck, stuck ? 'застряли' : '');
  check('комната достигнута без ручного вмешательства', reachedRoom,
    'порядок: ' + seen.slice(0, 14).join(' '));
  check('вход идёт сразу после 4-51', seen.indexOf('вход') === seen.indexOf('4-51') + 1,
    seen.slice(0, 6).join(' '));
  check('вход разыгран автоматически — карточка «вход» есть', seen.includes('вход'));
  /* Раскрытие по ходу: ни числа лестниц (4-60), ни самих лестниц заранее нет. */
  check('предразметки 4-60 и лестниц до исследования нет',
    !seen.includes('4-60') && !seen.includes('лестница'), seen.slice(0, 10).join(' '));
  check('4-52 не появляется раньше входа',
    seen.indexOf('4-52') === -1 || seen.indexOf('4-52') > seen.indexOf('вход'));
  check('за один проход сделано разумное число бросков',
    steps >= 1 && steps < 100, String(steps));

  /* Регресс из отчёта пользователя: он вручную бросал 4-58 в комнате с одним
   * выходом, потому что подсказка предлагала новые выходы тупику. Выходы камеры
   * нумеруются по 4-55, а содержимое наступает только после последнего 4-58. */
  const chamber = seen.filter(t => t === '4-58').length;
  const stock = seen.indexOf('4-59');
  check('камера: выходы пронумерованы до содержимого',
    chamber === 0 || stock === -1 || seen.lastIndexOf('4-58') < stock,
    '4-58 x' + chamber + ', 4-59 на позиции ' + stock);
  check('4-59 не предлагался, пока есть ненумерованные выходы',
    stock === -1 || seen.slice(0, stock).filter(t => t === '4-58').length === chamber,
    '4-58 до 4-59: ' + seen.slice(0, stock).filter(t => t === '4-58').length);
}

console.log('\n== категории карточек (цвет как в DB) ==');
{
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
  byId.seed.value = 'cat';
  byId.start.click();
  const cat = (id) => { btnFor(id).click(); return byId.log.children[byId.log.children.length - 1].className; };
  check('проход красится passage-box', /passage-box/.test(cat('4-51')));
  check('комната красится room-box', /room-box/.test(cat('4-56')));
  check('монстр красится monster-box', /monster-box/.test(cat('4-62')));
  check('сокровище красится treasure-box', /treasure-box/.test(cat('4-63')));
  check('диковинка красится trick-box', /trick-box/.test(cat('oddity')));
  check('кнопка стола показывает кость', /2d6/.test(btnFor('4-60').children[2].textContent),
    btnFor('4-60').children[2].textContent);
}

console.log('\n== автоцепочка ==');
{
  byId.chain.checked = true; byId.chain.onchange({ target: { checked: true } });
  byId.seed.value = 'chain';
  byId.start.click();                        /* при вкл. цепочке старт сам бросает 4-51 */
  const autoSteps = drain(200);
  const last = byId.log.children[byId.log.children.length - 1];
  const lastTid = last.byClass('tid')[0].textContent;
  check('цепочка прошла несколько шагов сама', autoSteps > 3, 'шагов=' + autoSteps);
  check('цепочка остановилась на решении мастера',
    last.byClass('cbtn').length > 0, 'последняя=' + lastTid);
  check('после остановки таймеров не осталось', clock.queue.length === 0);
  check('статус сообщает про решение', /решени/.test(String(byId.chainState.textContent)),
    String(byId.chainState.textContent));

  /* решение мастера продолжает цепочку */
  const before = Number(byId.count.textContent);
  const pick = last.byClass('cbtn').find(b => !/ off/.test(String(b.className)));
  pick.click();
  const resumed = drain(200);
  check('после решения цепочка продолжилась', Number(byId.count.textContent) > before,
    before + ' -> ' + byId.count.textContent);
  check('цепочка соблюдает предел и не крутится вечно', resumed <= 201, 'шагов=' + resumed);
  check('цепочка снова встала (решение/предел)',
    clock.queue.length === 0 || /решени|предел|некуда/.test(String(byId.chainState.textContent)),
    String(byId.chainState.textContent));

  /* ручной бросок останавливает цепочку */
  byId.chain.checked = true; byId.chain.onchange({ target: { checked: true } });
  byId.seed.value = 'chain2';
  byId.start.click();
  tick();                                    /* один шаг цепочки */
  const queuedBefore = clock.queue.length;
  btnFor('4-51').click();                    /* ручной бросок */
  check('ручной бросок отменяет автоцепочку',
    queuedBefore > 0 && clock.queue.length === 0, 'было=' + queuedBefore + ' стало=' + clock.queue.length);
  check('статус сообщает про ручной бросок', /ручной/.test(String(byId.chainState.textContent)),
    String(byId.chainState.textContent));

  /* выключение цепочки: «Начать» больше не бросает сам */
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
  byId.seed.value = 'chainOff';
  byId.start.click();
  const offSteps = drain(50);
  check('при выключенной цепочке «Начать» не бросает сам',
    offSteps === 0 && String(byId.count.textContent) === '0', 'шагов=' + offSteps);
}

console.log('\n== Оракул в интерфейсе ==');
{
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
  byId.seed.value = 'oracle-ui';
  byId.start.click();

  check('есть кнопка оракула', !!btnFor('oracle-an'));
  const groups = byId.tables.byClass('group').map(g => g.textContent);
  check('в сайдбаре есть раздел «Оракул»', groups.indexOf('Оракул') !== -1, groups.join(', '));

  const before = Number(byId.count.textContent);
  btnFor('oracle-an').click();
  check('кнопка оракула добавляет карточку', Number(byId.count.textContent) === before + 1);
  const last = byId.log.children[byId.log.children.length - 1];
  check('карточка оракула на русском', /Описание|Действие|Вопрос|Оракул/.test(last.text()));

  /* По требованию: на карточке комнаты есть кнопка, и она бросает оракул. */
  byId.seed.value = 'oracle-card';
  byId.start.click();
  btnFor('4-56').click();
  const room = byId.log.children[byId.log.children.length - 1];
  const orc = room.byClass('oracle');
  check('на карточке комнаты есть кнопка оракула', orc.length === 1);
  if (orc.length) {
    const n0 = Number(byId.count.textContent);
    orc[0].click();
    check('оракул с карточки добавляет карточку', Number(byId.count.textContent) === n0 + 1);
  }
}

console.log('\n== обыск: глобальное действие, не на карточке ==');
{
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
  byId.seed.value = 'loot-ui';
  byId.torches.value = '6'; byId.oil.value = '2'; byId.lightKind.value = 'torch';
  byId.start.click();
  check('глобальной кнопки обыска нет (обыск — из карточки)', !btnFor('loot'));
  check('панель времени показана', /\d+ мин \(\d+ ходов\)/.test(String(byId.timeNow.textContent)),
    String(byId.timeNow.textContent));
  check('свет показан', /Факел|Фонарь|темнота/.test(String(byId.lightNow.textContent)),
    String(byId.lightNow.textContent));
  check('запас света показан', /факелы \d+, масло \d+/.test(String(byId.stockNow.textContent)),
    String(byId.stockNow.textContent));
  /* зажигаем фонарь: расход масла, смена источника */
  byId.litLantern.click();
  check('кнопка «Фонарь» включает фонарь', /Фонарь/.test(String(byId.lightNow.textContent)),
    String(byId.lightNow.textContent));
  byId.litOff.click();
  check('кнопка «Погасить» даёт темноту', /темнота/.test(String(byId.lightNow.textContent)),
    String(byId.lightNow.textContent));
  btnFor('4-56').click();
  const room = byId.log.children[byId.log.children.length - 1];
  check('на карточке комнаты есть кнопка обыска', room.byClass('search').length === 1);
}

console.log('\n== очистка ==');
byId.clear.click();
check('очистка оставляет одну подсказку', byId.log.children.length === 1);

console.log('\n== итог ==');
console.log('\n== оракул не ломает решение мастера ==');
{
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
  byId.seed.value = 'orc-choice';
  byId.torches.value = '6'; byId.oil.value = '2'; byId.lightKind.value = 'torch';
  byId.start.click();
  let bend = null;
  for (let i = 0; i < 80 && !bend; i++) {
    btnFor('4-54').click();
    const c = byId.log.children[byId.log.children.length - 1];
    if (c.byClass('cbtn').length) bend = c;
  }
  check('нашли карточку-решение', !!bend);
  if (bend) {
    if (bend.byClass('oracle').length) bend.byClass('oracle')[0].click();
    bend.byClass('cbtn')[0].click();
    const after = byId.log.text();
    check('решение после оракула не падает',
      !/Нечего решать/.test(after) && /\u2713|✓/.test(after),
      'err=' + /Нечего решать/.test(after));
  }
}

console.log('\n== автоцепочка встаёт на монстре (UI) ==');
{
  let sawMonster = false, tried = 0;
  for (let i = 0; i < 60 && !sawMonster; i++) {
    byId.chain.checked = true; byId.chain.onchange({ target: { checked: true } });
    byId.seed.value = 'hm' + i;
    byId.torches.value = '6'; byId.oil.value = '2'; byId.lightKind.value = 'torch';
    byId.start.click();
    let g = 0;
    while (clock.queue.length && g++ < 400) clock.queue.shift().fn();
    if (/монстр/.test(String(byId.chainState.textContent))) sawMonster = true;
    tried++;
  }
  check('цепочка встаёт на монстре и ждёт мастера', sawMonster, 'сидов перебрано: ' + tried);
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
}

console.log('\n== стартовый запас применяется по кнопке «Начать» ==');
{
  byId.chain.checked = false; byId.chain.onchange({ target: { checked: false } });
  byId.seed.value = 'stock';
  byId.torches.value = '3'; byId.oil.value = '1'; byId.lightKind.value = 'lantern';
  byId.start.click();
  check('старт с фонарём', /Фонарь/.test(String(byId.lightNow.textContent)), String(byId.lightNow.textContent));
  check('стартовое топливо списано (факелы 3, масло 0)',
    /факелы 3, масло 0/.test(String(byId.stockNow.textContent)), String(byId.stockNow.textContent));
  /* смена select посреди партии не меняет текущий свет — только по «Начать» */
  byId.lightKind.value = 'mirror';
  check('смена select не меняет текущий свет',
    /Фонарь/.test(String(byId.lightNow.textContent)), String(byId.lightNow.textContent));
}

console.log('  ok=' + ok + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);