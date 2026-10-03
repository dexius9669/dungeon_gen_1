/* Тесты RNG. Запуск: node test/rng.test.js */
const { RNG, hashSeed } = require('../src/engine/rng.js');

let fail = 0, ok = 0;
const t = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  →  ' + extra : '')); }
};

/* --- детерминизм -------------------------------------------------------- */
const a = new RNG({ seed: 'dungeon-42' });
const b = new RNG({ seed: 'dungeon-42' });
const seqA = [a.roll('2d6'), a.roll('1d100'), a.chance(1, 6), a.pick([1, 2, 3, 4, 5, 6])];
const seqB = [b.roll('2d6'), b.roll('1d100'), b.chance(1, 6), b.pick([1, 2, 3, 4, 5, 6])];
t('один seed → одна последовательность',
  JSON.stringify(seqA.map(x => x.total)) === JSON.stringify(seqB.map(x => x.total)),
  JSON.stringify(seqA.map(x => x.total)) + ' vs ' + JSON.stringify(seqB.map(x => x.total)));

const c = new RNG({ seed: 'dungeon-43' });
const seqC = [c.roll('2d6'), c.roll('1d100')];
t('разные seed → разные последовательности',
  seqA[0].total !== seqC[0].total || seqA[1].total !== seqC[1].total);

t('числовой seed тоже детерминирован',
  new RNG({ seed: 12345 }).roll('1d20').total === new RNG({ seed: 12345 }).roll('1d20').total);

t('hashSeed стабилен', hashSeed('abc') === hashSeed('abc') && hashSeed('abc') !== hashSeed('abd'));

/* --- разбор формул ------------------------------------------------------ */
const f = new RNG({ seed: 1 });
t('1d8 в границах', (() => { for (let i = 0; i < 300; i++) { const v = f.roll('1d8').total; if (v < 1 || v > 8) return false; } return true; })());
t('2d6+3 в границах 5..15', (() => { for (let i = 0; i < 300; i++) { const v = f.roll('2d6+3').total; if (v < 5 || v > 15) return false; } return true; })());
t('2d6-1 в границах 1..11', (() => { for (let i = 0; i < 300; i++) { const v = f.roll('2d6-1').total; if (v < 1 || v > 11) return false; } return true; })());
t('кости 2d6 всегда две', f.roll('3d6').dice.length === 3);
t('1d100 ≤ 100', (() => { for (let i = 0; i < 500; i++) { if (f.roll('1d100').total > 100) return false; } return true; })());
t('константа "12" → 12', f.roll('12').total === 12);
t('константа "12+3" → 15', f.roll('12+3').total === 15);
t('4d6/2 = сумма / 2 нацело', (() => { for (let i = 0; i < 300; i++) { const v = f.roll('4d6/2').total; if (v < 2 || v > 12) return false; } return true; })());
t('плохая формула кидает ошибку', (() => { try { f.roll('d'); return false; } catch (e) { return true; } })());
t('"0d6" кидает ошибку', (() => { try { f.roll('0d6'); return false; } catch (e) { return true; } })());

/* --- шансы -------------------------------------------------------------- */
const g = new RNG({ seed: 7 });
let hits = 0; for (let i = 0; i < 6000; i++) if (g.chance(1, 6).ok) hits++;
t('chance(1,6) ≈ 16.7%', Math.abs(hits / 6000 - 1 / 6) < 0.02, (hits / 6000 * 100).toFixed(1) + '%');

/* --- журнал ------------------------------------------------------------- */
const h = new RNG({ seed: 99 });
h.roll('2d6', '4-52 длина секции');
h.chance(1, 6, 'потайная дверь');
t('журнал растёт', h.log.length === 2);
t('в журнале есть причина', h.log[0].reason === '4-52 длина секции');
t('в журнале есть кости', Array.isArray(h.log[0].dice) && h.log[0].dice.length === 2);
t('журнал сериализуется в JSON', (() => { try { JSON.parse(JSON.stringify(h.log)); return true; } catch (e) { return false; } })());

