(() => {
  const colors = ["#df6545", "#4178a8", "#d69c27", "#43896c", "#7d63a9", "#c05477", "#348b98"];
  const presets = [
    { key: "linear", name: "一次函数", symbol: "ax+b", formula: "y = ax + b", expression: "a*x+b", params: { a: [1,-10,10,.1], b: [0,-10,10,.1] } },
    { key: "quadratic", name: "二次函数", symbol: "ax²", formula: "y = ax² + bx + c", expression: "a*x^2+b*x+c", params: { a: [1,-5,5,.1], b: [0,-10,10,.1], c: [0,-10,10,.1] } },
    { key: "power", name: "幂函数", symbol: "axⁿ", formula: "y = axⁿ", expression: "a*x^n", params: { a: [1,-5,5,.1], n: [3,-5,8,1] } },
    { key: "inverse", name: "反比例函数", symbol: "a/x", formula: "y = a/x + b", expression: "a/x+b", params: { a: [1,-10,10,.1], b: [0,-10,10,.1] } },
    { key: "root", name: "根式函数", symbol: "√x", formula: "y = a√(x-h) + k", expression: "a*sqrt(x-h)+k", params: { a: [1,-5,5,.1], h: [0,-10,10,.1], k: [0,-10,10,.1] } },
    { key: "absolute", name: "绝对值函数", symbol: "|x|", formula: "y = a|x-h| + k", expression: "a*abs(x-h)+k", params: { a: [1,-5,5,.1], h: [0,-10,10,.1], k: [0,-10,10,.1] } },
    { key: "exponential", name: "指数函数", symbol: "abˣ", formula: "y = abˣ + c", expression: "a*b^x+c", params: { a: [1,-5,5,.1], b: [2,.1,6,.1], c: [0,-10,10,.1] } },
    { key: "logarithm", name: "对数函数", symbol: "logᵦx", formula: "y = a logᵦ(x-h) + k", expression: "a*log(x-h)/log(b)+k", params: { a: [1,-5,5,.1], b: [2,.1,10,.1], h: [0,-10,10,.1], k: [0,-10,10,.1] } },
    { key: "sine", name: "正弦函数", symbol: "sin", formula: "y = a sin(bx+c) + d", expression: "a*sin(b*x+c)+d", params: { a: [1,-5,5,.1], b: [1,-5,5,.1], c: [0,-6.28,6.28,.1], d: [0,-5,5,.1] } },
    { key: "cosine", name: "余弦函数", symbol: "cos", formula: "y = a cos(bx+c) + d", expression: "a*cos(b*x+c)+d", params: { a: [1,-5,5,.1], b: [1,-5,5,.1], c: [0,-6.28,6.28,.1], d: [0,-5,5,.1] } },
    { key: "tangent", name: "正切函数", symbol: "tan", formula: "y = a tan(bx+c) + d", expression: "a*tan(b*x+c)+d", params: { a: [1,-5,5,.1], b: [1,-5,5,.1], c: [0,-6.28,6.28,.1], d: [0,-5,5,.1] } }
  ];
  let nextId = 3;
  const makeFromPreset = (preset, id) => ({
    id, presetKey: preset.key, name: preset.name, expression: preset.expression, formula: preset.formula,
    params: Object.fromEntries(Object.entries(preset.params).map(([key, [value, min, max, step]]) => [key, { value, min, max, step }])),
    color: colors[(id - 1) % colors.length], visible: true, showDerivative: false
  });
  let functions = [makeFromPreset(presets[0], 1), makeFromPreset(presets[1], 2)];

  const canvas = document.getElementById("graphCanvas");
  const wrap = document.getElementById("canvasWrap");
  const ctx = canvas.getContext("2d");
  const list = document.getElementById("functionList");
  const presetList = document.getElementById("presetList");
  const cursorCard = document.getElementById("cursorCard");
  const viewReadout = document.getElementById("viewReadout");
  let showGrid = true;
  let showIntersections = true;
  let view = { cx: 0, cy: 0, scale: 42 };
  let dragging = false;
  let dragStart = null;
  let markerX = null;
  let expressionSyncTimer = null;

  function normalizeExpression(expression) {
    return expression
      .trim()
      .replace(/π/gi, "pi")
      .replace(/√/g, "sqrt")
      .replace(/\bln\b/gi, "log")
      .replace(/\^/g, "**")
      .replace(/\bpi\b/gi, "Math.PI")
      .replace(/\be\b/g, "Math.E")
      .replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|exp|floor|ceil|round|log10|log)\b/gi, "Math.$1");
  }

  function evaluateScalar(value) {
    if (typeof value === "number") return value;
    const normalized = normalizeExpression(String(value).trim());
    if (!normalized || /\bx\b/i.test(normalized) || /[^0-9+\-*/().,\sA-Za-z_]/.test(normalized)) return NaN;
    try {
      const result = new Function(`"use strict"; return (${normalized});`)();
      return Number.isFinite(result) ? result : NaN;
    } catch { return NaN; }
  }

  function compile(expression, params = null) {
    let prepared = expression;
    if (params) {
      Object.entries(params).forEach(([key, config]) => {
        const value = evaluateScalar(config.value);
        if (!Number.isFinite(value)) throw new Error(`参数 ${key} 无效`);
        prepared = prepared.replace(new RegExp(`\\b${key}\\b`, "g"), `(${value})`);
      });
    }
    const normalized = normalizeExpression(prepared);
    if (!normalized || /[^0-9xX+\-*/().,\sA-Za-z_]/.test(normalized)) throw new Error("表达式包含不支持的符号");
    const fn = new Function("x", `"use strict"; return (${normalized});`);
    fn(1.2345);
    return fn;
  }

  function activeFunctions() {
    return functions.map(item => {
      try { return { ...item, fn: compile(item.expression, item.params), error: null }; }
      catch (error) { return { ...item, fn: null, error: "请检查表达式" }; }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }

  function neatNumber(value) {
    const raw = String(value).trim();
    if (/^e$/i.test(raw)) return "e";
    if (/^(pi|π)$/i.test(raw)) return "π";
    const number = evaluateScalar(value);
    if (!Number.isFinite(number)) return raw || "?";
    if (Math.abs(number) < 1e-12) return "0";
    return Number(number.toFixed(6)).toString();
  }

  function coefficient(value, variable) {
    const number = evaluateScalar(value);
    if (number === 1) return variable;
    if (number === -1) return `−${variable}`;
    return `${neatNumber(value)}${variable}`;
  }

  function addConstant(base, value) {
    const number = evaluateScalar(value);
    if (number === 0) return base;
    return `${base} ${number > 0 ? "+" : "−"} ${number > 0 ? neatNumber(value) : neatNumber(Math.abs(number))}`;
  }

  function prettyExpression(expression) {
    return String(expression)
      .replace(/sqrt\s*\(/gi, "√(")
      .replace(/\bpi\b/gi, "π")
      .replace(/\*\*/g, "^")
      .replace(/\*/g, "·")
      .replace(/\^2\b/g, "²")
      .replace(/\^3\b/g, "³");
  }

  function substitutedExpression(item) {
    let expression = item.expression;
    if (item.params) {
      Object.entries(item.params).forEach(([key, config]) => {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, "g"), neatNumber(config.value));
      });
    }
    expression = expression
      .replace(/\b1\*x\b/g, "x")
      .replace(/\b-1\*x\b/g, "-x")
      .replace(/\+\s*0(?![.\d])/g, "")
      .replace(/-\s*0(?![.\d])/g, "")
      .trim();
    return prettyExpression(expression);
  }

  function parameterNames(expression) {
    const reserved = new Set(["x", "e", "pi", "sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "abs", "exp", "log", "log10", "floor", "ceil", "round", "math"]);
    const names = [];
    for (const match of String(expression).matchAll(/\b([A-Za-z_]\w*)\b/g)) {
      const name = match[1];
      if (!reserved.has(name.toLowerCase()) && !names.includes(name)) names.push(name);
    }
    return names;
  }

  function syncExpressionParameters(item) {
    if (!item.params) return;
    const previous = item.params;
    item.params = Object.fromEntries(parameterNames(item.expression).map(key => {
      const integerExponent = item.presetKey === "power" && key === "n";
      return [key, previous[key] || { value: integerExponent ? 2 : 1, min: integerExponent ? -5 : -10, max: integerExponent ? 8 : 10, step: integerExponent ? 1 : .1 }];
    }));
  }

  function resolvedFormula(item) {
    if (!item.params) return `y = ${prettyExpression(item.expression)}`;
    const preset = presets.find(candidate => candidate.key === item.presetKey);
    if (!preset || item.expression !== preset.expression) return `y = ${substitutedExpression(item)}`;
    const p = Object.fromEntries(Object.entries(item.params).map(([key, config]) => [key, config.value]));
    const n = key => evaluateScalar(p[key]);
    switch (item.presetKey) {
      case "linear": return `y = ${addConstant(coefficient(p.a, "x"), p.b)}`;
      case "quadratic": {
        const terms = [];
        if (n("a") !== 0) terms.push(coefficient(p.a, "x²"));
        if (n("b") !== 0) terms.push(`${n("b") > 0 && terms.length ? "+ " : n("b") < 0 ? "− " : ""}${coefficient(Math.abs(n("b")), "x")}`);
        if (n("c") !== 0) terms.push(`${n("c") > 0 && terms.length ? "+ " : n("c") < 0 ? "− " : ""}${neatNumber(Math.abs(n("c")))}`);
        return `y = ${terms.join(" ") || "0"}`;
      }
      case "power": return `y = ${coefficient(p.a, `x^${neatNumber(p.n)}`)}`;
      case "inverse": return `y = ${addConstant(n("a") === 1 ? "1/x" : n("a") === -1 ? "−1/x" : `${neatNumber(p.a)}/x`, p.b)}`;
      case "root": return `y = ${addConstant(coefficient(p.a, `√(${n("h") === 0 ? "x" : `x ${n("h") > 0 ? "−" : "+"} ${neatNumber(Math.abs(n("h")))}`})`), p.k)}`;
      case "absolute": return `y = ${addConstant(coefficient(p.a, `|${n("h") === 0 ? "x" : `x ${n("h") > 0 ? "−" : "+"} ${neatNumber(Math.abs(n("h")))}|`}`), p.k)}`;
      case "exponential": return `y = ${addConstant(coefficient(p.a, `${neatNumber(p.b)}^x`), p.c)}`;
      case "logarithm": return `y = ${addConstant(coefficient(p.a, `log_${neatNumber(p.b)}(${n("h") === 0 ? "x" : `x ${n("h") > 0 ? "−" : "+"} ${neatNumber(Math.abs(n("h")))}`})`), p.k)}`;
      case "sine": return `y = ${addConstant(coefficient(p.a, `sin(${addConstant(coefficient(p.b, "x"), p.c)})`), p.d)}`;
      case "cosine": return `y = ${addConstant(coefficient(p.a, `cos(${addConstant(coefficient(p.b, "x"), p.c)})`), p.d)}`;
      case "tangent": return `y = ${addConstant(coefficient(p.a, `tan(${addConstant(coefficient(p.b, "x"), p.c)})`), p.d)}`;
      default: return `y = ${item.expression}`;
    }
  }

  function renderFunctionList() {
    const compiled = activeFunctions();
    list.innerHTML = compiled.map(item => `
      <article class="function-card ${item.error ? "invalid" : ""}" style="--fn-color:${item.color}" data-id="${item.id}">
        <div class="function-meta">
          <button class="card-action visibility ${item.visible ? "shown" : "hidden"}" title="${item.visible ? "点击隐藏此函数" : "点击显示此函数"}" aria-pressed="${item.visible}">${item.visible ? "👁" : "◌"}</button>
          <span class="color-dot"></span>
          <input class="function-name" value="${escapeHtml(item.name)}" aria-label="函数名称" />
          <button class="card-action remove" title="删除函数">×</button>
        </div>
        <div class="expression-row editable-formula">
          <span class="fx">y =</span>
          <input class="expression-input" value="${escapeHtml(item.expression)}" spellcheck="false" aria-label="函数表达式" />
        </div>
        ${!item.params ? `<div class="math-keyboard" aria-label="函数数学键盘">
          ${[["√","sqrt("],["sin","sin("],["cos","cos("],["tan","tan("],["ln","log("],["|x|","abs("],["x²","^2"],["xʸ","^"],["π","pi"],["e","e"],["(","("],[")",")"]].map(([label, value]) => `<button type="button" data-insert="${value}">${label}</button>`).join("")}
        </div>` : ""}
        ${item.params ? `<div class="parameter-list">${Object.entries(item.params).map(([key, config]) => `
          <label class="parameter-row">
            <span class="parameter-symbol">${key}</span>
            <input class="parameter-range" type="range" data-param="${key}" min="${config.min}" max="${config.max}" step="${config.step}" value="${Number.isFinite(evaluateScalar(config.value)) ? evaluateScalar(config.value) : config.min}" />
            <input class="parameter-number" type="text" inputmode="text" data-param="${key}" value="${escapeHtml(config.value)}" title="可输入数字、e、pi 或 π" />
          </label>`).join("")}</div>` : ""}
        <div class="resolved-formula"><span>当前函数</span><strong>${escapeHtml(resolvedFormula(item))}</strong></div>
        <label class="derivative-toggle">
          <input type="checkbox" class="derivative-checkbox" ${item.showDerivative ? "checked" : ""} />
          <span class="toggle-track"></span><span>显示一阶导函数 <i>y′</i></span>
        </label>
        ${item.error ? `<div class="error-text">${item.error}</div>` : ""}
      </article>`).join("");
  }

  function renderPresetList() {
    presetList.innerHTML = presets.map(preset => `<button class="preset-item" data-preset="${preset.key}">
      <span class="preset-symbol">${preset.symbol}</span>
      <span class="preset-copy"><strong>${preset.name}</strong><code>${preset.formula}</code></span>
      <span class="preset-plus">＋</span>
    </button>`).join("") + `<button class="preset-item custom-preset" data-preset="custom">
      <span class="preset-symbol">ƒ?</span>
      <span class="preset-copy"><strong>自定义函数</strong><code>使用数学键盘自由编写</code></span>
      <span class="preset-plus">＋</span>
    </button>`;
  }

  function addFunction(expression = "sin(x)", name = "自定义函数", presetKey = null) {
    const id = nextId++;
    const preset = presets.find(item => item.key === presetKey);
    functions.push(preset ? makeFromPreset(preset, id) : { id, expression, name, color: colors[(id - 1) % colors.length], visible: true });
    renderFunctionList();
    draw();
    requestAnimationFrame(() => list.querySelector(`[data-id="${id}"] .expression-input`)?.select());
  }

  list.addEventListener("input", event => {
    const card = event.target.closest(".function-card");
    if (!card) return;
    const item = functions.find(f => f.id === Number(card.dataset.id));
    if (event.target.classList.contains("expression-input")) {
      item.expression = event.target.value;
      const resolved = card.querySelector(".resolved-formula strong");
      if (resolved) resolved.textContent = resolvedFormula(item);
      if (item.params) {
        clearTimeout(expressionSyncTimer);
        const cursor = event.target.selectionStart ?? item.expression.length;
        expressionSyncTimer = setTimeout(() => {
          syncExpressionParameters(item);
          renderFunctionList(); draw();
          const input = list.querySelector(`[data-id="${item.id}"] .expression-input`);
          if (input) { input.focus(); input.setSelectionRange(Math.min(cursor, input.value.length), Math.min(cursor, input.value.length)); }
        }, 220);
      }
    }
    if (event.target.classList.contains("function-name")) item.name = event.target.value;
    if (event.target.dataset.param && item.params) {
      const value = event.target.classList.contains("parameter-range") ? Number(event.target.value) : event.target.value.trim();
      item.params[event.target.dataset.param].value = value;
      const numericValue = evaluateScalar(value);
      card.querySelectorAll(`[data-param="${event.target.dataset.param}"]`).forEach(input => {
        if (input === event.target) return;
        if (input.classList.contains("parameter-range")) {
          if (Number.isFinite(numericValue)) input.value = numericValue;
        } else input.value = value;
      });
      const resolved = card.querySelector(".resolved-formula strong");
      if (resolved) resolved.textContent = resolvedFormula(item);
    }
    draw();
  });

  list.addEventListener("change", event => {
    const card = event.target.closest(".function-card");
    if (!card) return;
    const item = functions.find(f => f.id === Number(card.dataset.id));
    if (event.target.classList.contains("derivative-checkbox")) {
      item.showDerivative = event.target.checked;
      draw();
    }
  });
  list.addEventListener("click", event => {
    const card = event.target.closest(".function-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const insertButton = event.target.closest("[data-insert]");
    if (insertButton) {
      const input = card.querySelector(".expression-input");
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + insertButton.dataset.insert + input.value.slice(end);
      const cursor = start + insertButton.dataset.insert.length;
      input.setSelectionRange(cursor, cursor); input.focus();
      const item = functions.find(f => f.id === id); item.expression = input.value;
      draw(); return;
    }
    if (event.target.closest(".remove")) {
      functions = functions.filter(f => f.id !== id);
      renderFunctionList(); draw();
    }
    if (event.target.closest(".visibility")) {
      const item = functions.find(f => f.id === id); item.visible = !item.visible;
      renderFunctionList(); draw();
    }
  });

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const sx = x => (x - view.cx) * view.scale + wrap.clientWidth / 2;
  const sy = y => (view.cy - y) * view.scale + wrap.clientHeight / 2;
  const wx = px => (px - wrap.clientWidth / 2) / view.scale + view.cx;
  const wy = py => view.cy - (py - wrap.clientHeight / 2) / view.scale;

  function niceStep(target) {
    const power = 10 ** Math.floor(Math.log10(target));
    const n = target / power;
    const factor = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
    return factor * power;
  }

  function formatTick(n, step) {
    if (Math.abs(n) < step / 1000) return "0";
    if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)) return n.toExponential(2);
    const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(step))));
    return n.toFixed(decimals).replace(/\.0+$|(?<=\..*?)0+$/g, "");
  }

  function drawGrid(width, height) {
    const step = niceStep(74 / view.scale);
    const xMin = wx(0), xMax = wx(width), yMin = wy(height), yMax = wy(0);
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "top";
    if (showGrid) {
      ctx.strokeStyle = document.body.classList.contains("dark") ? "#31383a" : "#e4e3dd";
      ctx.fillStyle = document.body.classList.contains("dark") ? "#818b8c" : "#8a9292";
      for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
        const px = sx(x); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
      }
      for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
        const py = sy(y); ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
      }
    }
    const axisColor = document.body.classList.contains("dark") ? "#8d9797" : "#596567";
    ctx.strokeStyle = axisColor; ctx.fillStyle = axisColor; ctx.lineWidth = 1.25;
    const axisY = sy(0), axisX = sx(0);
    if (axisY >= 0 && axisY <= height) { ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(width, axisY); ctx.stroke(); }
    if (axisX >= 0 && axisX <= width) { ctx.beginPath(); ctx.moveTo(axisX, 0); ctx.lineTo(axisX, height); ctx.stroke(); }
    if (showGrid) {
      for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
        if (Math.abs(x) < step / 10) continue;
        const px = sx(x); const py = Math.max(4, Math.min(height - 17, axisY + 5));
        ctx.fillText(formatTick(x, step), px + 3, py);
      }
      for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
        if (Math.abs(y) < step / 10) continue;
        const py = sy(y); const px = Math.max(4, Math.min(width - 46, axisX + 5));
        ctx.fillText(formatTick(y, step), px, py + 3);
      }
    }
  }

  function drawFunction(item, width, height) {
    if (!item.fn || !item.visible) return;
    ctx.beginPath(); ctx.strokeStyle = item.color; ctx.lineWidth = 2.3; ctx.lineJoin = "round";
    let started = false; let prevY = null;
    for (let px = 0; px <= width; px += 1) {
      const value = item.fn(wx(px));
      const py = sy(value);
      const valid = Number.isFinite(value) && Number.isFinite(py) && Math.abs(py) < height * 20;
      if (!valid || (prevY !== null && Math.abs(py - prevY) > height * 1.5)) { started = false; prevY = null; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      prevY = py;
    }
    ctx.stroke();
  }

  function drawDerivative(item, width, height) {
    if (!item.fn || !item.visible || !item.showDerivative) return;
    ctx.save();
    ctx.beginPath(); ctx.strokeStyle = item.color; ctx.globalAlpha = .72; ctx.lineWidth = 1.8;
    ctx.setLineDash([7, 5]); ctx.lineJoin = "round";
    let started = false; let previousY = null;
    for (let px = 0; px <= width; px += 1.5) {
      const x = wx(px);
      const h = Math.max(1e-7, Math.abs(x) * 1e-6, 0.02 / view.scale);
      let value;
      try { value = (item.fn(x + h) - item.fn(x - h)) / (2 * h); } catch { value = NaN; }
      const py = sy(value);
      const valid = Number.isFinite(value) && Number.isFinite(py) && Math.abs(py) < height * 20;
      if (!valid || (previousY !== null && Math.abs(py - previousY) > height * 1.5)) { started = false; previousY = null; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      previousY = py;
    }
    ctx.stroke(); ctx.restore();
  }

  function findIntersections(items, width, height) {
    const visible = items.filter(item => item.fn && item.visible);
    const points = [];
    const addPoint = (x, y, pair) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const px = sx(x), py = sy(y);
      if (px < 0 || px > width || py < 0 || py > height) return;
      const duplicate = points.some(point => Math.hypot(sx(point.x) - px, sy(point.y) - py) < 8);
      if (!duplicate && points.length < 30) points.push({ x, y, pair });
    };
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const first = visible[i], second = visible[j];
        const diff = x => first.fn(x) - second.fn(x);
        let previous = null;
        for (let px = 0; px <= width; px += 3) {
          const x = wx(px); let d, y1, y2;
          try { y1 = first.fn(x); y2 = second.fn(x); d = y1 - y2; } catch { d = NaN; }
          const valid = Number.isFinite(d) && Number.isFinite(y1) && Number.isFinite(y2)
            && Math.abs(sy(y1)) < height * 3 && Math.abs(sy(y2)) < height * 3;
          if (valid && previous) {
            if (d === 0 || previous.d === 0 || d * previous.d < 0) {
              let left = previous.x, right = x, dl = previous.d;
              for (let k = 0; k < 42; k++) {
                const middle = (left + right) / 2; const dm = diff(middle);
                if (!Number.isFinite(dm)) break;
                if (dl * dm <= 0) right = middle; else { left = middle; dl = dm; }
              }
              const root = (left + right) / 2;
              addPoint(root, (first.fn(root) + second.fn(root)) / 2, [first.name, second.name]);
            } else if (Math.abs(d) < 1 / view.scale && Math.abs(d) <= Math.abs(previous.d)) {
              addPoint(x, (y1 + y2) / 2, [first.name, second.name]);
            }
          }
          previous = valid ? { x, d } : null;
        }
      }
    }
    return points;
  }

  function intersectionPrecision() {
    return Math.max(2, Math.min(8, Math.ceil(Math.log10(view.scale + 1))));
  }

  function drawIntersections(points) {
    const dark = document.body.classList.contains("dark");
    const precision = intersectionPrecision();
    ctx.font = "10px ui-monospace, monospace";
    points.forEach((point, index) => {
      const px = sx(point.x), py = sy(point.y);
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fillStyle = "#17222d"; ctx.fill();
      ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
      const label = `(${formatTick(point.x, 10 ** -precision)}, ${formatTick(point.y, 10 ** -precision)})`;
      const width = ctx.measureText(label).width + 12;
      const lx = Math.min(wrap.clientWidth - width - 4, px + 8);
      const ly = Math.max(4, py - 23 - (index % 2) * 17);
      ctx.fillStyle = dark ? "rgba(238,240,238,.94)" : "rgba(23,34,45,.92)";
      ctx.beginPath(); ctx.roundRect(lx, ly, width, 18, 5); ctx.fill();
      ctx.fillStyle = dark ? "#17222d" : "white"; ctx.textBaseline = "middle";
      ctx.fillText(label, lx + 6, ly + 9);
    });
  }

  function drawMarker(items, width, height) {
    if (markerX === null) return;
    const px = sx(markerX);
    if (px < 0 || px > width) return;
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(110,120,122,.65)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke(); ctx.restore();
    items.forEach(item => {
      if (!item.fn || !item.visible) return;
      const py = sy(item.fn(markerX)); if (!Number.isFinite(py) || py < -20 || py > height + 20) return;
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fillStyle = item.color; ctx.fill();
      ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  function draw() {
    const width = wrap.clientWidth, height = wrap.clientHeight;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    drawGrid(width, height);
    const items = activeFunctions();
    items.forEach(item => drawFunction(item, width, height));
    items.forEach(item => drawDerivative(item, width, height));
    if (showIntersections) drawIntersections(findIntersections(items, width, height));
    drawMarker(items, width, height);
    const left = wx(0), right = wx(width);
    viewReadout.textContent = `x: ${formatTick(left, Math.abs(right-left)/10)} ～ ${formatTick(right, Math.abs(right-left)/10)}  ·  每格约 ${formatTick(niceStep(74/view.scale), niceStep(74/view.scale))}`;
  }

  wrap.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = wrap.getBoundingClientRect(); const px = event.clientX - rect.left; const py = event.clientY - rect.top;
    const beforeX = wx(px), beforeY = wy(py);
    const factor = Math.exp(-event.deltaY * .0013);
    view.scale = Math.max(1e-8, Math.min(1e12, view.scale * factor));
    view.cx = beforeX - (px - wrap.clientWidth / 2) / view.scale;
    view.cy = beforeY + (py - wrap.clientHeight / 2) / view.scale;
    draw();
  }, { passive: false });
  wrap.addEventListener("pointerdown", event => {
    dragging = true; wrap.classList.add("dragging"); wrap.setPointerCapture(event.pointerId);
    dragStart = { x: event.clientX, y: event.clientY, cx: view.cx, cy: view.cy };
  });
  wrap.addEventListener("pointermove", event => {
    const rect = wrap.getBoundingClientRect();
    if (dragging) {
      view.cx = dragStart.cx - (event.clientX - dragStart.x) / view.scale;
      view.cy = dragStart.cy + (event.clientY - dragStart.y) / view.scale;
      draw(); return;
    }
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    const x = wx(px), precision = Math.max(2, Math.min(8, Math.ceil(Math.log10(view.scale + 1)) + 2));
    const values = activeFunctions().filter(f => f.fn && f.visible).slice(0, 4).map(f => {
      const y = f.fn(x); return `<span style="color:${f.color}">●</span> ${escapeHtml(f.name)}: ${Number.isFinite(y) ? y.toPrecision(5) : "无定义"}`;
    });
    cursorCard.innerHTML = `x: ${x.toFixed(precision)}<br>${values.join("<br>")}`;
    cursorCard.hidden = false;
    cursorCard.style.left = `${Math.min(px + 14, wrap.clientWidth - 170)}px`;
    cursorCard.style.top = `${Math.min(py + 14, wrap.clientHeight - 100)}px`;
  });
  wrap.addEventListener("pointerup", () => { dragging = false; wrap.classList.remove("dragging"); });
  wrap.addEventListener("pointerleave", () => { cursorCard.hidden = true; if (!dragging) wrap.classList.remove("dragging"); });
  wrap.addEventListener("dblclick", resetView);

  function resetView() { view = { cx: 0, cy: 0, scale: 42 }; draw(); }
  function zoom(factor) { view.scale = Math.max(1e-8, Math.min(1e12, view.scale * factor)); draw(); }

  function parseX(value) {
    try {
      const fn = compile(String(value).replace(/x/gi, "0"));
      const number = fn(0); return Number.isFinite(number) ? number : NaN;
    } catch { return NaN; }
  }

  function compare() {
    const x = parseX(document.getElementById("xValue").value);
    const precision = Number(document.getElementById("precision").value);
    const area = document.getElementById("resultArea");
    if (!Number.isFinite(x)) {
      area.innerHTML = `<div class="empty-result"><div class="empty-icon">!</div><strong>请输入有效的 x</strong><span>例如 1.5、pi/2 或 sqrt(2)</span></div>`; return;
    }
    markerX = x;
    const rows = activeFunctions().filter(f => f.fn && f.visible).map(f => {
      let value; try { value = f.fn(x); } catch { value = NaN; }
      return { ...f, value };
    }).sort((a, b) => {
      if (!Number.isFinite(a.value)) return 1;
      if (!Number.isFinite(b.value)) return -1;
      return b.value - a.value;
    });
    if (!rows.length) {
      area.innerHTML = `<div class="empty-result"><div class="empty-icon">∅</div><strong>没有可比较的函数</strong></div>`; return;
    }
    const format = value => Number.isFinite(value) ? value.toFixed(precision) : "无定义";
    area.innerHTML = `<div class="results-title">当 x = ${escapeHtml(String(x))} 时</div><div class="result-list">${rows.map((r, i) => `
      <div class="result-row"><span class="rank">${i + 1}</span><span class="result-name"><i style="background:${r.color}"></i>${escapeHtml(r.name)}</span><span class="result-value">${format(r.value)}</span></div>`).join("")}</div>
      ${rows.length > 1 ? `<div class="relation-banner">${rows.map(r => escapeHtml(r.name)).join("  ≥  ")}</div>` : ""}`;
    const finite = rows.filter(r => Number.isFinite(r.value));
    document.getElementById("observationText").textContent = finite.length > 1
      ? `此处最大值与最小值相差 ${Math.abs(finite[0].value - finite[finite.length - 1].value).toFixed(precision)}。图中圆点标出了对应位置。`
      : "当前只有一个函数在该点有定义。";
    draw();
  }

  document.getElementById("addFunction").onclick = () => addFunction();
  document.getElementById("wideAdd").onclick = () => addFunction();
  document.getElementById("resetView").onclick = resetView;
  document.getElementById("zoomIn").onclick = () => zoom(1.5);
  document.getElementById("zoomOut").onclick = () => zoom(1 / 1.5);
  document.getElementById("toggleGrid").onclick = event => { showGrid = !showGrid; event.currentTarget.classList.toggle("off", !showGrid); draw(); };
  document.getElementById("toggleIntersections").onclick = event => { showIntersections = !showIntersections; event.currentTarget.classList.toggle("off", !showIntersections); draw(); };
  document.getElementById("compareButton").onclick = compare;
  document.getElementById("xValue").addEventListener("keydown", event => { if (event.key === "Enter") compare(); });
  document.getElementById("themeToggle").onclick = event => {
    document.body.classList.toggle("dark"); event.currentTarget.textContent = document.body.classList.contains("dark") ? "☀" : "☾"; draw();
  };
  presetList.onclick = event => {
    const button = event.target.closest(".preset-item");
    if (!button) return;
    if (button.dataset.preset === "custom") addFunction("x", "自定义函数");
    else addFunction(null, null, button.dataset.preset);
  };

  renderPresetList();
  renderFunctionList();
  new ResizeObserver(resize).observe(wrap);
})();
