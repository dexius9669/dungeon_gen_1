/* Валидатор данных. Запуск: node test/validate.js
 * Проверяет: синтаксис, покрытие диапазонов, ссылки между модулями. */

const path = require('path');
const D = (f) => require(path.join(__dirname, '..', 'src', 'data', f));

let fail = 0, warn = 0, ok = 0;
const bad = (m) => { fail++; console.log('  FAIL  ' + m); };
const wrn = (m) => { warn++; console.log('  warn  ' + m); };
const good = (m) => { ok++; console.log('  ok    ' + m); };

/* ---- парсер кубиков: "1d8", "2d6", "3d10", "1d100", "1d3 x 250" ---- */
function parseDie(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)[dD](\d+)\s*(?:([+-])\s*(\d+))?/);
  if (!m) return null;
  const off = m[3] === '+' ? +m[4] : m[3] === '-' ? -m[4] : 0;
  const n = +m[1], sides = +m[2];
  return { n, sides, off, min: n + off, max: n * sides + off };
}

/* ---- покрытие диапазона строкой ---- */
function checkCoverage(label, die, rows, rerollAbove) {
  const d = parseDie(die);
  if (!d) return bad(label + ': не разобран кубик "' + die + '"');
  const seen = [];
  for (const row of rows) {
    if (!Array.isArray(row.r) || row.r.length !== 2) { bad(label + ': строка без диапазона r'); continue; }
    const [a, b] = row.r;
    if (!(a >= d.min && b <= d.max)) bad(label + ': диапазон ' + a + '-' + b + ' вне ' + die);
    if (a > b) bad(label + ': r перевёрнут ' + a + '-' + b);
    for (let v = a; v <= b; v++) seen.push(v);
  }
  const dup = seen.filter((v, i) => seen.indexOf(v) !== i);
  if (dup.length) bad(label + ': пересечения на ' + [...new Set(dup)].join(', '));
  const top = (rerollAbove != null) ? rerollAbove : d.max;
  if (rerollAbove != null && !(rerollAbove >= d.min && rerollAbove <= d.max))
    bad(label + ': rerollAbove=' + rerollAbove + ' вне ' + die);
  const missing = [];
  for (let v = d.min; v <= top; v++) if (!seen.includes(v)) missing.push(v);
  if (missing.length) bad(label + ': не покрыто ' + missing.join(', ') + ' (должно быть покрыто ' + d.min + '-' + top + ')');
  else if (rerollAbove != null)
    good(label + ': покрыт ' + d.min + '-' + rerollAbove + ', выше → переброс (dice ' + die + ')');
  else good(label + ': покрыт ' + die + ' полностью');
}

console.log('\n== tables.js ==');
{
  const T = D('tables.js');
  const ids = Object.keys(T);
  if (!ids.length) bad('таблиц нет');
  let procedures = 0;
  for (const id of ids) {
    const t = T[id];
    if (!Array.isArray(t.rows)) { procedures++; good(id + ': процедура, не таблица — пропущена'); continue; }
    checkCoverage('таблица ' + id, t.die, t.rows, t.rerollAbove);
  }
  console.log('  процедур: ' + procedures);
}

console.log('\n== oddities.js ==');
{
  const { ODDITIES, CREATURES } = D('oddities.js');
  if (ODDITIES.length !== 38) bad('диковинок ' + ODDITIES.length + ', ожидалось 38');
  else good('38 диковинок');
  const ns = ODDITIES.map(o => o.n);
  for (let i = 1; i <= 38; i++) if (!ns.includes(i)) bad('нет диковинки #' + i);
  for (const o of ODDITIES) {
    if (!o.ru || !o.en) bad('диковинка #' + o.n + ': нет ru/en');
    if (o.sub && o.sub.die && !parseDie(o.sub.die)) bad('диковинка #' + o.n + ': плохой die ' + o.sub.die);
    if (o.sub && o.sub.table && !(o.tables && o.tables[o.sub.table]))
      bad('диковинка #' + o.n + ': sub.table "' + o.sub.table + '" без o.tables');
    if (o.creature && !CREATURES[o.creature]) bad('диковинка #' + o.n + ': нет существа ' + o.creature);
  }
  for (const k of Object.keys(CREATURES)) if (!CREATURES[k].htk) bad('существо ' + k + ': нет HTK');
  const trapRefs = ODDITIES.filter(o => o.trap).map(o => o.trap);
  console.log('  trap-ссылки: ' + trapRefs.join(', '));
}

/* Структурные шансы {n, ok} и подтаблицы диковинок. Движок теперь берёт шанс
 * из данных, а не из прозы, поэтому ошибка в ok/n даёт неверную вероятность
 * молча — валидатор обязан ловить. */