/* --- откат -------------------------------------------------------------- */
const r = new RNG({ seed: 555 });
const s1 = r.begin('шаг 1');
r.roll('1d20');
const s2 = r.begin('шаг 2');
r.roll('1d20'); r.roll('1d20');
const afterStep2 = r.log.length;
const stateAtStep2 = r.state;
t('до отката в журнале 3 броска (1 в шаге 1 + 2 в шаге 2)', afterStep2 === 3, 'в журнале ' + afterStep2);
r.rollback(s1.id);
t('откат к шагу 1 обрезает журнал', r.log.length === 0, 'в журнале ' + r.log.length);
t('откат к шагу 1 обрезает шаги', r.steps.length === 2);
t('откат восстановил state', r.state !== stateAtStep2);

/* после отката повторный бросок даёт ту же последовательность */
const r2 = new RNG({ seed: 555 });
r2.begin('x'); r2.roll('1d20'); r2.roll('1d20'); r2.roll('1d20');
const firstThree = r2.log.map(l => l.total).join(',');
r2.rollback(1);
r2.roll('1d20'); r2.roll('1d20'); r2.roll('1d20');
t('после отката повтор даёт ту же последовательность', r2.log.map(l => l.total).join(',') === firstThree,
  firstThree + ' → ' + r2.log.map(l => l.total).join(','));

/* --- переброс ----------------------------------------------------------- */
const q = new RNG({ seed: 321 });
q.begin('первый');
q.roll('1d100', 'A');
const firstA = q.log[0].total;
q.begin('второй');
q.roll('1d100', 'B');
const firstB = q.log[1].total;
q.rerollLastStep();
q.roll('1d100', 'B (переброс)');
const secondB = q.log[1].total;
t('переброс не меняет предыдущий шаг', q.log[0].total === firstA);
t('переброс даёт другой результат', secondB !== firstB, firstB + ' → ' + secondB);
t('переброс не ломает журнал', q.log.length === 2 && q.log[1].reason.indexOf('переброс') !== -1);

/* --- pick --------------------------------------------------------------- */
const pk = new RNG({ seed: 11 });
const arr = ['яма', 'клетка', 'скольз', 'жёлоб', 'портал', 'лава'];
const seen = new Set();
let undef = 0;
for (let i = 0; i < 600; i++) {
  const v = pk.pick(arr).value;
  if (v === undefined) undef++;
  else seen.add(v);
}
t('pick покрывает весь массив', seen.size === 6, 'уникальных: ' + seen.size + '/6');
/* Регрессия: int() возвращает 1-based, индекс массива 0-based. Без -1
 * pick() вылезал за конец (value === undefined) и не выбирал первый элемент.
 * Прежний тест это пропускал: undefined тоже попадал в Set и размер сходился. */
t('pick никогда не выходит за границы массива', undef === 0, 'undefined × ' + undef);
t('pick выбирает первый элемент', seen.has(arr[0]), 'первый элемент не выпал ни разу');
t('pick отдаёт элемент исходного массива', [...seen].every(v => arr.includes(v)));

/* pick детерминирован */
const p1 = new RNG({ seed: 77 }), p2 = new RNG({ seed: 77 });
const q1 = [], q2 = [];
for (let i = 0; i < 20; i++) { q1.push(p1.pick(arr).value); q2.push(p2.pick(arr).value); }
t('pick детерминирован', JSON.stringify(q1) === JSON.stringify(q2));

/* границы: массив из одного элемента */
t('pick из массива в 1 элемент', new RNG({ seed: 3 }).pick(['only']).value === 'only');
t('pick пустого массива бросает ошибку', (() => {
  try { new RNG({ seed: 3 }).pick([]); return false; } catch (e) { return true; }
})());

console.log('\n  ok=' + ok + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
