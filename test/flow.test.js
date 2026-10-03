/* Тесты потока таблиц. Проверяем то, что мастер реально увидит:
 * каждый стол бросается без исключений, в тексте нет undefined/NaN,
 * зерно воспроизводит партию, а шансы из буклета срабатывают с нужной частотой. */
'use strict';

const path = require('path');
const { Flow, TABLES } = require(path.join(__dirname, '..', 'src', 'engine', 'flow.js'));
const T = require(path.join(__dirname, '..', 'src', 'data', 'tables.js'));

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const SEEDS = +(process.argv[2] || 300);
const bad = /undefined|NaN|\[object/;

console.log('== детерминизм ==');
{
  const a = new Flow({ seed: 'dungeon-42', level: 3 });
  const b = new Flow({ seed: 'dungeon-42', level: 3 });
  for (const t of TABLES) { a.roll(t.id); b.roll(t.id); }
  check('одно зерно — одинаковый журнал',
    JSON.stringify(a.cards) === JSON.stringify(b.cards));
  const c = new Flow({ seed: 'dungeon-43', level: 3 });
  for (const t of TABLES) c.roll(t.id);
  check('разные зерна — разный журнал',
    JSON.stringify(a.cards) !== JSON.stringify(c.cards));
}

/* Две карточки законно остаются без костей: `entry` — это решение мастера
 * (бросать нечего, буклет даёт выбор), `room-find` при накопленных <100 футов
 * — честный отказ бросать раньше времени. */
const NO_DICE_OK = { entry: 1, 'room-find': 1, loot: 1 };

console.log('\n== все столы бросаются ==');
{
  let thrown = 0, noRolls = 0, dirty = 0, empty = 0;
  for (let s = 0; s < SEEDS; s++) {
    for (const t of TABLES) {
      const f = new Flow({ seed: 's' + s + '-' + t.id, level: 1 + (s % 12) });
      let card;
      try { card = f.roll(t.id, { feet: 10 + s * 7, cavern: s % 3 === 0 }); }
      catch (e) { thrown++; if (thrown < 4) console.log('       ' + t.id + ': ' + e.message); continue; }
      if (!card.rolls.length && !NO_DICE_OK[t.id]) noRolls++;
      if (!card.lines.length) empty++;
      for (const l of card.lines) if (bad.test(l)) { dirty++; if (dirty < 4) console.log('       ' + t.id + ': ' + l); break; }
    }
  }
  check('ни один стол не бросает исключение (' + SEEDS + '×' + TABLES.length + ')', thrown === 0, thrown + ' шт');
  check('у каждой карточки есть кости (кроме решения мастера и ранней проверки)',
    noRolls === 0, noRolls + ' шт');
  check('вход — бросок, а не карточка-решение',
    new Flow({ seed: 'e' }).roll('entry').choice === null);
  check('у каждой карточки есть текст', empty === 0, empty + ' шт');
  check('в тексте нет undefined/NaN', dirty === 0, dirty + ' шт');
}

console.log('\n== изгиб требует решения мастера ==');
{
  let bends = 0, resolved = 0, choices = 0;
  for (let s = 0; s < 400; s++) {
    const f = new Flow({ seed: 'b' + s });
    const c = f.roll('4-54');
    if (!c.choice) continue;
    bends++;
    if (c.choice.length === 2) choices++;
    const r = f.resolve(c.choice[0].key);
    if (r.lines.length && !bad.test(r.lines[0])) resolved++;
  }
  check('изгибы встречаются', bends > 100, bends + ' из 400');
  check('у изгиба ровно два варианта', choices === bends);
  check('решение мастера даёт строку', resolved === bends);
}

console.log('\n== уровень ==');
{
  const f = new Flow({ seed: 'lv', level: 99 });
  check('уровень зажат в 12', f.level === 12);
  const g = new Flow({ seed: 'lv', level: 0 });
  check('уровень зажат в 1', g.level === 1);
  const h = new Flow({ seed: 'lv', level: 9 });
  h.roll('4-62');
  check('высокий уровень честно помечен', /не восстановлен/.test(h.cards[0].warn || ''));
  const k = new Flow({ seed: 'lv', level: 9 });
  k.roll('4-63');
  check('сокровище выше 6 берёт 6-й уровень с пометкой', /восстановлен/.test(k.cards[0].warn || ''));
}

console.log('\n== сохранение и загрузка ==');
{
  const f = new Flow({ seed: 'save-me', level: 4 });
  for (const t of TABLES) f.roll(t.id, { feet: 40 });
  const json = JSON.parse(JSON.stringify(f.toJSON()));
  const g = new Flow({});
  check('restore принимает сохранение', g.restore(json) === true);
  check('карточки совпали', JSON.stringify(g.cards) === JSON.stringify(f.cards));
  const tailF = f.roll('4-51');
  const tailG = g.roll('4-51');
  check('после загрузки бросок продолжает ту же последовательность',
    JSON.stringify(tailF) === JSON.stringify(tailG));

  /* Старое сохранение (формат /1 или /2) не знало entryRoom/entryRoomDone.
   * Они должны добраться из defaultState(), а не остаться undefined. */
  const old = JSON.parse(JSON.stringify(f.toJSON()));
  old.format = 'dungeon-flow/1';
  for (const k of ['entryRoom', 'entryRoomDone', 'roomStocked', 'roomSqFt',
                   'roomCavern', 'odditiesSeen', 'monsterLoot']) {
    delete old.state[k];
  }
  const h = new Flow({});
  h.restore(old);
  check('старое сохранение добирает поля из дефолтов',
    h.state.entryRoom === false && h.state.entryRoomDone === true && h.state.roomStocked === false,
    JSON.stringify({ entryRoom: h.state.entryRoom, done: h.state.entryRoomDone, stocked: h.state.roomStocked }));
  check('odditiesSeen восстановлен как массив', Array.isArray(h.state.odditiesSeen));

  /* глубокая копия: две партии из одного файла не должны делить вложенные
   * массивы карточки */
  const a = new Flow({});
  const b = new Flow({});
  const src = f.toJSON();
  a.restore(src); b.restore(src);
  a.cards[0].lines.push('ЧУЖОЕ');
  check('restore копирует карточки глубоко',
    b.cards[0].lines.indexOf('ЧУЖОЕ') === -1, b.cards[0].lines.join(' | ').slice(0, 60));
}

console.log('\n== шансы из буклета ==');
{
  const N = 3000;

  let spiral = 0, both = 0;
  for (let s = 0; s < N; s++) {
    const t = new Flow({ seed: 'g' + s }).roll('stair-general').lines.join(' ');
    if (/Винтовая/.test(t)) spiral++;
    if (/вверх и вниз/.test(t)) both++;
  }
  check('винтовая лестница ~10%, получилось ' + (spiral / N * 100).toFixed(1) + '%',
    spiral / N > 0.07 && spiral / N < 0.13);
  check('лестница вверх-вниз ~1%, получилось ' + (both / N * 100).toFixed(1) + '%',
    both / N > 0 && both / N < 0.03);

  let found = 0, tries = 0;
  for (let s = 0; s < 600; s++) {
    const f = new Flow({ seed: 'd' + s });
    const c = f.roll('secret', { feet: 120 });
    tries += 12;
    found += +(/Найдено потайных дверей: (\d+)/.exec(c.lines.join(' ')) || [0, 0])[1];
  }
  const rate = found / tries;
  check('потайная дверь ~1-из-12, получилось ' + (1 / rate).toFixed(1) + '-из-1',
    rate > 0.05 && rate < 0.12);
}

console.log('\n== потайные двери на малых стенах ==');
{
  const f = new Flow({ seed: 'e' });
  const c0 = f.roll('secret', { feet: 5 });
  check('меньше 10 футов — ни одного броска', /ни одного броска/.test(c0.lines.join(' ')));
  check('мало футов = ноль костей в карточке', c0.rolls.length === 0);
  const c1 = f.roll('secret', { feet: 100 });
  const doorRolls = c1.rolls.filter(r => /1\/12/.test(r.f)).length;
  check('100 футов = 10 попыток (плюс кость хода)', doorRolls === 10, doorRolls + ' дверных');
}

console.log('\n== числа в тексте приходят из таблиц ==');
{
  /* 4-52: длина секции всегда из таблицы, а не выдуманная */
  const lens = new Set();
  for (let s = 0; s < 600; s++) {
    const l = new Flow({ seed: 'L' + s }).roll('4-52').lines[0];
    lens.add(/\d+/.exec(l)[0] + '|' + (/экстраординарная/.test(l)));
  }
  let sane = true;
  for (const v of lens) {
    const n = +v.split('|')[0];
    if (n !== 10 && n !== 20 && n !== 30 && n !== 40 && n !== 50 && n !== 60 && !(n >= 70 && n <= 140)) sane = false;
  }
  check('длины секций только из 4-52/4-53', sane, [...lens].join(' '));

  /* 4-60: строка «5» даёт 4 лестницы (в книге «5 | 4»). Выше 12 перебрасывается,
   * поэтому в тексте допустимы только значения 4/9/10/14/17 */
  const stairSet = new Set();
  for (let s = 0; s < 600; s++) stairSet.add(new Flow({ seed: 'S' + s }).roll('4-60').lines[0]);
  check('число лестниц только 4/9/10/14/17',
    [...stairSet].every(l => /Лестниц на уровне: (4|9|10|14|17)\b/.test(l)),
    [...stairSet].map(l => /Лестниц на уровне: (\d+)/.exec(l)[1]).join(' '));
}

console.log('\n== ПОРЯДОК: раскрытие по ходу, без предразметки ==');
{
  /* 4-51 -> вход (бросок). Центральная камера и лестницы заранее НЕ бросаются —
   * это отход от буклета ради соло-игры «вслепую». */
  const f = new Flow({ seed: 'order' });
  const a = f.roll('4-51');
  check('после 4-51 — только вход', a.next.join(',') === 'entry', a.next.join(','));

  const e = f.roll('entry');
  const dest = e.next[0];
  check('вход ведёт в камеру, комнату или проход',
    dest === '4-55' || dest === '4-56' || dest === '4-52', dest);
  check('вход — бросок, а не решение', e.choice === null && e.action === null);

  let guard = 0, cur = e;
  const seen = ['4-51', 'entry'];
  while (guard++ < 120 && cur.next && cur.next[0]) {
    cur = f.roll(cur.next[0]);
    seen.push(cur.table);
    if (cur.table === '4-54' || cur.table === '4-52') break;
  }
  check('до исследования не бросаются 4-60 и разметка лестниц',
    seen.indexOf('4-60') === -1 && seen.indexOf('stairway') === -1, seen.join(' -> '));
}

console.log('\n== распределение входа ==');
{
  const N = 3000;
  let cam = 0, room = 0, pass = 0;
  for (let s = 0; s < N; s++) {
    const n = new Flow({ seed: 'ei' + s }).roll('entry').next[0];
    if (n === '4-55') cam++; else if (n === '4-56') room++; else pass++;
  }
  const pc = v => (v / N * 100).toFixed(1) + '%';
  check('вход: центральная камера ~33% (2-из-6)', cam / N > 0.30 && cam / N < 0.37, pc(cam));
  check('вход: комната ~44% (2-из-3 от остатка)', room / N > 0.41 && room / N < 0.48, pc(room));
  check('вход: проход ~22%', pass / N > 0.19 && pass / N < 0.26, pc(pass));
}

console.log('\n== РЕГРЕСС: комната проверяется каждые 100 футов ==');
{
  let early = true, trip = false, sawAt = 0, minGap = 0;
  for (let s = 0; s < 60 && !trip; s++) {
    const f = new Flow({ seed: 'rf' + s });
    let cur = f.roll('4-52');
    let gap = 0;
    for (let i = 0; i < 40; i++) {
      if (cur.next.includes('room-find')) break;
      if (cur.next.includes('4-56')) break;
      gap += +/\d+/.exec(cur.lines[0])[0];
      cur = f.roll('4-54').next.includes('4-52') ? f.roll('4-52') : cur;
    }
    if (cur.next.includes('room-find')) {
      trip = true;
      sawAt = f.state.sinceRoom;
      minGap = gap;
      if (f.state.sinceRoom < 100) early = false;
    }
  }
  check('проверка комнаты предлагается на горизонте партии', trip);
  check('проверка не предлагается раньше 100 футов (выпало на ' + sawAt + ' фт.)', early && sawAt >= 100);

  /* Полный обход: комната найдена -> предлагается 4-56 -> выходы -> содержимое */
  const f = new Flow({ seed: 'rfcycle' });
  let cur = f.roll('4-52'), guard = 0;
  while (!cur.next.includes('room-find') && guard++ < 60) {
    cur = f.roll('4-52');
  }
  const chk = f.roll('room-find');
  check('карточка проверки комнаты ссылается на правило буклета',
    /100 футов|футов — проверок/.test(chk.lines.join(' ')), chk.lines.join(' '));
  check('проверка комнаты при накоплении >=100 фт. ведёт к 4-56',
    chk.next.includes('4-56'), chk.next.join(','));
  const rm = f.roll('4-56');
  check('после 4-56 идут выходы комнаты', rm.next.join(',') === 'room-exits', rm.next.join(','));
  const ex = f.roll('room-exits');
  const wantExits = f.state.exitsLeft > 0;
  check('после числа выходов — 4-58, а для тупика сразу 4-59',
    ex.next.join(',') === (wantExits ? '4-58' : '4-59'),
    ex.next.join(',') + ' (exitsLeft=' + f.state.exitsLeft + ')');
  /* 4-58 бросается по разу на каждый новый выход, а содержимое — только после
   * последнего: счётчик exitsLeft, иначе комната наполняется с недонумерованными
   * выходами */
  let g2 = 0, dr = ex;
  while (dr.next.includes('4-58') && g2++ < 8) dr = f.roll('4-58');
  check('4-58 повторяется на каждый выход, потом содержимое',
    dr.next.includes('4-59') && !dr.next.includes('4-58'), dr.next.join(',') + ' за ' + g2 + ' бросков');
  check('после всех выходов — содержимое 4-59', dr.next.join(',') === '4-59', dr.next.join(','));

  /* Рано проверять нельзя */
  const g = new Flow({ seed: 'rfearly' });
  g.state.sinceRoom = 40;
  const soon = g.roll('room-find');
  check('при <100 фт. проверка отвечает «рано» и не предлагает 4-56',
    /рано/.test(soon.lines.join(' ')) && !soon.next.includes('4-56'), soon.next.join(','));
}

console.log('\n== столкновение прохода: тупик или потайная дверь ==');
{
  let dead = 0;
  const N = 400;
  for (let s = 0; s < N; s++) {
    if (/тупик/.test(new Flow({ seed: 'x' + s }).roll('collision').lines.join(' '))) dead++;
  }
  const pct = dead / N * 100;
  check('столкновение — равные шансы тупика и двери (' + pct.toFixed(1) + '% тупиков)',
    pct > 44 && pct < 56);
  check('после столкновения продолжаем проход',
    new Flow({ seed: 'x' }).roll('collision').next.join(',') === '4-52');
}

console.log('\n== решения мастера в 4-54 ==');
{
  let arm = 0, cross = 0;
  for (let s = 0; s < 300; s++) {
    const c = new Flow({ seed: 'k' + s }).roll('4-54');
    if (/плеч/.test(c.lines.join(' '))) arm++;
    if (/зависит от направления/i.test(c.lines.join(' '))) cross++;
  }
  check('для T/Y выбирается плечо буквы (нашлось на ' + arm + ' сидах)', arm > 0);
  check('для 4-лучевой предлагается форма перекрёстка +/Х (на ' + cross + ' сидах)', cross > 0);

  let diag = 0, n90 = 0;
  for (let s = 0; s < 300; s++) {
    const f = new Flow({ seed: 'm' + s });
    const c = f.roll('4-54');
    if (c.choice && c.action === 'bend') {
      const keys = c.choice.map(x => x.key);
      /* каждая альтернатива — своя партия: карточка выбора одна на партию.
       * В TABLES 4-54 первый вариант — 90°, второй — диагональ. */
      if (/90/.test(new Flow(f.toJSON()).resolve(keys[0]).lines.join(' '))) n90++;
      if (/45/.test(new Flow(f.toJSON()).resolve(keys[1]).lines.join(' '))) diag++;
    }
  }
  check('оба подтипа изгиба разрешаются (диагональ ' + diag + ', 90° ' + n90 + ')',
    diag > 0 && n90 > 0);
}

console.log('\n== состояние партии переживает save/load ==');
{
  const f = new Flow({ seed: 'save', level: 3 });
  f.roll('4-51'); f.roll('4-55'); f.roll('4-60');
  for (let i = 0; i < 3; i++) { f.roll('stair-general'); f.roll('stair-surround'); }
  for (let i = 0; i < 4; i++) f.roll('4-52');
  const before = JSON.stringify(f.toJSON());
  const g = new Flow(JSON.parse(before));
  check('футы пережили сохранение', g.state.feet === f.state.feet, g.state.feet + ' vs ' + f.state.feet);
  check('остаток до проверки комнаты сохранён', g.state.sinceRoom === f.state.sinceRoom);
  check('площадь комнаты сохранена', g.state.roomSqFt === f.state.roomSqFt);
  check('подсказки после загрузки те же',
    JSON.stringify(g.toJSON().cards.map(c => c.next)) === JSON.stringify(f.cards.map(c => c.next)));
}


console.log('\n== РЕГРЕСС: вложенные кости считает машина, не мастер ==');
{
  /* Пользователь получил «1d3 × 250 gp» и был обязан сам умножить. В
   * Dungeon_Gen_DB такие броски выполнялись внутри resolve(): наружу выходила
   * готовая сумма. */
  let instr = 0, sums = [];
  for (let s = 0; s < 3000; s++) {
    const c = new Flow({ seed: 'g' + s, level: 1 }).roll('4-63');
    const l = c.lines[0];
    if (/\d*d\d/i.test(l)) instr++;
    const m = /^(\d[\d\s]*) зм/.exec(l);
    if (m) sums.push(+m[1].replace(/\s/g, ''));
  }
  check('в сокровище не осталось невычисленных костей (0 из 3000)', instr === 0, instr + ' шт');
  check('сумма золота посчитана и лежит в допустимом диапазоне 250–1000',
    sums.length > 1500 && Math.min(...sums) >= 250 && Math.max(...sums) <= 1000,
    'n=' + sums.length + ' min=' + Math.min(...sums) + ' max=' + Math.max(...sums));
  /* 1d3 x 250 -> 250/500/750. Плюс 1 000 зм из отдельной строки 7 на 1d8,
   * и других сумм быть не должно: если множитель не применён, всплыло бы
   * что-то вроде 3 зм или 3 x 250 */
  const uniq = [...new Set(sums)].sort((a, b) => a - b);
  check('1d3 x 250 даёт только 250/500/750 (+1 000 из своей строки)',
    uniq.join(',') === '250,500,750,1000', uniq.join(','));

  let oddInstr = 0, oddSubs = 0;
  for (let s = 0; s < 4000; s++) {
    const c = new Flow({ seed: 'o' + s }).roll('oddity');
    const body = c.lines.join(' ');
    /* «Вероятность 1-из-12» допустимо только если это УЖЕ брошенный шанс,
     * а не оставленная мастеру инструкция: считаем строки с костями, у которых
     * рядом нет слова «шанс». Строки-справки Буклета 2 («HTK 3d6») и подписи
     * явных бросков («Бросок 1d8: 2.») — это правила, а не невычисленный
     * результат, их исключаем. */
    for (const l of c.lines) {
      if (/^\s*Буклет 2/.test(l) || /^Бросок \d*d\d+:/.test(l)) continue;
      if (/\d*d\d/i.test(l) && !/шанс/i.test(l)) { oddInstr++; if (oddInstr < 3) console.log('       ' + l.slice(0, 70)); }
    }
    if (/вариант \d/.test(body)) oddSubs++;
  }
  check('в диковинках не осталось невычисленных костей', oddInstr === 0, oddInstr + ' шт');
  /* подтаблицы есть только у 2 диковинок из 38, поэтому ~5% партий */
  check('подтаблицы диковинок (1d5 разлив, 1d8 газ) разворачиваются',
    oddSubs > 120 && oddSubs < 320, oddSubs + ' из 4000');

  /* падежи: «7 клеток», а не «7 клетоки» */
  const cell = new Flow({ seed: 'p1' });
  cell.state.lastOddity = { ru: 'Щебень (заполняет 3d3 клетки)', sub: null };
  check('падежи после числа согласованы',
    !/\d\s(клетоки|флаконов|ходов)/.test(cell.resolveText('3d3 клетки')) &&
    /\d\sклеток/.test(cell.resolveText('3d3 клетки')),
    cell.resolveText('3d3 клетки'));
}


console.log('\n== РЕГРЕСС: карточка-решение не предлагает «далее вероятно» ==');
{
  /* Пока мастер не выбрал подтип изгиба/форму перекрёстка, следующий шаг
   * неизвестен, и подсказка на карточке решения позволяла проскочить мимо. */
  let bad = 0, checked = 0;
  for (let s = 0; s < 600; s++) {
    const f = new Flow({ seed: 'q' + s });
    for (const id of ['4-54']) {
      const c = f.roll(id);
      if (!c.choice) continue;
      checked++;
      if (c.next.length) bad++;
    }
  }
  check('у карточек-решений нет подсказки (проверено ' + checked + ')', bad === 0, bad + ' шт');

  /* Решение мастера дописывается в ту же карточку и сохраняет выбор. */
  let bc = null;
  for (let s = 0; s < 60 && !bc; s++) {
    const f = new Flow({ seed: 'bend' + s });
    const c = f.roll('4-54');
    if (c.choice) { bc = { f: f, c: c }; }
  }
  if (bc) {
    const before = bc.f.cards.length;
    const r = bc.f.resolve(bc.c.choice[0].key);
    check('решение не создаёт вторую карточку', bc.f.cards.length === before && r.n === bc.c.n,
      'n=' + r.n);
    check('принятый выбор сохранён в карточке', !!r.chosen && !r.choice, JSON.stringify(r.chosen));
  } else check('изгиб/перекрёсток найден для проверки решения', false, 'не найден');
}


console.log('\n== РЕГРЕСС: три дефекта из лога пользователя ==');
{
  /* 1) «For every 100 feet» — проверка за каждый ПОЛНЫЙ сотенный блок.
   * Остаток терялся: 130 футов давали одну проверку и sinceRoom=0, из-за чего
   * уровок систематически недобирал комнат. */
  const f = new Flow({ seed: 'rem' });
  f.state.sinceRoom = 130;
  f.roll('room-find');
  check('остаток футов не теряется (130 -> проверка + 30 в счёт)',
    f.state.sinceRoom === 30, 'sinceRoom=' + f.state.sinceRoom);
  f.state.sinceRoom = 250;
  f.roll('room-find');
  check('250 футов = две проверки, остаток 50',
    f.state.sinceRoom === 50, 'sinceRoom=' + f.state.sinceRoom);

  /* 2) Комната наполняется один раз. Повторный 4-59 выдавал «сокровище» и
   * «пусто» из одной комнаты молча. */
  const g = new Flow({ seed: 'stock' });
  g.roll('4-56'); g.roll('room-exits');
  const first = g.roll('4-59');
  const again = g.roll('4-59');
  check('повторный 4-59 отклонён с предупреждением',
    /уже наполнена/.test(again.lines.join(' ')) && !!again.warn, again.lines[0]);
  check('первый 4-59 отработал нормально', !/уже наполнена/.test(first.lines.join(' ')));
  g.roll('4-56');
  check('новая комната снова наполняется', !/уже наполнена/.test(g.roll('4-59').lines.join(' ')));

  /* 3) Выпавшие 4-58 сверх нужного. В логе мастер бросал «Направление выхода»
   * для комнаты с одним новым выходом, и это проходило без предупреждения. */
  const h = new Flow({ seed: 'ext' });
  h.roll('4-56'); h.roll('room-exits');
  const need = h.state.exitsLeft;
  for (let i = 0; i < need; i++) h.roll('4-58');
  const extra = h.roll('4-58');
  check('лишний 4-58 помечен как сверх нужного',
    /Все выходы пронумерованы/.test(extra.lines.join(' ')) && !!extra.warn,
    extra.lines.join(' | '));
}

console.log('\n== РЕГРЕСС Фазы 1: буклет важнее кода ==');
{
  /* 4-60: в книге «5 → 4». Раньше таблица давала 5 и часть уровней получала
   * лишнюю лестницу. Проверяем обе стороны: 5 даёт 4, и ни одного 5-лестничного
   * результата быть не может. */
  const stairVals = new Set();
  let saw4or5 = { four: 0, five: 0 };
  for (let s = 0; s < 800; s++) {
    const f = new Flow({ seed: 'ST' + s });
    const card = f.roll('4-60');
    const m = /Лестниц на уровне: (\d+)/.exec(card.lines[0]);
    if (m) { stairVals.add(+m[1]); if (+m[1] === 4) saw4or5.four++; if (+m[1] === 5) saw4or5.five++; }
    /* проверяем связь броска и результата там, где она видна */
    const roll = card.rolls.find(r => /2d6\+3/.test(r.f));
    if (roll && roll.t === 5 && m) {
      if (+m[1] !== 4) check('бросок 5 даёт 4 лестницы', false, 'дал ' + m[1]);
    }
  }
  check('таблица 4-60: результат 5 больше не даёт 5 лестниц', saw4or5.five === 0,
    'пятёрок-лестниц: ' + saw4or5.five);
  check('таблица 4-60: набор {4,9,10,14,17}',
    [...stairVals].sort((a, b) => a - b).join(',') === '4,9,10,14,17',
    [...stairVals].sort((a, b) => a - b).join(','));

  /* 4-59: «A non-wandering monster will always have treasure in solo play».
   * Раньше код бросал 5-из-6 и в каждом шестом случае оставлял монстра без
   * сокровища. Проверяем на не-каверне. */
  /* Занятая комната: монстр всегда с добычей (соло), но НЕ анонсируется:
   * карточка молчит, исход лежит скрыто в monsterLoot до действия «Обыскать». */
  let occupied = 0, notGuaranteed = 0, leaked = 0;
  for (let s = 0; s < 6000; s++) {
    const f = new Flow({ seed: 'MT' + s });
    const c = f.roll('4-59');
    if (!/занята/.test(c.lines.join(' '))) continue;
    occupied++;
    if (f.state.monsterLoot !== true) notGuaranteed++;
    if (/сокровищ/i.test(c.lines.join(' '))) leaked++;
  }
  check('занятая комната: монстр всегда с добычей, но скрыто',
    occupied > 300 && notGuaranteed === 0 && leaked === 0,
    'занято=' + occupied + ', без добычи=' + notGuaranteed + ', анонсов=' + leaked);

  /* Каверна определяется типом комнаты, а не галочкой. Проверяем, что 4-56
   * результат 11 выставляет roomCavern, а обычная комната его СБРАСЫВАЕТ —
   * иначе пещерная камера «отравляла» все последующие комнаты. */
  let cavernRoom = 0, nonCavern = 0, badFlag = 0;
  for (let s = 0; s < 2000 && (cavernRoom < 50 || nonCavern < 50); s++) {
    const f = new Flow({ seed: 'CV' + s });
    f.state.roomCavern = true;                 /* намеренно «грязное» состояние */
    f.roll('4-56');
    const isCavern = /каверна/.test(f.cards[f.cards.length - 1].lines[0]);
    if (isCavern) {
      cavernRoom++;
      if (!f.state.roomCavern) badFlag++;
    } else {
      nonCavern++;
      if (f.state.roomCavern) badFlag++;       /* флаг обязан сброситься */
    }
  }
  check('каверна ставится по типу комнаты и сбрасывается на обычной',
    cavernRoom >= 50 && nonCavern >= 50 && badFlag === 0,
    'каверн=' + cavernRoom + ', обычных=' + nonCavern + ', ошибок флага=' + badFlag);

  /* 4-59 у обычной комнаты не должен говорить «Каверна» */
  const g = new Flow({ seed: 'NC' });
  g.state.roomCavern = false;
  const nc = g.roll('4-59');
  check('обычная комната не уходит в каверную ветку', !/Каверна/.test(nc.lines.join(' ')),
    nc.lines.join(' | '));
}

console.log('\n== РЕГРЕСС Фазы 3: диковинки ==');
{
  const { ODDITIES, CREATURES } = require(path.join(__dirname, '..', 'src', 'data', 'oddities.js'));
  const { TRAPS } = require(path.join(__dirname, '..', 'src', 'data', 'traps.js'));
  const byN = n => ODDITIES.find(o => o.n === n);
  /* подменяем выбор, чтобы протестировать конкретную диковинку без повтора 4-из-6 */
  const force = (f, n) => { f._pickOddity = () => byN(n); };

  /* Комплементарные шансы (#12: приоткрыта 3-из-4 / закрыта 1-из-4) — это
   * ОДИН бросок. Раньше regex бросал их независимо и мог выдать «выпал» дважды. */
  let doubleChance = 0;
  for (let s = 0; s < 300; s++) {
    const f = new Flow({ seed: 'd12-' + s }); force(f, 12);
    const c = f.roll('oddity');
    if (c.lines.filter(l => /^Шанс /.test(l)).length !== 1) doubleChance++;
  }
  check('#12: комплементарные шансы — ровно один бросок', doubleChance === 0, doubleChance + ' шт');

  /* #21: кость ветки (1d3 уровня) бросается только при выпавшем 5-из-6,
   * при провале — ветка «бездна/лава» без лишней кости */
  let fail = 0, failD3 = 0, ok = 0;
  for (let s = 0; s < 400; s++) {
    const f = new Flow({ seed: 'd21-' + s }); force(f, 21);
    const c = f.roll('oddity');
    const failed = c.lines.some(l => /вторая ветка/.test(l));
    const d3 = c.rolls.filter(r => r.f === '1d3').length;
    if (failed) { fail++; if (d3) failD3++; } else ok++;
  }
  check('#21: при провале ветки кость 1d3 не бросается',
    fail > 20 && ok > 20 && failD3 === 0, 'провалов=' + fail + ', лишних 1d3=' + failD3);

  /* Ссылки на Буклет 2 подставляются в карточку */
  const checkRef = (n, re, name) => {
    const f = new Flow({ seed: 'ref' + n }); force(f, n);
    const c = f.roll('oddity');
    check(name, c.lines.some(l => re.test(l)), c.lines.slice(0, 1).join(''));
  };
  checkRef(6, /^Буклет 2, ловушка: /, '#6 яма ссылается на TRAPS');
  checkRef(16, /^Буклет 2, ловушка: /, '#16 клетка ссылается на TRAPS');
  checkRef(19, new RegExp('Буклет 2: ' + CREATURES.LivingStatue.ru), '#19 живая статуя ссылается на CREATURES');
  checkRef(38, /Буклет 2: Минотавр — HTK 3d6/, '#38 минотавр с HTK');
  checkRef(25, /разделе «Оракул» \(Буклет 10\)/, '#25 оракул ведёт в раздел «Оракул»');

  /* need (#15) — только в каверне не меньше 720 кв. футов */
  let wrongRoom15 = 0, found15 = 0;
  for (let s = 0; s < 500; s++) {
    const f = new Flow({ seed: 'need' + s });
    f.state.roomCavern = false; f.state.roomSqFt = 5000;
    if (f._pickOddity().n === 15) wrongRoom15++;
  }
  for (let s = 0; s < 500; s++) {
    const f = new Flow({ seed: 'needc' + s });
    f.state.roomCavern = true; f.state.roomSqFt = 1000;
    if (f._pickOddity().n === 15) found15++;
  }
  check('#15 не выпадает вне большой каверны', wrongRoom15 === 0, wrongRoom15 + ' шт');
  check('#15 выпадает в каверне >=720 кв. футов', found15 > 3, found15 + ' из 500');

  /* once (#24) — не больше одной на подземелье */
  let once24 = 0;
  const g = new Flow({ seed: 'once' });
  for (let i = 0; i < 800; i++) if (g._pickOddity().n === 24) once24++;
  check('#24 светящаяся лестница выпадает не больше одного раза', once24 <= 1, once24 + ' шт');

  /* Кости и шансы из данных, а не из прозы: у #12 поле chance, у #35 пар — свой */
  check('у #12 есть структурный шанс', !!byN(12).sub && !!byN(12).sub.chance);
}


console.log('\n== монстр: сокровище не анонсируется, добывается «обыскать» ==');
{
  /* Занятая комната не должна говорить «сокровище». */
  let rooms = 0, announced = 0, hidden = 0;
  for (let s = 0; s < 600; s++) {
    const f = new Flow({ seed: 'pt' + s });
    const c = f.roll('4-59');
    if (!/занята/.test(c.lines.join(' '))) continue;
    rooms++;
    if (/сокровищ/i.test(c.lines.join(' '))) announced++;
    if (f.state.monsterLoot !== true) hidden++;
  }
  check('4-59(занята) не упоминает сокровище', rooms > 50 && announced === 0,
    'занято=' + rooms + ', анонсов=' + announced);
  check('добыча комнатного монстра хранится скрыто', hidden === 0, hidden + ' шт');

  /* карточка комнаты не ведёт на 4-63 */
  let toTreasure = 0, checked = 0;
  for (let s = 0; s < 400; s++) {
    const f = new Flow({ seed: 'nt' + s });
    const c = f.roll('4-59');
    checked++;
    if (c.next.includes('4-63')) toTreasure++;
  }
  check('карточка комнаты не ведёт на 4-63', toTreasure === 0, toTreasure + ' из ' + checked);

  /* «обыскать» после занятой комнаты даёт добычу */
  let mons = 0, got = 0, bad = 0;
  for (let s = 0; s < 600; s++) {
    const f = new Flow({ seed: 'loot' + s });
    const c = f.roll('4-59');
    if (!/занята/.test(c.lines.join(' '))) continue;
    mons++;
    const l = f.roll('loot');
    /* обыск сам тратит ход и может породить НОВУЮ встречу — проверяем результат */
    if (/нечего|сначала/i.test(l.lines.join(' '))) bad++;
    else got++;
  }
  check('«обыскать» после занятой комнаты даёт добычу',
    mons > 50 && got === mons && bad === 0, 'занято=' + mons + ', добыча=' + got + ', ошибок=' + bad);

  /* обыск на неразыгранной комнате — подсказка разыграть содержимое */
  const f2 = new Flow({ seed: 'lazy' });
  f2.state.roomStocked = false;
  check('обыск до содержимого — подсказка разыграть 4-59',
    /Сначала разыграйте/.test(f2.roll('loot').lines.join(' ')));

  /* обыск в комнате без монстра разрешён и стоит ход */
  const f3 = new Flow({ seed: 'none' });
  f3.state.roomStocked = true; f3.state.monsterLoot = null;
  const l3 = f3.roll('loot').lines.join(' ');
  check('обыск без монстра разрешён, ничего не даёт и тратит ход',
    /Обыскали комнату/.test(l3) && /ход/.test(l3) && f3.state.turns === 1, l3);
  f3.state.monsterLoot = null;
  f3.roll('loot');
  check('каждый обыск добавляет ход', f3.state.turns === 2, 'turns=' + f3.state.turns);
}

console.log('\n== время, ходы и случайные встречи ==');
{
  /* Ход = 10 минут: 90 футов пути, обыск комнаты или 10 футов стены.
   * Проверка встречи — на каждый 10-минутный тик. */
  const cyr = /[А-Яа-яЁё]/;

  /* 90 футов пути = 10 минут */
  const a = new Flow({ seed: 'time-a' });
  a.state.stock = { torches: 30, oil: 5 }; a.lightSource('torch');
  let guard = 0;
  while (a.state.feet < 90 && guard++ < 200) a.roll('4-52');
  check('90 футов пути = 10 минут',
    a.state.feet >= 90 && Math.abs(a.state.minutes - a.state.feet / 9) < 1e-6,
    'feet=' + a.state.feet + ' минут=' + a.state.minutes.toFixed(2));
  check('ходы = полные 10-минутные тики', a.state.turns === Math.floor(a.state.minutes / 10),
    'turns=' + a.state.turns);

  /* обыск комнаты = 10 минут; 10 футов стены = 10 минут */
  const b = new Flow({ seed: 'time-b' });
  b.state.roomStocked = true; b.state.monsterLoot = null;
  const m0 = b.state.minutes;
  b.roll('loot');
  check('обыск комнаты = 10 минут', Math.abs(b.state.minutes - m0 - 10) < 1e-6, String(b.state.minutes));
  const c0 = b.state.minutes;
  b.roll('secret', { feet: 10 });
  check('10 футов стены = 10 минут', Math.abs(b.state.minutes - c0 - 10) < 1e-6, String(b.state.minutes));

  /* проверка на тик: 3 обыска = 3 тика = 3 проверки */
  const c1 = new Flow({ seed: 'ticks' });
  c1.state.roomStocked = true; c1.state.monsterLoot = null;
  let tickLines = 0;
  for (let i = 0; i < 3; i++) {
    c1.roll('loot');
  }
  check('три хода (обыска) дают три проверки встречи',
    c1.cards.filter(c => /Проверка встречи/.test(c.lines.join(' '))).length === 3,
    'карточек с проверкой: ' + c1.cards.filter(c => /Проверка встречи/.test(c.lines.join(' '))).length);

  /* частота встреч ~1/6 на тик */
  let hits = 0, ticks = 0;
  const F = new Flow({ seed: 'encfreq' });
  F.state.roomStocked = true; F.state.monsterLoot = null;
  for (let i = 0; i < 4000; i++) {
    const c = F.roll('loot');
    ticks++;
    if (/ВСТРЕЧА!/.test(c.lines.join(' '))) { hits++; F.state.monsterLoot = null; }
  }
  check('случайная встреча ~1-из-6 на тик, получилось ' + (hits / ticks * 100).toFixed(1) + '%',
    hits / ticks > 0.14 && hits / ticks < 0.19);

  /* содержимое встречи: монстр, дистанция, реакция */
  let c = null;
  for (let s = 0; s < 4000 && !c; s++) {
    const f = new Flow({ seed: 'encx' + s });
    f.state.roomStocked = true; f.state.monsterLoot = null;
    const r = f.roll('loot');
    if (/ВСТРЕЧА!/.test(r.lines.join(' '))) c = r;
  }
  const body = c ? c.lines.join(' | ') : '';
  check('во встрече есть монстр, дистанция и реакция',
    c && /Дистанция: \d+ фут/.test(body) && /Реакция \(2d6=\d+\)/.test(body) && cyr.test(body),
    body.slice(Math.max(0, body.indexOf('ВСТРЕЧА')), body.indexOf('ВСТРЕЧА') + 120));

  /* добыча бродячего монстра берётся обыском без комнаты */
  const w = new Flow({ seed: 'wander-loot' });
  w.state.roomStocked = false; w.state.monsterLoot = true;
  const l = w.roll('loot');
  check('бродячего монстра можно обыскать без комнаты',
    !/Сначала разыграйте/.test(l.lines.join(' ')), l.lines[0]);

  /* свет: факел 10 минут, догорел — темнота при пустом запасе */
  const L = new Flow({ seed: 'light' });
  L.state.stock = { torches: 1, oil: 0 }; L.lightSource('torch');
  L.state.minutes = 0;
  const sc = L.roll('secret', { feet: 30 });   /* 30 минут */
  check('факел горит 10 минут и гаснет при пустом запасе',
    /догорел/.test(sc.lines.join(' ')) && /темнота/.test(sc.lines.join(' ')) && L.state.light.kind === 'none',
    L.state.light.kind);
  check('автозамена тратит запас',
    L.state.stock.torches === 0, JSON.stringify(L.state.stock));
}

console.log('\n== Оракул (Booklet 10): по требованию ==');
{
  const cyr = /[А-Яа-яЁё]/;
  const oracTables = TABLES.filter(t => t.id.indexOf('oracle') === 0);
  check('оракульные столы есть в TABLES', oracTables.length >= 8, oracTables.length + ' шт');

  let bad = 0;
  for (const t of oracTables) {
    for (let s = 0; s < 40; s++) {
      const c = new Flow({ seed: 'o' + t.id + s }).roll(t.id);
      if (!c.lines.length || !c.lines.every(l => cyr.test(l))) { bad++; break; }
    }
  }
  check('каждый оракульный стол даёт русский текст', bad === 0, bad + ' шт');

  const a = new Flow({ seed: 'det' }).roll('oracle-an');
  const b = new Flow({ seed: 'det' }).roll('oracle-an');
  check('оракул детерминирован', JSON.stringify(a.lines) === JSON.stringify(b.lines));

  const room = new Flow({ seed: 'p' }).oraclePreset('4-56');
  check('пресет комнаты — описание и действие (2 строки)', room.lines.length === 2, room.lines.join(' | '));
  const mon = new Flow({ seed: 'p' }).oraclePreset('4-62');
  check('пресет монстра — одна строка', mon.lines.length === 1, mon.lines.join(' | '));
  let threw = false;
  try { new Flow({ seed: 'p' }).oraclePreset('entry'); } catch (e) { threw = true; }
  check('для неоракульного стола пресета нет', threw);

  /* По требованию: обычные броски оракул не запускают. */
  const f = new Flow({ seed: 'lazy' });
  f.roll('4-56'); f.roll('4-52');
  check('оракул не бросается сам', !f.cards.some(c => c.table === 'oracle'),
    f.cards.map(c => c.table).join(','));
}


console.log('\n== вывод на русском: без английских вставок ==');
{
  /* Сокровище: валюта «зм», без «gp». */
  let gp = 0, zm = 0;
  for (let s = 0; s < 400; s++) {
    const l = new Flow({ seed: 'ru' + s, level: 1 }).roll('4-63').lines.join(' ');
    if (/\d\s?gp/.test(l)) gp++;
    if (/зм/.test(l)) zm++;
  }
  check('сокровище: валюта «зм», без «gp»', gp === 0 && zm > 0, 'gp=' + gp + ', зм=' + zm);

  /* Диковинки/ловушки: «Буклет 2/10», без англ. вставок из буклета. */
  let eng = 0, sample = '';
  for (let s = 0; s < 800; s++) {
    const c = new Flow({ seed: 'ruO' + s }).roll('oddity');
    for (const l of c.lines) {
      if (/Booklet|treat the exit|first roll up|\bqty\b|\bN\/A\b/.test(l)) { eng++; if (!sample) sample = l; }
    }
  }
  check('в диковинках нет английских вставок', eng === 0, eng + (sample ? ' — ' + sample.slice(0, 60) : ''));

  /* Формула шанса в чипах — «шанс», не «chance» (вход бросает 2-из-6). */
  const e = new Flow({ seed: 'ruC' }).roll('entry');
  const fs = e.rolls.map(r => r.f);
  check('формула шанса — «шанс N/M»', fs.some(f => /^шанс \d+\/\d+$/.test(f)) && !fs.some(f => /^chance/.test(f)),
    fs.join(', '));
}

console.log('\n== Stocking Monsters: занятость, ротация, группы ==');
{
  const W = require(path.join(__dirname, '..', 'src', 'data', 'wandering.js'));

  /* 4-59 (Booklet 4): обычная комната — 1d100, пусто 1-39, монстр 40-86,
   * «только сокровище» 87-100. Распределение НЕ зависит от уровня. */
  const dist = { empty: 0, monster: 0, treasure: 0 };
  for (let s = 0; s < 6000; s++) {
    const body = new Flow({ seed: 'd59' + s }).roll('4-59').lines.join(' ');
    if (/выглядит пуст/.test(body)) dist.empty++;
    else if (/занята/.test(body)) dist.monster++;
    else if (/сокровищ/i.test(body)) dist.treasure++;
  }
  check('4-59: пусто ~39%', Math.abs(dist.empty / 6000 - 0.39) < 0.03, (dist.empty / 6000).toFixed(3));
  check('4-59: монстр ~47%', Math.abs(dist.monster / 6000 - 0.47) < 0.03, (dist.monster / 6000).toFixed(3));
  check('4-59: только сокровище ~14%', Math.abs(dist.treasure / 6000 - 0.14) < 0.03, (dist.treasure / 6000).toFixed(3));

  /* каверна: 1-из-6 монстр, иначе пусто (ветка помечает строку «Каверна») */
  let cavEmpty = 0, cavOcc = 0;
  for (let s = 0; s < 3000; s++) {
    const f = new Flow({ seed: 'cav59' + s });
    f.state.roomCavern = true;
    const body = f.roll('4-59').lines.join(' ');
    if (/Каверна выглядит пуст/.test(body)) cavEmpty++;
    else if (/Каверна занята/.test(body)) cavOcc++;
  }
  check('каверна 4-59: пусто ~5/6', Math.abs(cavEmpty / 3000 - 5 / 6) < 0.03, (cavEmpty / 3000).toFixed(3));
  check('каверна 4-59: монстр ~1/6', Math.abs(cavOcc / 3000 - 1 / 6) < 0.03, (cavOcc / 3000).toFixed(3));

  /* ротация бродячих 3-4 и пересборка при смене уровня */
  const f = new Flow({ seed: 'ros', level: 1 });
  f.roll('wander');
  check('ротация бродячих — 3 или 4 монстра',
    f.state.wanderSet.length === 3 || f.state.wanderSet.length === 4, f.state.wanderSet.length);
  f.setLevel(5); f.roll('wander');
  check('ротация пересобирается на новом уровне',
    f.state.wanderLevel === 5 && W.groupForLevel(5) === 3, 'level=' + f.state.wanderLevel);

  /* встреча помечает группу */
  let enc = null;
  for (let s = 0; s < 4000 && !enc; s++) {
    const g = new Flow({ seed: 'ew' + s });
    g.state.roomStocked = true; g.state.monsterLoot = null;
    const c = g.roll('loot');
    if (/ВСТРЕЧА!/.test(c.lines.join(' '))) enc = c;
  }
  check('бродячая встреча указывает Группу',
    enc && /\(группа (III|II|I)/.test(enc.lines.join(' ')),
    enc ? enc.lines[2] : 'нет');

  /* монстр занятой комнаты на 5 уровне — из Группы III */
  let occ5 = 0, gI = 0, gII = 0, gIII = 0;
  for (let s = 0; s < 2000; s++) {
    const g = new Flow({ seed: 'g5' + s, level: 5 });
    const body = g.roll('4-59').lines.join(' ');
    if (!/занята/.test(body)) continue;
    occ5++;
    const m = /\(группа (III|II|I)/.exec(body);
    if (m) { if (m[1] === 'I') gI++; else if (m[1] === 'II') gII++; else gIII++; }
  }
  check('на 5 уровне основа Группа III, без Группы I',
    occ5 > 100 && gI === 0 && gIII > gII, 'занято=' + occ5 + ' I=' + gI + ' II=' + gII + ' III=' + gIII);
}


console.log('\n== решение не-последней карточки (регресс) ==');
{
  /* resolve() раньше брал ПОСЛЕДНЮЮ карточку. Если после карточки-решения
   * появлялась ещё одна (например, оракульная), нажатие на старое решение
   * падало с «Нечего решать: последняя карточка без выбора». Теперь решаем ту,
   * чья кнопка нажата. */
  let b = null;
  for (let s = 0; s < 300 && !b; s++) {
    const f = new Flow({ seed: 'oldchoice' + s });
    const c = f.roll('4-54');
    if (c.choice) b = { f: f, c: c };
  }
  check('нашли карточку-решение', !!b);
  if (b) {
    const n0 = b.f.cards.length;
    b.f.roll('4-52');               /* ещё карточка после решения */
    b.f.oraclePreset('4-54');       /* и ещё оракульная */
    let threw = false;
    try { b.f.resolve(b.c.choice[0].key, b.c); } catch (e) { threw = true; }
    check('решение по кнопке не-последней карточки не падает',
      !threw && b.c.choice === null && !!b.c.chosen, 'threw=' + threw);
    check('журнал цел (карточки добавились, не потерялись)',
      b.f.cards.length === n0 + 2, String(b.f.cards.length));
  }
}

console.log('\n== автоцепочка встаёт на монстре (halt) ==');
{
  let occ = null;
  for (let s = 0; s < 800 && !occ; s++) {
    const c = new Flow({ seed: 'h' + s }).roll('4-59');
    if (/занята/.test(c.lines.join(' '))) occ = c;
  }
  check('занятая комната помечена halt', occ && occ.halt === true, occ ? String(occ.halt) : 'нет');
  check('у комнатного монстра есть бросок реакции',
    occ && /Реакция \(2d6=\d+\)/.test(occ.lines.join(' ')), occ ? occ.lines.join(' | ') : '—');

  let emp = null;
  for (let s = 0; s < 800 && !emp; s++) {
    const c = new Flow({ seed: 'he' + s }).roll('4-59');
    if (/выглядит пуст/.test(c.lines.join(' '))) emp = c;
  }
  check('пустая комната без halt', emp && emp.halt === false, emp ? String(emp.halt) : 'нет');

  let enc = null;
  for (let s = 0; s < 4000 && !enc; s++) {
    const f = new Flow({ seed: 'hw' + s });
    f.state.roomStocked = true; f.state.monsterLoot = null;
    const c = f.roll('loot');
    if (/ВСТРЕЧА!/.test(c.lines.join(' '))) enc = c;
  }
  check('бродячая встреча помечена halt', enc && enc.halt === true, enc ? String(enc.halt) : 'нет');
}

console.log('\n== лестница: комната и сохранение описания (регресс) ==');
{
  let inRoom = 0, inPass = 0, lostDesc = 0, badNext = 0, badSize = 0;
  for (let s = 0; s < 1500; s++) {
    const f = new Flow({ seed: 'st' + s });
    f.state.entryRoom = false; f.state.entryRoomDone = true;
    const c = f.roll('4-52');
    if (!c.next.includes('stairway')) continue;
    const st = f.roll('stairway');
    const wasRoom = /в комнате/.test(st.lines.join(' '));
    const r = f.resolve('continue', st);
    /* описание лестницы (вид/окружение) не должно теряться при выборе */
    if (!/Лестница/.test(r.lines.join(' '))) lostDesc++;
    if (wasRoom) {
      inRoom++;
      if (r.next.join(',') !== '4-56') badNext++;
      const room = f.roll('4-56');
      const m = /(\d+)'x(\d+)'/.exec(room.lines.join(' '));
      if (!m || Math.max(+m[1], +m[2]) > 30) badSize++;
    } else {
      inPass++;
      if (r.next.join(',') !== '4-54') badNext++;
    }
  }
  check('лестница в комнате: описание цело, ведёт к 4-56, комната ≤30\'',
    inRoom > 30 && lostDesc === 0 && badNext === 0 && badSize === 0,
    'в комнате=' + inRoom + ', потеряно=' + lostDesc + ', next=' + badNext + ', размер=' + badSize);
  check('лестница в проходе ведёт к 4-54', inPass > 15 && badNext === 0, 'в проходе=' + inPass);
}

console.log('\n== итог ==');
console.log('  ok=' + ok + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);