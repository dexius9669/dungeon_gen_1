/* Сборка автономного предпросмотра данных: node tools/preview.js > preview.html
 * Читает src/data/*.js, встраивает их в один HTML без внешних зависимостей.
 * Это же станет каркасом интерфейса Dungeon_Gen.html. */

const fs = require('fs');
const path = require('path');
const R = (f) => require(path.join(__dirname, '..', 'src', 'data', f));

const T = R('tables.js');
const { MONSTERS } = R('monsters.js');
const { TREASURE } = R('treasure.js');
const { TRAPS, TRAP_ORDER, SPECIAL_ROOMS } = R('traps.js');
const { ODDITIES, CREATURES } = R('oddities.js');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rng = (r) => (r[0] === r[1] ? String(r[0]) : r[0] + '–' + r[1]);

/* максимум кубика: нужен, чтобы показать «to: null» как «до верха диапазона» */
const dieMax = (d) => {
  const m = String(d || '').match(/(\d+)[dD](\d+)/);
  return m ? +m[1] * +m[2] : null;
};

/* значения строки в вид «ключ: значение», пропуская диапазон */
const extras = (row, skip, dmax) => Object.keys(row).filter(k => k !== 'r' && !skip.includes(k))
  .map(k => {
    let v = row[k];
    if (v === null) v = (dmax != null ? 'до ' + dmax : '—');
    else if (v && typeof v === 'object' && 'ru' in v) v = v.ru;
    else if (typeof v === 'object') v = JSON.stringify(v).replace(/"to":null/, '"to":' + (dmax == null ? 'null' : dmax));
    return '<i class="ex">' + esc(k) + ': ' + esc(v) + '</i>';
  }).join(' ');

const tbl = (head, rows) =>
  '<table><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
  + rows.join('') + '</tbody></table>';

const S = [];

/* ---------- сводка ---------- */
const lv = (o) => Object.keys(o).sort((a, b) => a - b);
S.push(`<section id="s"><h2>Что уже готово</h2>
<table><thead><tr><th>Слой</th><th>Состояние</th><th>Детали</th></tr></thead><tbody>
<tr><td>Данные 4-51…4-61</td><td class="ok">готово</td><td>${Object.keys(T).length} таблиц, покрытие кубиков проверено</td></tr>
<tr><td>Данные 4-62 (монстры)</td><td class="ok">сверено с книгой</td><td>${lv(MONSTERS.levels).length} уровня, уровней 7–12 в буклете нет</td></tr>
<tr><td>Данные 4-63 (сокровище)</td><td class="ok">сверено с книгой</td><td>${lv(TREASURE.levels).length} уровней</td></tr>
<tr><td>Ловушки (Booklet 2)</td><td class="ok">готово</td><td>${TRAP_ORDER.length} шт. — в буклете нет кубика, бросается 1d14</td></tr>
<tr><td>Диковины</td><td class="ok">готово</td><td>${ODDITIES.length} шт. + ${Object.keys(CREATURES).length} существа</td></tr>
<tr><td>PRNG с журналом и откатом</td><td class="ok">готово, 28 тестов</td><td>детерминированный, undo/redo броска</td></tr>
<tr><td>Геометрия</td><td class="ok">готово, 51 тест</td><td>сетка 42×54, коридоры, двери, диагонали 45°</td></tr>
<tr><td><b>Генератор уровня</b></td><td class="no">не написан</td><td>следующий шаг — сборка по таблицам 4-51…4-61</td></tr>
<tr><td><b>Интерфейс и карта</b></td><td class="no">не написан</td><td>SVG-карта, пошаговое раскрытие, журнал</td></tr>
</tbody></table></section>`);