function checkChance(label, ch) {
  if (!ch) return;
  if (!(ch.n > 0)) return bad(label + ': chance.n должно быть > 0');
  if (!(ch.ok > 0 && ch.ok <= ch.n)) return bad(label + ': chance.ok=' + ch.ok + ' вне 1..' + ch.n);
  good(label + ': шанс ' + ch.ok + '-из-' + ch.n);
}

console.log('\n== oddities.js: шансы и подтаблицы ==');
{
  const { ODDITIES } = D('oddities.js');
  let chances = 0, subtables = 0;
  for (const o of ODDITIES) {
    const tag = 'диковинка #' + o.n;
    if (o.chance) { checkChance(tag + ' (ветка)', o.chance); chances++; }
    if (o.need && o.need.cavernMinSqFt != null && !(o.need.cavernMinSqFt > 0))
      bad(tag + ': need.cavernMinSqFt должно быть > 0');
    if (o.sub && o.sub.chance) { checkChance(tag + ' (sub)', o.sub.chance); chances++; }
    if (o.sub && o.sub.table) {
      subtables++;
      const tbl = o.tables[o.sub.table];
      checkCoverage(tag + ' / ' + o.sub.table, o.sub.die, tbl.rows);
      for (const key of Object.keys(tbl.detail || {})) {
        const det = tbl.detail[key];
        if (!det.ru) bad(tag + ': ' + o.sub.table + '.' + key + ' без ru');
        if (det.sub && det.sub.die && !parseDie(det.sub.die))
          bad(tag + ': ' + key + ' плохой die ' + det.sub.die);
        if (det.sub && det.sub.chance) { checkChance(tag + ' / ' + key, det.sub.chance); chances++; }
      }
    }
  }
  good('подтаблиц: ' + subtables + ', структурных шансов: ' + chances);
}

console.log('\n== traps.js ==');
{
  const { TRAPS, TRAP_ORDER, SPECIAL_ROOMS } = D('traps.js');
  if (TRAP_ORDER.length !== 14) bad('ловушек ' + TRAP_ORDER.length + ', ожидалось 14');
  else good('14 ловушек');
  for (const k of TRAP_ORDER) if (!TRAPS[k]) bad('TRAP_ORDER ссылается на отсутствующий ' + k);
  for (const k of Object.keys(TRAPS)) if (!TRAP_ORDER.includes(k)) bad('ловушка ' + k + ' не в TRAP_ORDER');
  for (const r of SPECIAL_ROOMS) if (!r.key || !r.ru || !r.en) bad('особая комната без key/ru/en');

  const { ODDITIES } = D('oddities.js');
  const bad_refs = ODDITIES.filter(o => o.trap && !TRAPS[o.trap]);
  if (bad_refs.length) bad('диковинки ссылаются на несуществующие ловушки: ' + bad_refs.map(o => '#' + o.n + '→' + o.trap));
  else good('все trap-ссылки диковинок резолвятся');
}

console.log('\n== monsters.js ==');
{
  const { MONSTERS } = D('monsters.js');
  let unk = [];
  for (const lv of Object.keys(MONSTERS.levels)) {
    const L = MONSTERS.levels[lv];
    if (!L.rows) { unk.push(lv); continue; }
    checkCoverage('уровень ' + lv, L.die, L.rows);
  }
  console.log('  не восстановлены: уровни ' + unk.join(', '));
  if (unk.length) wrn('уровни без строк: ' + unk.length + ' — движок обязан fallback на verifiedPool');
  if (!MONSTERS.verifiedPool.length) bad('verifiedPool пуст');
  else good('verifiedPool: ' + MONSTERS.verifiedPool.length + ' монстров');
}

console.log('\n== treasure.js ==');
{
  const { TREASURE } = D('treasure.js');
  for (const lv of Object.keys(TREASURE.levels)) {
    const L = TREASURE.levels[lv];
    if (L.certainty && L.certainty !== 'exact') console.log('  уровень ' + lv + ' → ' + L.certainty);
    checkCoverage('уровень ' + lv, L.die, L.rows);
  }
}

