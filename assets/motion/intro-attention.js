/* The home page's intro sentence as an attention animation.

   On load the sentence is "generated" word by word: ghosted words come up to full strength
   behind a thin amber caret, and as each word arrives the earlier words it attends to light up
   in amber (tint and underline, stronger = more weight). Then two quick passes show other head
   patterns (previous-token, punctuation), one coreference moment ("them" -> agents, workflows),
   and the sentence settles as plain text. After that, hovering (or tapping) a word shows what it
   attends to. The weights are hand-shaped to look like real heads.

   The text is real the whole time (one span per word), so it is selectable and screen readers
   get the plain sentence. Reduced motion: no animation, the hover/tap explorer still works.
   The animation clock runs on requestAnimationFrame, so it pauses while the tab is hidden. */
(function () {
  "use strict";
  var p = document.querySelector("[data-intro-attn]");
  if (!p) return;
  window.IntroAttention = true;

  var toks = Array.prototype.slice.call(p.querySelectorAll(".tok"));
  var N = toks.length;
  var words = toks.map(function (t) { return t.textContent; });
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var touch = window.matchMedia("(hover: none)");
  var PUNCT = { "-": 1, ",": 1, ".": 1 };

  /* content links for this sentence: query index -> { key index: strength } */
  var EXPECTED = "I build practical AI systems - agents , applied ML workflows , and the backend that makes them useful .";
  var LINKS = words.join(" ") === EXPECTED ? {
    1: { 0: 2.4 }, 2: { 1: 1.6 }, 3: { 2: 2.0, 1: 0.8 }, 4: { 3: 3.0, 1: 2.0, 2: 1.6 }, 5: { 4: 2.0 },
    6: { 4: 3.0, 3: 2.4 }, 7: { 6: 2.0 }, 8: { 2: 2.0, 1: 1.0 }, 9: { 3: 3.0, 8: 2.6 },
    10: { 9: 2.6, 4: 2.0, 6: 1.4 }, 11: { 10: 2.0 }, 12: { 11: 1.4, 6: 1.0 }, 13: { 12: 1.6 },
    14: { 4: 3.0, 10: 2.0 }, 15: { 14: 3.0 }, 16: { 15: 2.0, 14: 2.6 },
    17: { 6: 3.0, 10: 2.6, 4: 2.0 },   // "them" -> agents, workflows, systems
    18: { 2: 2.6, 4: 2.0, 16: 2.0 }, 19: { 18: 1.6, 1: 1.0 },
  } : {};

  var HEADS = {
    content: { logit: function (i, j) { return ((LINKS[i] && LINKS[i][j]) || 0) - 0.05 * (i - j) + (j === i ? 0.8 : 0); } },
    previous: { logit: function (i, j) { return (j === i - 1 ? 4 : 0) + (j === i - 2 ? 1.2 : 0); } },
    punct: { logit: function (i, j) { return (PUNCT[words[j]] && j < i ? 3 : 0) - 0.08 * (i - j); } },
  };

  /* the keys (earlier words) query i attends to, strongest first, weights scaled so the top is 1 */
  function keysOf(head, i, count) {
    if (i < 1) return [];
    var logits = [], mx = -Infinity, sum = 0, j;
    for (j = 0; j <= i; j++) { logits[j] = head.logit(i, j); if (logits[j] > mx) mx = logits[j]; }
    var w = logits.map(function (l) { var e = Math.exp(l - mx); sum += e; return e; }).map(function (e) { return e / sum; });
    var keys = [];
    for (j = 0; j < i; j++) keys.push([j, w[j]]);
    keys.sort(function (a, b) { return b[1] - a[1]; });
    var top = keys[0][1] || 1;
    return keys.slice(0, count).map(function (k) { return [k[0], k[1] / top]; }).filter(function (k) { return k[1] >= 0.22; });
  }

  function clearAttention() {
    toks.forEach(function (t) { t.classList.remove("q", "key"); });
  }

  function showQuery(i, head) {
    clearAttention();
    toks[i].classList.add("q");
    keysOf(head, i, 3).forEach(function (k) {
      toks[k[0]].style.setProperty("--w", k[1].toFixed(2));
      toks[k[0]].classList.add("key");
    });
  }

  var caret = document.createElement("span");
  caret.className = "intro-caret";
  caret.setAttribute("aria-hidden", "true");

  /* ---- a small timeline on requestAnimationFrame ---- */
  var queue = [], clock = 0, raf = 0, last = 0, settled = false;
  function at(t, fn) { queue.push({ t: t, fn: fn }); }
  function drain() { while (queue.length && queue[0].t <= clock) queue.shift().fn(); }
  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    clock += dt;
    drain();
    if (queue.length) raf = requestAnimationFrame(loop);
  }
  function run() {
    if (!raf && queue.length && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
  }
  document.addEventListener("visibilitychange", run);

  function settle() {
    settled = true;
    clearAttention();
    caret.remove();
    p.classList.remove("is-decoding");
    toks.forEach(function (t) { t.classList.add("on"); });
  }

  function scan(t, head, step) {
    for (var i = 1; i < N; i++) (function (i) { at(t + i * step, function () { showQuery(i, head); }); })(i);
    t += N * step + 0.25;
    at(t, clearAttention);
    return t + 0.55;
  }

  function build() {
    var t = 0.5;
    toks.forEach(function (tok, i) {
      at(t, function () {
        tok.classList.add("on");
        tok.after(caret);
        if (i > 0) showQuery(i, HEADS.content); else clearAttention();
      });
      t += PUNCT[words[i]] ? 0.16 : 0.28;
    });
    t += 0.35;
    at(t, function () { clearAttention(); caret.remove(); p.classList.remove("is-decoding"); });
    t += 0.9;
    t = scan(t, HEADS.previous, 0.13);
    t = scan(t, HEADS.punct, 0.13);
    if (N > 17) {
      at(t, function () { showQuery(17, HEADS.content); });
      t += 2.4;
      at(t, clearAttention);
      t += 0.6;
    }
    at(t, settle);
  }

  function start() {
    cancelAnimationFrame(raf); raf = 0;
    queue = []; clock = 0; settled = false;
    clearAttention();
    if (reduce.matches) { settle(); return; }
    toks.forEach(function (t) { t.classList.remove("on"); });
    p.classList.add("is-decoding");
    build();
    run();
  }

  /* after it settles: hover (or tap) a word to see what it attends to */
  p.addEventListener("mouseover", function (e) {
    if (!settled || touch.matches) return;
    var t = e.target.closest && e.target.closest(".tok");
    if (t) showQuery(toks.indexOf(t), HEADS.content);
  });
  p.addEventListener("mouseleave", function () { if (settled) clearAttention(); });
  p.addEventListener("click", function (e) {
    if (!settled || !touch.matches) return;
    var t = e.target.closest && e.target.closest(".tok");
    if (!t || t.classList.contains("q")) clearAttention();
    else showQuery(toks.indexOf(t), HEADS.content);
  });
  var onReduce = function () { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; queue = []; settle(); } };
  if (reduce.addEventListener) reduce.addEventListener("change", onReduce);

  start();
})();
