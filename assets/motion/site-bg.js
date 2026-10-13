/* Site background: a loss landscape behind the home page and the notes and blog lists. Faint
   contours, and three optimizers (SGD, momentum, Adam; unlabelled) leaving thin amber trails
   from a shared start point, run after run. Turned on by one attribute on <body>:

     data-site-bg="descent"

   Optional, on <body>:
     data-site-bg-focus="0.74 0.56"     where the basin sits on wide screens
                                        (fractions of the viewport: x, y)
     data-site-bg-focus-sm="0.6 0.84"   the same below 720px
     data-site-bg-delay="7"             seconds before the first optimizer run
   On page elements:
     data-bg-clear[="0.2"]   the layer fades out behind this element's text (down to the given
                             strength); "box" (e.g. "box 0.1") uses the element's whole box,
                             "lines" each line of text on its own (lists: the layer shows between
                             rows), "sticky" the whole box only while a sticky element is stuck.
                             The header's mark and nav and the footer text are always cleared.

   Reading pages (a single note or blog post) stay calm and do not load this.

   Runtime: devicePixelRatio capped at 1.5 (a full-viewport layer), at most 30 redraws a second
   and none while nothing moves, paused while the tab is hidden, a still frame under
   prefers-reduced-motion, and colours re-read from the tokens when html[data-theme] changes. */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  if (body.dataset.siteBg !== "descent") return;

  var DPR_CAP = 1.5;
  var MIN_FRAME = 1 / 31;
  var TOKENS = ["void", "text", "soft", "muted", "line", "line-strong", "amber", "green"];

  /* ---------------------------------------------------------------- helpers */

  function parseColor(value) {
    var s = (value || "").trim(), m;
    if (s.charAt(0) === "#") {
      var h = s.slice(1);
      if (h.length === 3 || h.length === 4) h = h.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(h.slice(0, 6), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
    }
    if ((m = s.match(/rgba?\(([^)]+)\)/))) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    return { r: 128, g: 128, b: 128, a: 1 };
  }
  function rgba(c, alpha) {
    var a = c.a * (alpha === undefined ? 1 : alpha);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  }
  function mix(c1, c2, t) {
    return { r: Math.round(c1.r + (c2.r - c1.r) * t), g: Math.round(c1.g + (c2.g - c1.g) * t), b: Math.round(c1.b + (c2.b - c1.b) * t), a: c1.a + (c2.a - c1.a) * t };
  }
  function readPalette() {
    var cs = getComputedStyle(root), pal = {};
    TOKENS.forEach(function (name) {
      pal[name.replace(/-([a-z])/g, function (_, ch) { return ch.toUpperCase(); })] = parseColor(cs.getPropertyValue("--" + name));
    });
    pal.fontMono = cs.getPropertyValue("--font-mono").trim() || "monospace";
    pal.fsLabel = parseFloat(cs.getPropertyValue("--fs-label")) || 12;
    return pal;
  }
  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function seeded(seed) {
    // mulberry32 -> normal draws, so reduced-motion stills are the same every time
    function u() {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return { u: u, g: function () { return Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()); } };
  }
  function pair(attr, fallback) {
    var v = (attr || "").trim().split(/\s+/).map(parseFloat);
    return v.length === 2 && !isNaN(v[0]) && !isNaN(v[1]) ? v : fallback;
  }

  /* ---------------------------------------------------------------- scene: descent */

  function descentScene() {
    var WELLS = [
      [0.22, -0.1, 0.45, 0.58, 0.11, 1.0, 0.7],   // global minimum: a long, narrow, curved valley
      [-0.52, 0.4, 0, 0.17, 0.17, 0.36, 0],       // a shallower local basin
    ].map(function (p) {
      return { x: p[0], y: p[1], c: Math.cos(p[2]), s: Math.sin(p[2]), il: 1 / (p[3] * p[3]), is: 1 / (p[4] * p[4]), d: p[5], k: p[6] };
    });
    var BOWL = { x: 0.05, y: 0, a: 0.24, b: 0.3 };
    var LOCAL = { x: -0.52, y: 0.4 };
    var MIN = { x: 0.325, y: -0.1 };
    var STEPS = 170, RATE = 22, NOISE = 0.035;
    var KINDS = [
      { name: "sgd", lr: 0.0225, alpha: 0.3, width: 1 },
      { name: "momentum", lr: 0.0045, beta: 0.92, alpha: 0.44, width: 1.1 },
      { name: "adam", lr: 0.014, b1: 0.9, b2: 0.999, alpha: 0.66, width: 1.25 },
    ];
    var focus = pair(body.dataset.siteBgFocus, [0.74, 0.56]);
    var focusSm = pair(body.dataset.siteBgFocusSm, [0.6, 0.84]);
    var delay = parseFloat(body.dataset.siteBgDelay) || 0;

    var view = { cx: 0, cy: 0, unit: 1 };
    var layer = null, runners = [], start = { x: 0, y: 0 }, lastAngle = null;
    var phase = "wait", phaseT = 0, progress = 0, runAlpha = 0;

    function loss(x, y, out) {
      var v = BOWL.a * (x - BOWL.x) * (x - BOWL.x) + BOWL.b * (y - BOWL.y) * (y - BOWL.y);
      var gx = 2 * BOWL.a * (x - BOWL.x), gy = 2 * BOWL.b * (y - BOWL.y);
      for (var i = 0; i < WELLS.length; i++) {
        var q = WELLS[i], dx = x - q.x, dy = y - q.y;
        var u = q.c * dx + q.s * dy, w = -q.s * dx + q.c * dy - q.k * u * u;
        var e = q.d * Math.exp(-0.5 * (u * u * q.il + w * w * q.is));
        v -= e;
        var gu = e * (u * q.il - 2 * q.k * u * w * q.is), gw = e * w * q.is;
        gx += q.c * gu - q.s * gw;
        gy += q.s * gu + q.c * gw;
      }
      if (out) { out[0] = gx; out[1] = gy; }
      return v;
    }

    (function findMin() {
      var best = Infinity, g = [0, 0];
      for (var x = -1; x <= 1; x += 0.02) for (var y = -1; y <= 1; y += 0.02) {
        var v = loss(x, y);
        if (v < best) { best = v; MIN.x = x; MIN.y = y; }
      }
      for (var i = 0; i < 400; i++) { loss(MIN.x, MIN.y, g); MIN.x -= 0.004 * g[0]; MIN.y -= 0.004 * g[1]; }
    })();

    function simulate(x0, y0, draw) {
      var noise = new Float32Array(STEPS * 2), g = [0, 0];
      for (var n = 0; n < noise.length; n++) noise[n] = draw() * NOISE;
      return KINDS.map(function (k) {
        var x = x0, y = y0, vx = 0, vy = 0, mx = 0, my = 0, sx = 0, sy = 0;
        var path = new Float32Array((STEPS + 1) * 2);
        path[0] = x; path[1] = y;
        for (var t = 1; t <= STEPS; t++) {
          var lr = k.lr * (0.06 + 0.94 * 0.5 * (1 + Math.cos(Math.PI * t / STEPS)));
          loss(x, y, g);
          var gx = g[0] + noise[2 * t - 2], gy = g[1] + noise[2 * t - 1];
          if (k.name === "sgd") { x -= lr * gx; y -= lr * gy; }
          else if (k.name === "momentum") { vx = k.beta * vx + gx; vy = k.beta * vy + gy; x -= lr * vx; y -= lr * vy; }
          else {
            mx = k.b1 * mx + (1 - k.b1) * gx; my = k.b1 * my + (1 - k.b1) * gy;
            sx = k.b2 * sx + (1 - k.b2) * gx * gx; sy = k.b2 * sy + (1 - k.b2) * gy * gy;
            var c1 = 1 - Math.pow(k.b1, t), c2 = 1 - Math.pow(k.b2, t);
            x -= lr * (mx / c1) / (Math.sqrt(sx / c2) + 1e-8);
            y -= lr * (my / c1) / (Math.sqrt(sy / c2) + 1e-8);
          }
          path[2 * t] = x; path[2 * t + 1] = y;
        }
        return { kind: k, path: path };
      });
    }

    function toX(x) { return view.cx + x * view.unit; }
    function toY(y) { return view.cy - y * view.unit; }

    function layout(api) {
      var small = api.w < 720;
      var f = small ? focusSm : focus;
      view.unit = small ? api.w * 0.62 : Math.min(api.w, api.h) * 0.5;
      view.cx = api.w * f[0] - MIN.x * view.unit;
      view.cy = api.h * f[1] + MIN.y * view.unit;
    }

    /* worth showing: on screen the whole way, and not everyone just drops into the local basin */
    function acceptable(api, rs) {
      var allLocal = true;
      for (var i = 0; i < rs.length; i++) {
        var p = rs[i].path, n = p.length / 2;
        for (var j = 0; j < n; j += 2) {
          var X = toX(p[2 * j]), Y = toY(p[2 * j + 1]);
          if (X < 12 || Y < 12 || X > api.w - 12 || Y > api.h - 12) return false;
        }
        if (Math.hypot(p[2 * n - 2] - LOCAL.x, p[2 * n - 1] - LOCAL.y) > 0.2) allLocal = false;
      }
      return !allLocal;
    }

    function newRun(api, fixed) {
      var rs = null;
      if (fixed) {
        start = fixed;
        var sd = seeded(7);
        rs = simulate(start.x, start.y, sd.g);
      } else {
        for (var tries = 0; tries < 40 && !rs; tries++) {
          var a = Math.random() * Math.PI * 2;
          if (lastAngle !== null && Math.abs(Math.atan2(Math.sin(a - lastAngle), Math.cos(a - lastAngle))) < 1.0) continue;
          var r = 0.66 + Math.random() * 0.14;
          var x = MIN.x + Math.cos(a) * r, y = MIN.y + Math.sin(a) * r * 0.85;
          if (api.inZone(toX(x), toY(y), 14) && tries < 30) continue;
          var cand = simulate(x, y, gauss);
          if (tries < 39 && !acceptable(api, cand)) continue;
          rs = cand; start = { x: x, y: y }; lastAngle = a;
        }
        if (!rs) { start = { x: MIN.x + 0.7, y: MIN.y + 0.2 }; rs = simulate(start.x, start.y, gauss); }
      }
      runners = rs;
      progress = 0; phase = "run"; phaseT = 0; runAlpha = 1;
    }

    function renderContours(api) {
      if (!layer) layer = document.createElement("canvas");
      layer.width = api.canvas.width; layer.height = api.canvas.height;
      var c = layer.getContext("2d"), pal = api.palette;
      c.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      c.clearRect(0, 0, api.w, api.h);
      var cell = 4;
      var nx = Math.ceil(api.w / cell) + 1, ny = Math.ceil(api.h / cell) + 1;
      var field = new Float32Array(nx * ny), lo = Infinity, hi = -Infinity;
      for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
        var v = loss((i * cell - view.cx) / view.unit, (view.cy - j * cell) / view.unit);
        field[j * nx + i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      hi = Math.min(hi, lo + 3.2); // far corners of a big screen: don't spend levels out there
      var N = 24;
      for (var k = 0; k < N; k++) {
        var level = lo + (hi - lo) * Math.pow((k + 0.45) / N, 1.9);
        var major = k % 5 === 4;
        c.beginPath();
        for (j = 0; j < ny - 1; j++) {
          for (i = 0; i < nx - 1; i++) {
            var a = field[j * nx + i], b = field[j * nx + i + 1], d = field[(j + 1) * nx + i], e = field[(j + 1) * nx + i + 1];
            var idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (e > level ? 2 : 0) | (d > level ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            var x0 = i * cell, y0 = j * cell, x1 = x0 + cell, y1 = y0 + cell;
            var tx = x0 + cell * (level - a) / (b - a), ry = y0 + cell * (level - b) / (e - b);
            var bx = x0 + cell * (level - d) / (e - d), ly = y0 + cell * (level - a) / (d - a);
            switch (idx) {
              case 1: case 14: c.moveTo(x0, ly); c.lineTo(bx, y1); break;
              case 2: case 13: c.moveTo(bx, y1); c.lineTo(x1, ry); break;
              case 3: case 12: c.moveTo(x0, ly); c.lineTo(x1, ry); break;
              case 4: case 11: c.moveTo(tx, y0); c.lineTo(x1, ry); break;
              case 6: case 9: c.moveTo(tx, y0); c.lineTo(bx, y1); break;
              case 7: case 8: c.moveTo(x0, ly); c.lineTo(tx, y0); break;
              default: {
                var centre = (a + b + d + e) / 4 > level;
                if ((idx === 5) === centre) { c.moveTo(x0, ly); c.lineTo(tx, y0); c.moveTo(bx, y1); c.lineTo(x1, ry); }
                else { c.moveTo(x0, ly); c.lineTo(bx, y1); c.moveTo(tx, y0); c.lineTo(x1, ry); }
              }
            }
          }
        }
        c.lineWidth = major ? 1 : 0.8;
        c.strokeStyle = major ? rgba(pal.lineStrong, 0.42) : rgba(pal.line, 0.62);
        c.stroke();
      }
      var mx = toX(MIN.x), my = toY(MIN.y);
      c.beginPath();
      c.moveTo(mx - 4, my); c.lineTo(mx + 4, my); c.moveTo(mx, my - 4); c.lineTo(mx, my + 4);
      c.lineWidth = 1;
      c.strokeStyle = rgba(pal.muted, 0.7);
      c.stroke();
    }

    function drawTrail(ctx, api, r) {
      var p = r.path, k = Math.min(Math.floor(progress), STEPS), frac = progress - k;
      var hx = p[2 * k], hy = p[2 * k + 1];
      if (k < STEPS && frac > 0) { hx += (p[2 * k + 2] - hx) * frac; hy += (p[2 * k + 3] - hy) * frac; }
      ctx.beginPath();
      ctx.moveTo(toX(p[0]), toY(p[1]));
      for (var i = 1; i <= k; i++) ctx.lineTo(toX(p[2 * i]), toY(p[2 * i + 1]));
      ctx.lineTo(toX(hx), toY(hy));
      ctx.lineWidth = r.kind.width;
      ctx.strokeStyle = rgba(api.palette.amber, r.kind.alpha * runAlpha);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(toX(hx), toY(hy), r.kind.name === "adam" ? 2.4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(api.palette.amber, Math.min(1, r.kind.alpha + 0.15) * runAlpha);
      ctx.fill();
    }

    return {
      init: function (api) { layout(api); renderContours(api); phase = "wait"; phaseT = 0; },
      resize: function (api) {
        layout(api); renderContours(api);
        if (api.reduced) this.still(api);
        else if (phase !== "wait") newRun(api);
      },
      theme: function (api) { renderContours(api); },
      step: function (api, dt) {
        phaseT += dt;
        if (phase === "wait") {
          if (phaseT >= delay) newRun(api);
          else return false;
        } else if (phase === "run") {
          progress = Math.min(progress + dt * RATE, STEPS);
          if (progress >= STEPS) { phase = "hold"; phaseT = 0; }
        } else if (phase === "hold") {
          if (phaseT > 3) { phase = "fade"; phaseT = 0; } else return false;
        } else if (phase === "fade") {
          runAlpha = 1 - smooth(phaseT / 1.5);
          if (phaseT > 1.6) { phase = "rest"; phaseT = 0; runners = []; }
        } else if (phase === "rest") {
          if (phaseT > 1.2) newRun(api); else return false;
        }
      },
      draw: function (api) {
        var ctx = api.ctx;
        if (layer) ctx.drawImage(layer, 0, 0, api.w, api.h);
        if (!runners.length) return;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(toX(start.x), toY(start.y), 3, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(api.palette.muted, 0.8 * runAlpha);
        ctx.stroke();
        runners.forEach(function (r) { drawTrail(ctx, api, r); });
      },
      still: function (api) {
        // a fixed run: in from the upper right, away from the text
        newRun(api, { x: MIN.x + 0.5, y: MIN.y + 0.4 });
        progress = STEPS; phase = "hold"; phaseT = 0; runAlpha = 1;
      },
    };
  }

  /* ---------------------------------------------------------------- runtime */

  var scene = descentScene();
  var canvas = document.createElement("canvas");
  canvas.className = "site-bg";
  canvas.setAttribute("aria-hidden", "true");
  body.insertBefore(canvas, body.firstChild);
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var zones = [], avoid = [], zonesDirty = true;   /* avoid: list boxes runs shouldn't start in */
  var raf = 0, last = 0, ready = false, repaintQueued = false;

  var api = {
    ctx: ctx, canvas: canvas, w: 0, h: 0, dpr: 1,
    palette: readPalette(),
    reduced: reduce.matches,
    inZone: function (x, y, pad) {
      pad = pad || 0;
      var all = zones.concat(avoid);
      for (var i = 0; i < all.length; i++) {
        var z = all[i];
        if (x > z.x - pad && x < z.x + z.w + pad && y > z.y - pad && y < z.y + z.h + pad) return true;
      }
      return false;
    },
  };

  /* text the layer must stay out of. data-bg-clear="[mode] [strength]", modes:
       (none)   one box around the element's content
       box      the element's whole box
       lines    a tight box around each line of text, so the layer still shows between rows
       sticky   a sticky element: its whole box while it is stuck, its lines otherwise */
  var range = document.createRange();
  function addZone(r, keep, feather) {
    if (!r.width || !r.height || r.bottom < -60 || r.top > api.h + 60) return;
    zones.push({ x: r.left, y: r.top, w: r.width, h: r.height, keep: keep, f: feather });
  }
  function lineZones(el, keep) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = walk.nextNode())) {
      if (!n.nodeValue.trim() || n.parentElement.closest("script, style, [hidden]")) continue;
      range.selectNodeContents(n);
      var rs = range.getClientRects();
      for (var j = 0; j < rs.length; j++) addZone(rs[j], keep, 8);
    }
  }
  function isStuck(el) {
    var cs = getComputedStyle(el);
    return cs.position === "sticky" && el.getBoundingClientRect().top <= (parseFloat(cs.top) || 0) + 0.5;
  }
  function collectZones() {
    zones = []; avoid = [];
    var els = document.querySelectorAll(".site-header .mark, .site-header nav, footer p, [data-bg-clear]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest("[hidden]")) continue;
      var opt = el.dataset.bgClear || "";
      var keep = parseFloat(opt.replace(/[a-z]+/g, ""));
      if (isNaN(keep)) keep = 0.16;
      var mode = (opt.match(/box|lines|sticky/) || [""])[0];
      if (mode === "sticky") mode = isStuck(el) ? "box" : "lines";
      if (mode === "lines") {
        lineZones(el, keep);
        var b = el.getBoundingClientRect();
        avoid.push({ x: b.left, y: b.top, w: b.width, h: b.height });
        continue;
      }
      var r = null;
      if (mode !== "box") { range.selectNodeContents(el); r = range.getBoundingClientRect(); }
      if (!r || !r.width || !r.height) r = el.getBoundingClientRect();
      addZone(r, keep, 26);
    }
  }

  function clearZones() {
    var steps = 5;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i], a = 1 - Math.pow(z.keep, 1 / steps);
      ctx.fillStyle = rgba(api.palette.void, a / api.palette.void.a);
      for (var k = 0; k < steps; k++) {
        var e = z.f * (1 - k / (steps - 1)) + 4;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(z.x - e, z.y - e, z.w + 2 * e, z.h + 2 * e, e + 4);
        else ctx.rect(z.x - e, z.y - e, z.w + 2 * e, z.h + 2 * e);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function measure() {
    var r = canvas.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height), d = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    if (!w || !h) return false;
    if (w === api.w && h === api.h && d === api.dpr) return false;
    api.w = w; api.h = h; api.dpr = d;
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    return true;
  }

  function paint() {
    if (zonesDirty) { collectZones(); zonesDirty = false; }
    ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
    ctx.clearRect(0, 0, api.w, api.h);
    scene.draw(api);
    clearZones();
  }

  function running() { return ready && !reduce.matches && !document.hidden; }

  function frame(t) {
    raf = 0;
    if (!running()) return;
    var dt = last ? (t - last) / 1000 : 1 / 30;
    if (dt >= MIN_FRAME || zonesDirty) {
      last = t;
      var moved = scene.step(api, Math.min(dt, 0.1)) !== false;
      if (moved || zonesDirty) paint();
    }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    if (running()) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* one repaint outside the loop (reduced motion, or anything that moved the zones) */
  function repaint() {
    zonesDirty = true;
    if (raf || repaintQueued || !ready) return;
    repaintQueued = true;
    requestAnimationFrame(function () { repaintQueued = false; paint(); });
  }

  function boot() {
    if (!measure()) return;
    collectZones(); zonesDirty = false;
    scene.init(api);
    ready = true;
    if (reduce.matches) scene.still(api);
    paint();
    sync();
  }

  new ResizeObserver(function () {
    if (!ready) { boot(); return; }
    if (measure()) { collectZones(); scene.resize(api); }
    repaint();
  }).observe(canvas);

  new MutationObserver(function () {
    api.palette = readPalette();
    if (!ready) return;
    if (scene.theme) scene.theme(api);
    repaint();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* filters and similar UI that hide or show page sections move the text around */
  new MutationObserver(repaint).observe(body, { attributes: true, subtree: true, attributeFilter: ["hidden"] });

  /* lists that render after load (the blog list is fetched) */
  new MutationObserver(repaint).observe(document.querySelector("main") || body, { childList: true, subtree: true });

  window.addEventListener("scroll", repaint, { passive: true });
  document.addEventListener("visibilitychange", sync);
  function onReduce() {
    api.reduced = reduce.matches;
    if (reduce.matches && ready) { scene.still(api); repaint(); }
    sync();
  }
  if (reduce.addEventListener) reduce.addEventListener("change", onReduce);
  else if (reduce.addListener) reduce.addListener(onReduce);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { api.palette = readPalette(); repaint(); });

  boot();
})();
