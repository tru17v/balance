// Проверка ядра на синтетических данных: задаём «истинные» жёсткости опор и дисбалансы,
// прямой моделью получаем вибрации, затем убеждаемся, что калибровка и балансировка их восстанавливают.
// Запуск: node tests/core.test.js   (или jsc web/core.js tests/core.test.js на macOS)
const B = typeof require !== 'undefined' ? require('../web/core.js') : globalThis.Balance;
const log = typeof console !== 'undefined' ? console.log : print;
const { C, polar, abs, sub, mul, div, force, supportLoads, coordinates, calibrate, balance, omega } = B;

let failed = 0, passed = 0;
function check(name, ok, details = '') {
  if (ok) passed++;
  else { failed++; log(`FAIL ${name} ${details}`); }
}
const close = (a, b, tol = 1e-9) => abs(sub(a, b)) <= tol * Math.max(1, abs(b));
const fmt = a => `${abs(a).toFixed(4)}∠${B.norm360(B.argDeg(a)).toFixed(2)}°`;

// Простой детерминированный ГПСЧ, чтобы прогоны были воспроизводимыми
let seed = 12345;
const rnd = (lo, hi) => { seed = (seed * 1103515245 + 12345) % 2147483648; return lo + (hi - lo) * seed / 2147483648; };

// 1. Регрессия с исходной Python-версией (исходная версия на PyQt, значения по умолчанию, x0 = 0)
{
  const z = coordinates('mo', 75, 195, 265);
  const cal = calibrate({ z, rpm: 1500,
    trial: [{ m: 2.667, r: 62, phi: 190 }, { m: 2.667, r: 62, phi: 190 }],
    x0: { A: C(0), B: C(0) }, x1: { A: polar(6.6, 83), B: polar(7, 85) } });
  // исходная версия выводит 0.84×107.00° и 0.38×105.00°
  const r2 = (v, d) => Math.round(v * 100) / 100 === d;
  check('регрессия kA', r2(abs(cal.kA), 0.84) && r2(B.norm360(B.argDeg(cal.kA)), 107), fmt(cal.kA));
  check('регрессия kB', r2(abs(cal.kB), 0.38) && r2(B.norm360(B.argDeg(cal.kB)), 105), fmt(cal.kB));
}

// 2. Пример из ноутбука: балансировка теми же вибрациями возвращает пробные грузы
{
  const z = coordinates('mo', 75, 195, 265);
  const trial = [{ m: 2.667, r: 62, phi: -20 }, { m: 2.667, r: 62, phi: 170 }];
  const x = { A: polar(6.6, 40), B: polar(7, 50) };
  const cal = calibrate({ z, rpm: 1506, trial, x0: { A: C(0), B: C(0) }, x1: x });
  const bal = balance({ z, rpm: 1506, k: { A: cal.kA, B: cal.kB }, x, r: [62, 62] });
  check('ноутбук U1', close(bal.unbalance[0], polar(2.667, -20)), fmt(bal.unbalance[0]));
  check('ноутбук U2', close(bal.unbalance[1], polar(2.667, 170)), fmt(bal.unbalance[1]));
  check('ноутбук угол груза 1', Math.abs(bal.correction[0].angle - 160) < 1e-6, bal.correction[0].angle);
}

// 3. Случайные сценарии для всех схем: полный цикл калибровка → балансировка → проверка
for (const scheme of Object.keys(B.SCHEMES)) {
  for (let i = 0; i < 200; i++) {
    const a = rnd(10, 300), b = rnd(10, 300), c = rnd(10, 300);
    const z = coordinates(scheme, a, b, c);
    if (Math.abs(z.zB) < 1 || Math.abs(z.z2 - z.z1) < 1) continue; // вырожденная геометрия
    const rpm = rnd(300, 6000);
    const w = omega(rpm);
    const kA = polar(rnd(0.05, 5), rnd(0, 360)), kB = polar(rnd(0.05, 5), rnd(0, 360));
    const respond = (m1, R1, m2, R2) => {
      const D = supportLoads(z, force(m1, R1, w), force(m2, R2, w));
      return { A: div(D.A, kA), B: div(D.B, kB) };
    };
    // «Истинный» начальный дисбаланс ротора на радиусах r1, r2
    const r1 = rnd(20, 150), r2 = rnd(20, 150);
    const U1 = polar(rnd(0.1, 20), rnd(0, 360)), U2 = polar(rnd(0.1, 20), rnd(0, 360));
    const x0 = respond(1, scaleR(U1, r1), 1, scaleR(U2, r2));
    // Пробные грузы добавляются к начальному дисбалансу — вибрации суммируются
    const trial = [{ m: rnd(1, 10), r: rnd(20, 150), phi: rnd(0, 360) }, { m: rnd(1, 10), r: rnd(20, 150), phi: rnd(0, 360) }];
    const dx = respond(trial[0].m, polar(trial[0].r, trial[0].phi), trial[1].m, polar(trial[1].r, trial[1].phi));
    const x1 = { A: B.add(x0.A, dx.A), B: B.add(x0.B, dx.B) };

    const cal = calibrate({ z, rpm, trial, x0, x1 });
    check(`${scheme} kA`, close(cal.kA, kA, 1e-7), `${fmt(cal.kA)} ≠ ${fmt(kA)}`);
    check(`${scheme} kB`, close(cal.kB, kB, 1e-7), `${fmt(cal.kB)} ≠ ${fmt(kB)}`);

    const bal = balance({ z, rpm, k: { A: cal.kA, B: cal.kB }, x: x0, r: [r1, r2] });
    check(`${scheme} U1`, close(bal.unbalance[0], U1, 1e-7), `${fmt(bal.unbalance[0])} ≠ ${fmt(U1)}`);
    check(`${scheme} U2`, close(bal.unbalance[1], U2, 1e-7), `${fmt(bal.unbalance[1])} ≠ ${fmt(U2)}`);

    // Установка корректирующих грузов должна обнулить вибрации
    const [c1, c2] = bal.correction;
    const xc = respond(c1.mass, polar(r1, c1.angle), c2.mass, polar(r2, c2.angle));
    const residualA = abs(B.add(x0.A, xc.A)), residualB = abs(B.add(x0.B, xc.B));
    check(`${scheme} остаточная вибрация`, residualA < 1e-7 * abs(x0.A) + 1e-12 && residualB < 1e-7 * abs(x0.B) + 1e-12,
      `${residualA} ${residualB}`);
  }
}
function scaleR(U, r) { return B.scale(U, r); } // U [г] × r [мм] → вектор дисбаланса [г·мм]