/* ---------- таблицы ---------- */
S.push('<section id="t"><h2>Таблицы 4-51…4-61 и правила подземелья</h2>');
for (const id of Object.keys(T)) {
  const t = T[id];
  if (!Array.isArray(t.rows)) {
    S.push(`<details><summary><b>${esc(id)}</b> — процедура</summary>
      <p class="ru">${esc(t.ru || t.body || '(текст процедуры в модуле)')}</p>
      ${t.en ? `<p class="en">${esc(t.en)}</p>` : ''}</details>`);
    continue;
  }
  const head = ['Бросок'].concat(t.rows[0] && Object.keys(t.rows[0]).filter(k => k !== 'r').map(k => esc(k)));
  const dmax = dieMax(t.die);
  const rows = t.rows.map(r => '<tr><td class="r">' + esc(rng(r.r)) + '</td>'
    + head.slice(1).map(h => '<td>' + extras({ [h]: r[h] }, ['r'], dmax) + '</td>').join('') + '</tr>');
  S.push(`<details><summary><b>${esc(id)}</b> — ${esc(t.die)}`
    + (t.rerollAbove != null ? ` (выше ${t.rerollAbove} → переброс)` : '')
    + `, строк ${t.rows.length}</summary>${tbl(head, rows)}</details>`);
}
S.push('</section>');

/* ---------- монстры ---------- */
S.push('<section id="m"><h2>4-62 — матрица соло-монстров</h2>'
  + `<p class="note">Уровни ${MONSTERS.levelRange.min}–${MONSTERS.levelRange.max}. `
  + `Булета дальше нет: партия уходит глубже — мастер берёт из пула (${MONSTERS.verifiedPool.length} имён) сам.</p>`);
for (const k of lv(MONSTERS.levels)) {
  const L = MONSTERS.levels[k];
  S.push(`<details><summary><b>Уровень ${k}</b> — ${esc(L.die)}, строк ${L.rows.length}`
    + ` <i class="cert ${L.certainty}">${esc(L.certainty)}</i></summary>`
    + tbl(['Бросок', 'Монстр', '', ''], L.rows.map(r =>
      `<tr><td class="r">${esc(rng(r.r))}</td><td>${esc(r.m.ru)}</td>`
      + `<td class="en">${esc(r.m.en)}</td><td>${r.qty ? '<i class="ex">qty ' + r.qty + '</i>' : ''}</td></tr>`))
    + '</details>');
}
S.push('</section>');

/* ---------- сокровище ---------- */
S.push('<section id="v"><h2>4-63 — соло-сокровище</h2>'
  + `<p class="note">Золото отдельно от предметов: в мешках или россыпью, поровну `
  + `(${(TREASURE.coinRule.sacks * 100).toFixed(0)} / ${(TREASURE.coinRule.loose * 100).toFixed(0)}).</p>`);
for (const k of lv(TREASURE.levels)) {
  const L = TREASURE.levels[k];
  S.push(`<details><summary><b>Уровень ${k}</b> — ${esc(L.die)}, строк ${L.rows.length}`
    + ` <i class="cert ${TREASURE.certainty[k] || ''}">${esc(TREASURE.certainty[k] || '—')}</i></summary>`
    + tbl(['Бросок', 'Добыча', '', ''], L.rows.map(r =>
      `<tr><td class="r">${esc(rng(r.r))}</td><td>${esc(r.item.ru)}</td>`
      + `<td class="en">${esc(r.item.en)}</td><td>${r.magic ? '<i class="ex">магия</i>' : ''}</td></tr>`))
    + '</details>');
}
S.push('</section>');

/* ---------- ловушки ---------- */
S.push('<section id="p"><h2>Ловушки (Booklet 2)</h2>'
  + '<p class="note">В буклете это плоский список из 14 описаний <b>без кубика</b>. '
  + 'Здесь бросается 1d14 с возможностью ручной замены мастером.</p>');