console.log('\n== oracles.js ==');
{
  const O = D('oracles.js');
  const want = { VERBS: 295, NOUNS: 264, ADJ_NOUN: 164, ADJECTIVES: 121, ADV_VERB: 33, ADVERBS: 76 };
  for (const k of Object.keys(want)) {
    if (!Array.isArray(O[k])) { bad(k + ': не массив'); continue; }
    if (O[k].length !== want[k]) bad(k + ': ' + O[k].length + ', ожидалось ' + want[k]);
    else good(k + ': ' + O[k].length);
  }
  const wp = { who: 34, what: 12, when: 45, where: 60, why: 11, how: 36, howMuch: 12 };
  for (const k of Object.keys(wp)) {
    if (!Array.isArray(O.PREP[k])) { bad('PREP.' + k + ': не массив'); continue; }
    if (O.PREP[k].length !== wp[k]) bad('PREP.' + k + ': ' + O.PREP[k].length + ', ожидалось ' + wp[k]);
    else good('PREP.' + k + ': ' + O.PREP[k].length);
  }
  if (O.PREP_ARTICLE.length !== 30) bad('PREP_ARTICLE: ' + O.PREP_ARTICLE.length + ', ожидалось 30');
  else good('PREP_ARTICLE: 30');
  const ws = { colors: 8, troops: 39, weapons: 32, armor: 13, spells: 19, artillery: 8,
               cover: 6, cultures: 16, personages: 5, fantasticMonsters: 30 };
  for (const k of Object.keys(ws)) {
    if (!Array.isArray(O.SPECIALTY[k])) { bad('SPECIALTY.' + k + ': не массив'); continue; }
    if (O.SPECIALTY[k].length !== ws[k]) bad('SPECIALTY.' + k + ': ' + O.SPECIALTY[k].length + ', ожидалось ' + ws[k]);
    else good('SPECIALTY.' + k + ': ' + O.SPECIALTY[k].length);
  }
  /* Целостность пар [en, ru] и русский текст. */
  const all = [];
  for (const k of Object.keys(want)) all.push([k, O[k]]);
  for (const k of Object.keys(wp)) all.push(['PREP.' + k, O.PREP[k]]);
  all.push(['PREP_ARTICLE', O.PREP_ARTICLE]);
  for (const k of Object.keys(ws)) all.push(['SPECIALTY.' + k, O.SPECIALTY[k]]);
  const cyr = /[А-Яа-яЁё]/;
  let pairs = 0, broken = 0, noRu = 0;
  for (const [label, arr] of all) {
    for (const e of arr) {
      pairs++;
      if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || !e[0] ||
          typeof e[1] !== 'string' || !e[1]) { broken++; if (broken < 4) bad(label + ': плохая пара ' + JSON.stringify(e)); continue; }
      if (!cyr.test(e[1])) { noRu++; if (noRu < 4) bad(label + ': нет кириллицы в «' + e[1] + '»'); }
    }
  }
  if (broken) bad('битых пар: ' + broken); else good('все пары [en, ru] целы: ' + pairs);
  if (noRu) bad('строк без кириллицы: ' + noRu); else good('во всех ru есть кириллица');
}

console.log('\n== wandering.js (Stocking Monsters) ==');
{
  const W = D('wandering.js');
  const want = { 1: 18, 2: 16, 3: 16 };
  const cyr = /[А-Яа-яЁё]/;
  let broken = 0;
  for (const g of Object.keys(want)) {
    if (!Array.isArray(W.GROUPS[g])) { bad('GROUPS.' + g + ': не массив'); continue; }
    if (W.GROUPS[g].length !== want[g]) bad('Группа ' + g + ': ' + W.GROUPS[g].length + ', ожидалось ' + want[g]);
    else good('Группа ' + g + ': ' + W.GROUPS[g].length);
    for (const e of W.GROUPS[g]) {
      if (!Array.isArray(e) || e.length !== 2 || !e[0] || !e[1] || !cyr.test(e[1])) broken++;
    }
  }
  if (broken) bad('битых пар в Группах: ' + broken); else good('все пары Групп целы');
  if (W.groupForLevel(1) !== 1 || W.groupForLevel(4) !== 2 || W.groupForLevel(6) !== 3 || W.groupForLevel(9) !== 3)
    bad('groupForLevel неверна');
  else good('groupForLevel: 1-2→I, 3-4→II, 5+→III');
  if (W.shiftGroup(1, 'easier') !== 1 || W.shiftGroup(3, 'harder') !== 3 || W.shiftGroup(2, 'easier') !== 1)
    bad('shiftGroup не зажимает в 1..3');
  else good('shiftGroup зажимает в I..III');
  if (W.occupiedRoomChance(1).ok !== 1 || W.occupiedRoomChance(4).ok !== 2 || W.occupiedRoomChance(6).ok !== 3)
    bad('occupiedRoomChance неверна');
  else good('занятость комнаты: 1-2→1/6, 3-5→2/6, 6→3/6');
}

console.log('\n== итог ==');
console.log('  ok=' + ok + '  warn=' + warn + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
