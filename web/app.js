// Интерфейс: чтение полей, вызов ядра (core.js), вывод результатов, схемы и графиков.
(function () {
  'use strict';
  const {
    C, abs, argDeg, norm360, polar, sub, isFiniteC, SCHEMES, coordinates, pointOrder,
    calibrate, balance, splitToPositions, GOST_CLASSES, gostTolerance,
  } = window.Balance;

  // Демонстрационный пример: ротор с дисбалансом ≈ 3,0 г ∠ 230° и 1,6 г ∠ 115° на радиусе 62 мм,
  // опоры k_A ≈ 0,84 Н/мкм ∠ 107°, k_B ≈ 0,38 Н/мкм ∠ 105°. Замеры получены прямой моделью для
  // типовой геометрии каждой схемы и округлены, как показания прибора.
  const DEMO_RUNS = {
    mo:   { x0: [4.3, 105, 3.0, 41],  x1: [1.1, 274, 7.8, 351] },
    pk:   { x0: [1.8, 243, 14.7, 86], x1: [3.6, 165, 16.7, 341] },
    lk:   { x0: [7.9, 97, 6.7, 290],  x1: [4.1, 321, 1.8, 69] },
    mopk: { x0: [4.6, 132, 7.5, 30],  x1: [5.8, 182, 20.9, 352] },
    lkmo: { x0: [6.3, 117, 6.3, 348], x1: [3.6, 197, 15.6, 356] },
    dk:   { x0: [7.2, 128, 9.7, 354], x1: [7.8, 184, 25.1, 355] },
  };
  const COMMON_DEFAULTS = {
    rpm: 1500,
    t1m: 3, t1r: 62, t1phi: 0, t2m: 3, t2r: 62, t2phi: 90,
    x0on: true, xFromX0: true,
    r1: 62, r2: 62, pos1: 0, pos2: 0, off1: 0, off2: 0,
    kSource: 'cal', kA: 0.84, kAphi: 107, kB: 0.38, kBphi: 105,
    tolOn: true, massKg: 20, gClass: 3, rpmMax: 1500,
  };
  const GEOM_KEYS = ['a', 'b', 'c', 'cm'];
  // Поля с данными замеров: их правка означает, что пользователь работает со своим ротором
  const DATA_KEYS = ['rpm', 't1m', 't1r', 't1phi', 't2m', 't2r', 't2phi', 'x0A', 'x0Aphi', 'x0B', 'x0Bphi',
    'x1A', 'x1Aphi', 'x1B', 'x1Bphi', 'xA', 'xAphi', 'xB', 'xBphi', 'a', 'b', 'c'];

  function demoRuns(scheme) {
    const { x0, x1 } = DEMO_RUNS[scheme];
    return {
      x0A: x0[0], x0Aphi: x0[1], x0B: x0[2], x0Bphi: x0[3],
      x1A: x1[0], x1Aphi: x1[1], x1B: x1[2], x1Bphi: x1[3],
      xA: x0[0], xAphi: x0[1], xB: x0[2], xBphi: x0[3],
    };
  }
  function demoState(scheme) {
    const geom = {};
    for (const k of Object.keys(SCHEMES)) geom[k] = { ...SCHEMES[k].demo };
    return { scheme, ...COMMON_DEFAULTS, ...SCHEMES[scheme].demo, ...demoRuns(scheme), geom, demo: true };
  }

  const STORE_KEY = 'diamech-balancing-v3';
  const PLOTLY_URL = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js';

  const $ = sel => document.querySelector(sel);
  const nf = (v, d = 2) => Number.isFinite(v)
    ? v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtC = (z, unit, d = 2) => isFiniteC(z) ? `${nf(abs(z), d)} ${unit} ∠ ${nf(norm360(argDeg(z)), 1)}°` : '—';
  const orderText = o => o.split('').join(' · ');

  // ---------- состояние ----------
  let state = demoState('mo');
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && SCHEMES[saved.scheme]) state = { ...demoState(saved.scheme), ...saved };
  } catch (e) {}

  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };

  // ---------- построение элементов ----------
  const schemesEl = $('#schemes');
  for (const [key, s] of Object.entries(SCHEMES)) {
    const lbl = document.createElement('label');
    lbl.title = `${s.title}: ${orderText(s.order)}`;
    lbl.innerHTML = `<input type="radio" name="scheme" value="${key}" data-key="scheme"><span>${s.label}</span>`;
    schemesEl.appendChild(lbl);
  }
  for (const [cls, ew] of Object.entries(GOST_CLASSES)) {
    const opt = document.createElement('option');
    opt.value = cls;
    opt.textContent = `${cls} — eω ≤ ${nf(ew, ew < 1 ? 1 : 0)} мм/с`;
    $('#gclass').appendChild(opt);
  }

  const inputs = [...document.querySelectorAll('[data-key]')];
  const inputFor = key => document.querySelector(`[data-key="${key}"]:not([type=radio])`);
  function fillInputs() {
    for (const el of inputs) {
      const v = state[el.dataset.key];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v;
    }
  }
  function readInput(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'radio') return el.value;
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : 0;
  }

  // При смене схемы геометрия запоминается для каждой схемы отдельно;
  // пока пользователь не вводил свои замеры, подставляется пример для новой схемы.
  function switchScheme(next) {
    const prev = state.scheme;
    state.geom[prev] = Object.fromEntries(GEOM_KEYS.map(k => [k, state[k]]));
    state.scheme = next;
    Object.assign(state, state.geom[next] || SCHEMES[next].demo);
    if (state.demo) Object.assign(state, demoRuns(next));
    fillInputs();
  }

  for (const el of inputs) {
    el.addEventListener('input', () => {
      if (el.type === 'radio' && !el.checked) return;
      const key = el.dataset.key, value = readInput(el);
      if (key === 'scheme') switchScheme(value);
      else {
        state[key] = value;
        if (DATA_KEYS.includes(key)) state.demo = false;
      }
      save();
      update();
    });
  }

  // ---------- расчёт ----------
  function compute(s) {
    const z = coordinates(s.scheme, s.a, s.b, s.c);
    const x0 = s.x0on ? { A: polar(s.x0A, s.x0Aphi), B: polar(s.x0B, s.x0Bphi) } : { A: C(0), B: C(0) };
    const cal = calibrate({
      z, rpm: s.rpm,
      trial: [{ m: s.t1m, r: s.t1r, phi: s.t1phi }, { m: s.t2m, r: s.t2r, phi: s.t2phi }],
      x0, x1: { A: polar(s.x1A, s.x1Aphi), B: polar(s.x1B, s.x1Bphi) },
    });
    const k = s.kSource === 'cal'
      ? { A: cal.kA, B: cal.kB }
      : { A: polar(s.kA, s.kAphi), B: polar(s.kB, s.kBphi) };
    const linked = s.x0on && s.xFromX0;
    const x = linked ? x0 : { A: polar(s.xA, s.xAphi), B: polar(s.xB, s.xBphi) };
    const bal = balance({ z, rpm: s.rpm, k, x, r: [s.r1, s.r2] });
    const splits = [
      splitToPositions(bal.correction[0].mass, bal.correction[0].angle, Math.round(s.pos1), s.off1),
      splitToPositions(bal.correction[1].mass, bal.correction[1].angle, Math.round(s.pos2), s.off2),
    ];
    const tol = s.tolOn && s.massKg > 0 && s.rpmMax > 0
      ? gostTolerance({ massKg: s.massKg, gClass: s.gClass, rpmMax: s.rpmMax, z, zCm: s.cm }) : null;
    return { z, cal, k, bal, splits, tol };
  }

  function warnings(s, r) {
    const w = [];
    const { z } = r;
    const scheme = SCHEMES[s.scheme];
    if (s.a <= 0 || s.b <= 0 || s.c <= 0) w.push('Длины участков задаются положительными; положение плоскостей определяет схема.');
    else if (Math.abs(z.zB) < 1e-9 || Math.abs(z.z2 - z.z1) < 1e-9 || [z.z1, z.z2].includes(0) || [z.z1, z.z2].includes(z.zB)) {
      w.push('Опоры или плоскости коррекции совпадают — проверьте длины участков.');
    } else if (pointOrder(z) !== scheme.order) {
      w.push(`При этих длинах точки идут в порядке ${orderText(pointOrder(z))}, а схема ${scheme.label} — это ${orderText(scheme.order)}. Проверьте l<sub>A1</sub>, l<sub>12</sub>, l<sub>2B</sub> или выберите другую схему.`);
    }
    if (s.rpm <= 0) w.push('Частота вращения должна быть больше нуля.');
    if (s.r1 <= 0 || s.r2 <= 0) w.push('Радиусы установки грузов должны быть больше нуля.');
    if (s.kSource === 'cal') {
      if (!isFiniteC(r.cal.kA) || !isFiniteC(r.cal.kB)) {
        w.push('Калибровка не определена: отклик на пробные грузы равен нулю или геометрия вырождена.');
      }
      if (s.x0on) {
        // Практическое правило: пробный груз должен заметно менять вибрацию
        for (const [name, x0, x1] of [['A', polar(s.x0A, s.x0Aphi), polar(s.x1A, s.x1Aphi)], ['B', polar(s.x0B, s.x0Bphi), polar(s.x1B, s.x1Bphi)]]) {
          if (abs(x0) > 0 && abs(sub(x1, x0)) < 0.2 * abs(x0)) {
            w.push(`Опора ${name}: пробные грузы изменили вибрацию меньше чем на 20 % — калибровка будет неточной, увеличьте пробную массу.`);
          }
        }
      }
    }
    if (s.tolOn && r.tol && (s.cm <= Math.min(z.zA, z.zB) || s.cm >= Math.max(z.zA, z.zB))) {
      w.push('Центр масс L<sub>ц</sub> обычно лежит между опорами — проверьте значение.');
    }
    return w;
  }

  // ---------- вывод ----------
  function update() {
    const scheme = SCHEMES[state.scheme];
    $('#scheme-title').textContent = `${scheme.title}: ${orderText(scheme.order)}`;
    $('#x0-block').hidden = !state.x0on;
    $('#x0-hint').hidden = state.x0on;
    $('#xFromX0-row').hidden = !state.x0on;
    $('#tol-block').hidden = !state.tolOn;
    $('#tol-info').hidden = !state.tolOn;
    const manual = state.kSource === 'manual';
    for (const el of $('#k-block').querySelectorAll('input')) el.disabled = !manual;
    const linked = state.x0on && state.xFromX0;
    for (const el of $('#x-block').querySelectorAll('input')) el.disabled = linked;

    const r = compute(state);
    lastResult = r;

    // Связанные поля показывают фактически используемые значения и запоминают их,
    // чтобы при отключении связи начать с них
    const mirror = (key, v) => {
      if (!Number.isFinite(v)) return;
      state[key] = +v.toFixed(4);
      inputFor(key).value = state[key];
    };
    if (!manual) {
      mirror('kA', abs(r.cal.kA)); mirror('kAphi', norm360(argDeg(r.cal.kA)));
      mirror('kB', abs(r.cal.kB)); mirror('kBphi', norm360(argDeg(r.cal.kB)));
    }
    if (linked) for (const k of ['A', 'Aphi', 'B', 'Bphi']) mirror(`x${k}`, state[`x0${k}`]);

    $('#kA-out').innerHTML = fmtC(r.cal.kA, '<small>Н/мкм</small>');
    $('#kB-out').innerHTML = fmtC(r.cal.kB, '<small>Н/мкм</small>');
    $('#k-note').textContent = manual
      ? 'Результат калибровки. Для балансировки используются жёсткости, введённые вручную.'
      : 'Результат калибровки; используется для балансировки.';

    renderWeight($('#w1'), 0, r);
    renderWeight($('#w2'), 1, r);
    renderVerdict(r);
    drawRotor(r.z);

    if (r.tol) {
      $('#tol-info').innerHTML = `Допустимый удельный дисбаланс e<sub>ст</sub> = ${nf(r.tol.eUm, 1)} мкм, D<sub>ст</sub> = ${nf(r.tol.Dst, 0)} г·мм.
        Верхнее значение по формуле (4) без технологических и эксплуатационных дисбалансов, распределение по плоскостям — формулы (7), (8).`;
    }

    $('#alerts').innerHTML = warnings(state, r).map(t => `<div class="alert">${t}</div>`).join('');

    if ($('#plots').open && window.Plotly) drawPlots(r);
  }
  let lastResult = null;

  function renderVerdict(r) {
    const el = $('#verdict');
    // При несоответствии геометрии схеме результат недостоверен — вердикт не выносим
    const geometryOk = pointOrder(r.z) === SCHEMES[state.scheme].order;
    if (!r.tol || !geometryOk || !r.bal.correction.every(c => Number.isFinite(c.mass))) { el.hidden = true; return; }
    const over = r.bal.correction.map((c, i) => c.mass * (i ? state.r2 : state.r1) / (i ? r.tol.D2 : r.tol.D1));
    const worst = Math.max(...over);
    el.hidden = false;
    el.className = `verdict ${worst > 1 ? 'bad' : 'good'}`;
    el.innerHTML = worst > 1
      ? `<b>Требуется балансировка</b> — дисбаланс превышает допуск класса ${state.gClass} в ${nf(worst, 1)} раза`
      : `<b>Дисбаланс в допуске</b> класса ${state.gClass} (${nf(worst * 100, 0)} % от допустимого)`;
  }

  function renderWeight(el, i, r) {
    const U = r.bal.unbalance[i], corr = r.bal.correction[i], split = r.splits[i];
    const radius = i ? state.r2 : state.r1, positions = Math.round(i ? state.pos2 : state.pos1);
    const offset = i ? state.off2 : state.off1;
    const ok = isFiniteC(U);
    let splitHtml = '';
    if (ok && split) {
      const parts = split.filter(p => p.mass > corr.mass * 0.005);
      splitHtml = `<div class="split"><div class="split-title">По позициям (${positions} шт.)</div>${
        parts.map(p => `<div><span>№${p.position} <small>${nf(p.angle, 0)}°</small></span><b>${nf(p.mass)} г</b></div>`).join('')}</div>`;
    }
    let tolHtml = '';
    if (ok && r.tol) {
      const D = corr.mass * radius, Dper = i ? r.tol.D2 : r.tol.D1, ratio = D / Dper;
      tolHtml = `<div class="tol ${ratio > 1 ? 'bad' : 'good'}">
        <div><span>Дисбаланс</span><b>${nf(D, 0)} г·мм</b></div>
        <div><span>Допуск</span><b>${nf(Dper, 0)} г·мм</b></div>
        <div class="bar"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
        <div class="tol-note">${ratio > 1 ? `превышение в ${nf(ratio, 1)} раза` : `${nf(ratio * 100, 0)} % допуска`} · допустимо ${nf(Dper / radius)} г на R ${nf(radius, 0)}</div>
      </div>`;
    }
    el.innerHTML = `
      <div class="plane">Плоскость ${i + 1}</div>
      <div class="mass">${ok ? nf(corr.mass) : '—'} <small>г</small></div>
      <div class="angle">${ok ? `под углом ${nf(corr.angle, 1)}°` : '&nbsp;'}</div>
      <div class="meta">на радиусе ${nf(radius, 0)} мм</div>
      ${polarSvg(ok ? norm360(argDeg(U)) : null, ok ? corr.angle : null, positions >= 3 ? positions : 0, offset)}
      <div class="legend"><span class="lc">груз</span><span class="lu">дисбаланс ${ok ? nf(norm360(argDeg(U)), 1) + '°' : ''}</span></div>
      ${splitHtml}${tolHtml}`;
  }

  // Полярная диаграмма плоскости: 0° справа, углы против часовой стрелки
  function polarSvg(uAngle, cAngle, positions, offset) {
    const cx = 60, cy = 60, R = 42;
    const pt = (deg, r) => [cx + r * Math.cos(deg * Math.PI / 180), cy - r * Math.sin(deg * Math.PI / 180)];
    const ticks = [0, 90, 180, 270].map(d => { const [x, y] = pt(d, R + 11); return `<text class="tick" x="${x}" y="${y}">${d}°</text>`; }).join('');
    let holes = '';
    for (let k = 0; k < positions; k++) {
      const [x, y] = pt(offset + k * 360 / positions, R);
      holes += `<circle class="hole" cx="${x}" cy="${y}" r="2.2"/>`;
    }
    let marks = '';
    if (uAngle !== null) {
      const [ux, uy] = pt(uAngle, R), [kx, ky] = pt(cAngle, R);
      marks = `<line class="u-line" x1="${cx}" y1="${cy}" x2="${ux}" y2="${uy}"/>
        <line class="c-line" x1="${cx}" y1="${cy}" x2="${kx}" y2="${ky}"/>
        <circle class="u-dot" cx="${ux}" cy="${uy}" r="5"/>
        <circle class="c-dot" cx="${kx}" cy="${ky}" r="6.5"/>`;
    }
    return `<svg class="polar" viewBox="-10 0 140 120" aria-hidden="true">
      <circle class="ring" cx="${cx}" cy="${cy}" r="${R}"/>
      <line class="axis" x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}"/>
      <line class="axis" x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}"/>
      ${ticks}${holes}${marks}</svg>`;
  }

  // Схема ротора в масштабе: опоры, плоскости коррекции, центр масс и размеры
  function drawRotor(z) {
    const W = 640, padL = 40, padR = 40, yShaft = 62;
    const pts = [z.zA, z.zB, z.z1, z.z2];
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const span = hi - lo || 1;
    const X = v => padL + (v - lo) / span * (W - padL - padR);
    const support = (zz, name) => {
      const x = X(zz);
      return `<path class="support" d="M${x} ${yShaft + 4} L${x - 13} ${yShaft + 28} L${x + 13} ${yShaft + 28} Z"/>
        <line class="ground" x1="${x - 18}" y1="${yShaft + 31}" x2="${x + 18}" y2="${yShaft + 31}"/>
        <text class="lbl" x="${x}" y="${yShaft + 50}">${name}</text>`;
    };
    const disc = (zz, name) => {
      const x = X(zz);
      return `<rect class="disc" x="${x - 6}" y="${yShaft - 34}" width="12" height="68" rx="4"/>
        <text class="lbl" x="${x}" y="${yShaft - 42}">${name}</text>`;
    };
    // Размерные линии на трёх уровнях, чтобы подписи не перекрывались
    const dim = (z1, z2, level, text) => {
      const y = 134 + level * 24, x1 = X(z1), x2 = X(z2);
      const l = Math.min(x1, x2), r = Math.max(x1, x2);
      const arrows = r - l > 14
        ? `<path class="arrow" d="M${l} ${y} l6 -3 v6 Z"/><path class="arrow" d="M${r} ${y} l-6 -3 v6 Z"/>` : '';
      return `<line class="ext" x1="${x1}" y1="${yShaft + 36}" x2="${x1}" y2="${y + 4}"/>
        <line class="ext" x1="${x2}" y1="${yShaft + 36}" x2="${x2}" y2="${y + 4}"/>
        <line class="dim" x1="${l}" y1="${y}" x2="${r}" y2="${y}"/>${arrows}
        <text class="dimtxt" x="${(l + r) / 2}" y="${y + 4}">${text}</text>`;
    };
    // Центр масс — стандартный знак (круг с двумя закрашенными четвертями)
    let cm = '';
    if (state.tolOn && Number.isFinite(state.cm) && state.cm >= lo && state.cm <= hi) {
      const x = X(state.cm), y = yShaft, r = 7;
      cm = `<g class="cm"><circle cx="${x}" cy="${y}" r="${r}"/>
        <path d="M${x} ${y} L${x + r} ${y} A${r} ${r} 0 0 0 ${x} ${y - r} Z M${x} ${y} L${x - r} ${y} A${r} ${r} 0 0 0 ${x} ${y + r} Z"/></g>`;
    }
    const s = state;
    $('#rotor').innerHTML = `
      ${dim(z.zA, z.z1, 0, `A–1: ${nf(s.a, 0)}`)}
      ${dim(z.z1, z.z2, 1, `1–2: ${nf(s.b, 0)}`)}
      ${dim(z.z2, z.zB, 2, `2–B: ${nf(s.c, 0)}`)}
      <line class="shaft" x1="${X(lo) - 14}" y1="${yShaft}" x2="${X(hi) + 14}" y2="${yShaft}"/>
      ${support(z.zA, 'A')}${support(z.zB, 'B')}
      ${disc(z.z1, '1')}${disc(z.z2, '2')}${cm}`;
  }

  // ---------- 3D-графики (Plotly подгружается только при открытии блока) ----------
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let plotlyLoading = null;
  function loadPlotly() {
    if (window.Plotly) return Promise.resolve();
    if (!plotlyLoading) {
      plotlyLoading = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = PLOTLY_URL; sc.onload = resolve;
        sc.onerror = () => { plotlyLoading = null; reject(new Error('Не удалось загрузить Plotly')); };
        document.head.appendChild(sc);
      });
    }
    return plotlyLoading;
  }
  function showPlots() {
    if (!$('#plots').open) return;
    loadPlotly().then(() => drawPlots(lastResult)).catch(err => {
      $('#plot1').innerHTML = `<p class="hint" style="padding:16px">${err.message}. Проверьте подключение к интернету.</p>`;
    });
  }
  $('#plots').addEventListener('toggle', showPlots);

  function drawPlots(r) {
    const red = css('--unbalance'), blue = css('--load'), text = css('--text'), grid = css('--border');
    const circle = (rad, z, color) => {
      const xs = [], ys = [], zs = [];
      for (let i = 0; i <= 72; i++) { const t = 2 * Math.PI * i / 72; xs.push(rad * Math.cos(t)); ys.push(z); zs.push(rad * Math.sin(t)); }
      return { type: 'scatter3d', mode: 'lines', x: xs, y: ys, z: zs, surfaceaxis: 1, surfacecolor: color,
        opacity: 0.2, line: { color, width: 1 }, hoverinfo: 'skip', showlegend: false };
    };
    const vector = (p, z, color, name, hover) => ({ type: 'scatter3d', mode: 'lines+markers+text',
      x: [0, p.re], y: [z, z], z: [0, p.im], text: ['', name], textposition: 'top center', textfont: { color: text },
      line: { color, width: 5 }, marker: { size: 3, color }, showlegend: false, hovertemplate: `${hover}<extra></extra>` });
    const shaft = zs => ({ type: 'scatter3d', mode: 'lines', x: [0, 0], y: [Math.min(...zs), Math.max(...zs)], z: [0, 0],
      line: { color: css('--shaft'), width: 8 }, hoverinfo: 'skip', showlegend: false });
    const finiteMax = (...xs) => { const m = Math.max(...xs); return Number.isFinite(m) && m > 0 ? m : 1; };
    const layout = (title, max, unit) => {
      const ax = (t, range) => ({ title: { text: t }, range, color: text, gridcolor: grid, zerolinecolor: grid, backgroundcolor: 'rgba(0,0,0,0)' });
      return { title: { text: title, font: { size: 14, color: text } }, paper_bgcolor: 'rgba(0,0,0,0)', font: { color: text },
        margin: { l: 0, r: 0, t: 36, b: 0 }, uirevision: 'keep',
        scene: { xaxis: ax(`x, ${unit}`, [-max, max]), yaxis: ax('z, мм'), zaxis: ax(`y, ${unit}`, [-max, max]),
          aspectmode: 'manual', aspectratio: { x: 1, y: 1.25, z: 1 }, camera: { eye: { x: 1.6, y: -1.4, z: 0.9 } } } };
    };
    const cfg = { responsive: true, displaylogo: false };
    const { z, cal, bal } = r;
    const zs = [z.zA, z.zB, z.z1, z.z2];

    // 1: нагрузки от пробных грузов и их пересчёт на опоры
    const loads = [[cal.DA, z.zA, red, 'A'], [cal.DB, z.zB, red, 'B'], [cal.F1, z.z1, blue, '1'], [cal.F2, z.z2, blue, '2']];
    const max1 = finiteMax(...loads.map(l => abs(l[0])));
    const t1 = [shaft(zs)];
    for (const [D, zz, col, name] of loads) t1.push(circle(abs(D), zz, col), vector(D, zz, col, name, `${name}: ${fmtC(D, 'Н')}`));
    Plotly.react('plot1', t1, layout('Калибровка: нагрузки от пробных грузов', max1, 'Н'), cfg);

    // 2: корректирующие грузы на радиусах установки
    const t2 = [shaft(zs)];
    bal.correction.forEach((c, i) => {
      const rad = i ? state.r2 : state.r1, zz = i ? z.z2 : z.z1;
      t2.push(circle(rad, zz, blue), vector(polar(rad, c.angle), zz, blue, String(i + 1), `Груз ${i + 1}: ${nf(c.mass)} г ∠ ${nf(c.angle, 1)}°`));
    });
    Plotly.react('plot2', t2, layout('Балансировка: корректирующие грузы', finiteMax(state.r1, state.r2), 'мм'), cfg);
  }

  // ---------- панель инструментов ----------
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_ICONS = {
    auto: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
    dark: '<svg viewBox="0 0 16 16"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" fill="currentColor"/></svg>',
  };
  const THEME_NAMES = { auto: 'авто', light: 'светлая', dark: 'тёмная' };
  let theme = document.documentElement.dataset.theme || 'auto';
  function applyTheme() {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try { theme === 'auto' ? localStorage.removeItem('diamech-theme') : localStorage.setItem('diamech-theme', theme); } catch (e) {}
    $('#theme').innerHTML = THEME_ICONS[theme];
    $('#theme').title = `Тема: ${THEME_NAMES[theme]}`;
    if ($('#plots').open && window.Plotly && lastResult) drawPlots(lastResult);
  }
  $('#theme').addEventListener('click', () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]; applyTheme(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

  $('#reset').addEventListener('click', () => {
    state = demoState(state.scheme);
    save(); fillInputs(); update();
  });

  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
  }
  $('#copy-report').addEventListener('click', () => {
    const s = state, r = lastResult;
    const plain = (z, unit) => fmtC(z, unit);
    const lines = [
      'Балансировка жёсткого двухопорного ротора',
      `Схема: ${SCHEMES[s.scheme].label} — ${SCHEMES[s.scheme].title} (${orderText(SCHEMES[s.scheme].order)})`,
      `l_A1 = ${s.a} мм, l_12 = ${s.b} мм, l_2B = ${s.c} мм, n = ${s.rpm} об/мин`,
      '',
      'Калибровка',
      `  Пробный груз 1: ${s.t1m} г, R = ${s.t1r} мм, φ = ${s.t1phi}°`,
      `  Пробный груз 2: ${s.t2m} г, R = ${s.t2r} мм, φ = ${s.t2phi}°`,
      s.x0on ? `  Пуск 0: A ${s.x0A} мкм ∠ ${s.x0Aphi}°, B ${s.x0B} мкм ∠ ${s.x0Bphi}°` : '  Пуск 0: не учитывается',
      `  Пуск 1 (с пробными грузами): A ${s.x1A} мкм ∠ ${s.x1Aphi}°, B ${s.x1B} мкм ∠ ${s.x1Bphi}°`,
      `  k_A = ${plain(r.cal.kA, 'Н/мкм')}`,
      `  k_B = ${plain(r.cal.kB, 'Н/мкм')}`,
      '',
      'Балансировка',
      `  Жёсткости: ${s.kSource === 'cal' ? 'из калибровки' : `вручную, k_A = ${plain(r.k.A, 'Н/мкм')}, k_B = ${plain(r.k.B, 'Н/мкм')}`}`,
      `  Вибрация: A ${s.xA} мкм ∠ ${s.xAphi}°, B ${s.xB} мкм ∠ ${s.xBphi}°`,
      ...r.bal.correction.flatMap((c, i) => [
        `  Груз ${i + 1}: ${nf(c.mass)} г под углом ${nf(c.angle, 1)}° на радиусе ${i ? s.r2 : s.r1} мм (дисбаланс ∠ ${nf(norm360(argDeg(r.bal.unbalance[i])), 1)}°)`,
        ...(r.splits[i] ? [`    по позициям: ${r.splits[i].filter(p => p.mass > c.mass * 0.005).map(p => `№${p.position} (${nf(p.angle, 0)}°) — ${nf(p.mass)} г`).join(', ')}`] : []),
        ...(r.tol ? [`    дисбаланс ${nf(c.mass * (i ? s.r2 : s.r1), 0)} г·мм, допуск ${nf(i ? r.tol.D2 : r.tol.D1, 0)} г·мм`] : []),
      ]),
      ...(r.tol ? ['', `Допуск: ГОСТ 22061-76, класс ${s.gClass}, m = ${s.massKg} кг, n_max = ${s.rpmMax} об/мин, L_ц = ${s.cm} мм, e_ст = ${nf(r.tol.eUm, 1)} мкм`] : []),
    ];
    const text = lines.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('Отчёт скопирован'), () => toast('Не удалось скопировать'));
  });

  fillInputs();
  applyTheme();
  update();
  showPlots(); // блок раскрыт по умолчанию — графики строятся сразу
})();