for (const k of TRAP_ORDER) {
  const t = TRAPS[k];
  S.push(`<details><summary><b>${esc(t.ru)}</b> <i class="en">${esc(t.en)}</i> <i class="ex">${esc(k)}</i></summary>`
    + `<p class="ru">${esc(t.mech || t.body || '')}</p>`
    + (t.ref ? `<p class="en">${esc(t.ref)}</p>` : '') + '</details>');
}
S.push('<h3>Особые комнаты</h3>');
for (const r of SPECIAL_ROOMS) {
  S.push(`<details><summary><b>${esc(r.ru)}</b> <i class="en">${esc(r.en)}</i></summary>`
    + `<p class="ru">${esc(r.body || '')}</p></details>`);
}
S.push('</section>');

/* ---------- диковины ---------- */
S.push('<section id="o"><h2>Диковины (38)</h2>');
S.push(tbl(['#', 'Диковинка', '', 'Привязка'], ODDITIES.map(o => {
  let link = '';
  if (o.trap) link = '<i class="ex">ловушка: ' + esc(o.trap) + '</i>';
  if (o.creature) link += ' <i class="ex">существо: ' + esc(o.creature) + '</i>';
  return `<tr><td class="r">${o.n}</td><td>${esc(o.ru)}</td><td class="en">${esc(o.en)}</td><td>${link}</td></tr>`;
})));
S.push('<h3>Существа Booklet 2</h3>');
S.push(tbl(['Ключ', 'Существо', 'HTK'], Object.keys(CREATURES).map(k => {
  const c = CREATURES[k];
  return `<tr><td><i class="ex">${esc(k)}</i></td><td>${esc(c.ru)} <i class="en">${esc(c.en)}</i></td><td class="r">${esc(c.htk)}</td></tr>`;
})));
S.push('</section>');

/* ---------- сборка ---------- */
const nav = [['s', 'Статус'], ['t', 'Таблицы'], ['m', 'Монстры 4-62'],
             ['v', 'Сокровище 4-63'], ['p', 'Ловушки'], ['o', 'Диковины']];

process.stdout.write(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Dungeon Gen — предпросмотр данных</title>
<style>
:root{--bg:#14161a;--fg:#d8dbe0;--dim:#8b929c;--line:#2a2f37;--acc:#7aa2f7;--ok:#7bd88f;--no:#f7768e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 20px;z-index:9}
h1{margin:0 0 8px;font-size:17px;font-weight:600}
nav a{color:var(--dim);text-decoration:none;margin-right:16px;font-size:14px}
nav a:hover{color:var(--acc)}
main{max-width:980px;margin:0 auto;padding:8px 20px 60px}
section{margin:32px 0}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.09em;color:var(--acc);border-bottom:1px solid var(--line);padding-bottom:6px}
h3{font-size:14px;color:var(--dim);margin:22px 0 8px}
details{border:1px solid var(--line);border-radius:6px;margin:6px 0;background:#181b20}
summary{cursor:pointer;padding:8px 12px;font-size:14px;user-select:none}
summary:hover{color:var(--acc)}
details table,table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:14px}
th,td{text-align:left;padding:5px 10px;border-top:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:600;font-size:13px}
td.r{color:var(--acc);font-variant-numeric:tabular-nums;white-space:nowrap;width:1%}
.en{color:var(--dim);font-size:13px;font-style:italic}
.ex{color:#c9a86a;font-size:12px;font-style:normal;font-family:ui-monospace,Menlo,monospace}
.cert{font-size:11px;font-style:normal;border:1px solid var(--line);border-radius:3px;padding:0 5px;color:var(--dim)}
.cert.exact{color:var(--ok);border-color:#2f5d3f}
p.ru{margin:6px 0 10px;padding:0 12px 10px;max-width:70ch}
p.en{margin:0 0 10px;padding:0 12px 10px;max-width:70ch}
p.note{color:var(--dim);font-size:14px;max-width:75ch}
td.ok{color:var(--ok)}td.no{color:var(--no)}
</style></head><body>
<header><h1>Dungeon Gen — предпросмотр данных</h1><nav>
${nav.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}
</nav></header>
<main>${S.join('\n')}</main></body></html>
`);
