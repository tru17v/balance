// Ядро расчёта: калибровка опор и балансировка жёсткого двухопорного ротора в двух плоскостях.
//
// Модель: ротор жёсткий, опоры A и B независимы. Вибрация опоры пропорциональна передаваемой
// на неё динамической нагрузке: x = D / k, где k — комплексная динамическая жёсткость опоры.
// Нагрузки на опоры от сил в плоскостях 1 и 2 находятся из равновесия моментов (правило рычага).
//
// Единицы: длины и радиусы — мм, массы — г, частота — об/мин, вибрации — мкм,
// силы — Н (г·мм·с⁻² · 1e-6), жёсткости — Н/мкм, углы — градусы.
// Комплексные величины — объекты { re, im }; фаза отсчитывается от оси re против часовой стрелки.
(function (root) {
  'use strict';

  const C = (re, im = 0) => ({ re, im });
  const add = (a, b) => C(a.re + b.re, a.im + b.im);
  const sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const scale = (a, k) => C(a.re * k, a.im * k);
  const div = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  };
  const abs = a => Math.hypot(a.re, a.im);
  const argDeg = a => Math.atan2(a.im, a.re) * 180 / Math.PI;
  const norm360 = deg => ((deg % 360) + 360) % 360;
  const polar = (amp, phDeg) => {
    const t = phDeg * Math.PI / 180;
    return C(amp * Math.cos(t), amp * Math.sin(t));
  };
  const isFiniteC = a => Number.isFinite(a.re) && Number.isFinite(a.im);

  // Схемы расположения плоскостей коррекции 1, 2 относительно опор A, B.
  // a = |A-1|, b = |1-2|, c = |2-B|; координаты отсчитываются от опоры A.
  // Формулы ПК и МОПК (а также ЛК и ЛКМО) совпадают — схемы различаются порядком точек на валу.
  // demo — типовая геометрия схемы: длины a, b, c и координата центра масс cm, мм.
  const SCHEMES = {
    mo:   { label: 'МО',   title: 'Межопорная',                 order: 'A12B', demo: { a: 75,  b: 195, c: 265, cm: 172 } },
    pk:   { label: 'ПК',   title: 'Правая консоль',             order: 'AB12', demo: { a: 520, b: 120, c: 240, cm: 250 } },
    lk:   { label: 'ЛК',   title: 'Левая консоль',              order: '12AB', demo: { a: 240, b: 120, c: 520, cm: 150 } },
    mopk: { label: 'МОПК', title: 'Межопорная + правая консоль', order: 'A1B2', demo: { a: 100, b: 450, c: 120, cm: 230 } },
    lkmo: { label: 'ЛКМО', title: 'Левая консоль + межопорная', order: '1A2B', demo: { a: 100, b: 450, c: 120, cm: 240 } },
    dk:   { label: 'ДК',   title: 'Двухконсольная',             order: '1AB2', demo: { a: 100, b: 600, c: 100, cm: 200 } },
  };

  function coordinates(scheme, a, b, c) {
    let z1, z2, zB;
    switch (scheme) {
      case 'mo':                z1 = a;  z2 = a + b; zB = a + b + c; break;
      case 'pk': case 'mopk':   z1 = a;  z2 = a + b; zB = a + b - c; break;
      case 'lk': case 'lkmo':   z1 = -a; z2 = b - a; zB = b - a + c; break;
      case 'dk':                z1 = -a; z2 = b - a; zB = b - a - c; break;
      default: throw new Error(`Неизвестная схема: ${scheme}`);
    }
    return { zA: 0, z1, z2, zB };
  }

  // Фактический порядок точек вдоль вала слева направо, например 'A12B'
  function pointOrder(z) {
    return [['A', z.zA], ['1', z.z1], ['2', z.z2], ['B', z.zB]]
      .sort((p, q) => p[1] - q[1]).map(p => p[0]).join('');
  }

  const omega = rpm => 2 * Math.PI * rpm / 60;

  // Центробежная сила от массы m [г] на радиусе-векторе R [мм] при угловой скорости w [рад/с], Н.
  const force = (m, R, w) => scale(R, m * w * w * 1e-6);

  // Нагрузки на опоры от сил F1, F2 в плоскостях 1, 2 (равновесие моментов).
  function supportLoads(z, F1, F2) {
    const A = scale(add(scale(F1, z.z1 - z.zB), scale(F2, z.z2 - z.zB)), 1 / (z.zA - z.zB));
    const B = scale(add(scale(F1, z.z1 - z.zA), scale(F2, z.z2 - z.zA)), 1 / (z.zB - z.zA));
    return { A, B };
  }

  // Обратная задача: силы в плоскостях 1, 2, создающие заданные нагрузки на опоры.
  function planeLoads(z, DA, DB) {
    const F1 = scale(add(scale(DA, z.zA - z.z2), scale(DB, z.zB - z.z2)), 1 / (z.z1 - z.z2));
    const F2 = scale(add(scale(DA, z.zA - z.z1), scale(DB, z.zB - z.z1)), 1 / (z.z2 - z.z1));
    return { F1, F2 };
  }

  // Калибровка пробными грузами.
  //   trial: [{ m, r, phi }, { m, r, phi }] — пробные грузы в плоскостях 1 и 2;
  //   x0: { A, B } — вибрации без пробных грузов (C(0) для заранее уравновешенного ротора);
  //   x1: { A, B } — вибрации с пробными грузами.
  // Возвращает комплексные жёсткости опор kA, kB и промежуточные величины для графиков.
  function calibrate({ z, rpm, trial, x0, x1 }) {
    const w = omega(rpm);
    const F1 = force(trial[0].m, polar(trial[0].r, trial[0].phi), w);
    const F2 = force(trial[1].m, polar(trial[1].r, trial[1].phi), w);
    const D = supportLoads(z, F1, F2);
    const kA = div(D.A, sub(x1.A, x0.A));
    const kB = div(D.B, sub(x1.B, x0.B));
    return { F1, F2, DA: D.A, DB: D.B, kA, kB };
  }

  // Балансировка: по вибрациям x и жёсткостям k находит дисбалансы в плоскостях 1, 2,
  // приведённые к радиусам установки r1, r2. Корректирующий груз — та же масса под углом +180°.
  function balance({ z, rpm, k, x, r }) {
    const w = omega(rpm);
    const DA = mul(k.A, x.A);
    const DB = mul(k.B, x.B);
    const { F1, F2 } = planeLoads(z, DA, DB);
    const U1 = scale(F1, 1e6 / (w * w * r[0]));
    const U2 = scale(F2, 1e6 / (w * w * r[1]));
    const correction = U => ({ mass: abs(U), angle: norm360(argDeg(U) + 180) });
    return {
      DA, DB, F1, F2,
      unbalance: [U1, U2],
      correction: [correction(U1), correction(U2)],
    };
  }

  // Разложение груза по двум соседним из n равномерно расположенных позиций (отверстий, пазов).
  // Позиция №1 находится под углом offset. Векторная сумма двух грузов равна исходному.
  function splitToPositions(mass, angle, n, offset = 0) {
    if (!(n >= 3) || !Number.isFinite(mass)) return null;
    const step = 360 / n, rad = Math.PI / 180;
    const rel = norm360(angle - offset);
    const i = Math.floor(rel / step) % n;
    const t = rel - i * step;
    const s = Math.sin(step * rad);
    return [
      { position: i + 1, angle: norm360(offset + i * step), mass: mass * Math.sin((step - t) * rad) / s },
      { position: (i + 1) % n + 1, angle: norm360(offset + (i + 1) * step), mass: mass * Math.sin(t * rad) / s },
    ];
  }

  // ГОСТ 22061-76, табл. 1: верхние границы классов точности балансировки, e_ст·ω, мм/с
  const GOST_CLASSES = { 1: 0.4, 2: 1, 3: 2.5, 4: 6.3, 5: 16, 6: 40, 7: 100, 8: 250, 9: 630, 10: 1600, 11: 4000 };

  // Верхние допустимые дисбалансы по ГОСТ 22061-76: формула (4) без технологических и
  // эксплуатационных составляющих, распределение по плоскостям коррекции — формулы (7), (8).
  //   massKg — масса ротора, кг; rpmMax — максимальная эксплуатационная частота, об/мин;
  //   zCm — координата центра масс от опоры A, мм.
  // Возвращает удельный дисбаланс e, мкм, и допуски D_ст, D1, D2, г·мм.
  function gostTolerance({ massKg, gClass, rpmMax, z, zCm }) {
    const e = GOST_CLASSES[gClass] / omega(rpmMax); // мм
    const Dst = massKg * 1000 * e;
    const L = Math.abs(z.z2 - z.z1);
    return { eUm: e * 1000, Dst, D1: Dst * Math.abs(z.z2 - zCm) / L, D2: Dst * Math.abs(zCm - z.z1) / L };
  }

  const api = {
    C, add, sub, mul, div, scale, abs, argDeg, norm360, polar, isFiniteC,
    SCHEMES, coordinates, pointOrder, omega, force, supportLoads, planeLoads, calibrate, balance,
    splitToPositions, GOST_CLASSES, gostTolerance,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Balance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