// 4. Поведение при вырожденной геометрии — без исключений, результат не конечен
{
  const z = coordinates('pk', 100, 100, 200); // опора B совпадает с A
  const cal = calibrate({ z, rpm: 1500, trial: [{ m: 1, r: 50, phi: 0 }, { m: 1, r: 50, phi: 0 }],
    x0: { A: C(0), B: C(0) }, x1: { A: C(1), B: C(1) } });
  check('вырожденная геометрия', !B.isFiniteC(cal.kA));
}

// 5. Разложение груза по позициям: векторная сумма совпадает с исходным грузом, массы неотрицательны
for (let i = 0; i < 500; i++) {
  const n = 3 + Math.floor(rnd(0, 22)), mass = rnd(0.1, 50), angle = rnd(-720, 720), offset = rnd(0, 360);
  const parts = B.splitToPositions(mass, angle, n, offset);
  const sum = B.add(polar(parts[0].mass, parts[0].angle), polar(parts[1].mass, parts[1].angle));
  check('разложение: сумма', close(sum, polar(mass, angle), 1e-9), `${n} ${fmt(sum)} ≠ ${mass}∠${angle}`);
  check('разложение: массы ≥ 0', parts[0].mass >= -1e-12 && parts[1].mass >= -1e-12);
  check('разложение: соседние позиции', (parts[0].position % n) + 1 === parts[1].position);
}
check('разложение: точно в позицию', (() => {
  const p = B.splitToPositions(5, 90, 8);
  return p[0].position === 3 && Math.abs(p[0].mass - 5) < 1e-12 && Math.abs(p[1].mass) < 1e-12;
})());
check('разложение: n < 3 не поддерживается', B.splitToPositions(5, 90, 2) === null);

// 6. Допуск по ГОСТ 22061-76, пример из справочного приложения:
// m = 500 кг, n = 3000 об/мин, класс 4 → e_ст ≈ 20 мкм; l1 = 100, l2 = 700, L_A = 300 мм
{
  const z = { zA: 0, z1: 100, z2: 700, zB: 800 };
  const t = B.gostTolerance({ massKg: 500, gClass: 4, rpmMax: 3000, z, zCm: 300 });
  check('ГОСТ: e_ст ≈ 20 мкм', Math.abs(t.eUm - 20) < 0.1, t.eUm);
  check('ГОСТ: D_ст ≈ 10⁴ г·мм', Math.abs(t.Dst - 1e4) < 50, t.Dst);
  // В приложении для D_ст = 8000 г·мм получено D1 = 5333, D2 = 2666 г·мм
  check('ГОСТ: доли плоскостей', Math.abs(t.D1 / t.Dst * 8000 - 5333) < 1 && Math.abs(t.D2 / t.Dst * 8000 - 2667) < 1,
    `${t.D1 / t.Dst * 8000} ${t.D2 / t.Dst * 8000}`);
}

// 7. Типовая геометрия каждой схемы даёт заявленный порядок точек, центр масс между опорами
for (const [key, sc] of Object.entries(B.SCHEMES)) {
  const z = coordinates(key, sc.demo.a, sc.demo.b, sc.demo.c);
  check(`${key}: порядок точек`, B.pointOrder(z) === sc.order, `${B.pointOrder(z)} ≠ ${sc.order}`);
  check(`${key}: центр масс между опорами`, sc.demo.cm > 0 && sc.demo.cm < z.zB);
}

log(`${passed} проверок пройдено, ${failed} провалено`);
if (failed) {
  if (typeof process !== 'undefined') process.exit(1);
  else throw new Error('tests failed');
}
