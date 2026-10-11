/* ⌘K / Ctrl+K: jump to any note, section or passage. Enter opens here, ⌘/Ctrl+Enter in a new tab.
   T switches light and dark. Self-contained: brings its own styles and reads search.json from
   the folder this script lives in. */
(function () {
  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/[^/]*(\?.*)?$/, "") : "/notes/";
  var HERE = (location.pathname.match(/\/notes\/([^/]+)\.html$/) || [])[1] || null;
  var data = null, loading = null;
  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = fetch(BASE + "search.json").then(function (r) { return r.json(); }).then(function (d) { data = d; return d; });
    return loading;
  }

  var css = [
    ".pal-scrim{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.45)}",
    ".pal[hidden],.pal-scrim[hidden]{display:none}",
    ".pal{position:fixed;z-index:121;top:12vh;left:50%;transform:translateX(-50%);width:min(640px,calc(100vw - 24px));max-height:70vh;display:flex;flex-direction:column;",
    "background:var(--void,var(--paper,#111));color:var(--text,var(--ink,#eee));border:1px solid var(--rule,#333);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden}",
    ".pal input{all:unset;box-sizing:border-box;width:100%;padding:16px 18px;font:400 17px/1.4 var(--font-sans,var(--sans,system-ui));color:inherit;border-bottom:1px solid var(--rule,#333)}",
    ".pal input::placeholder{color:var(--muted,var(--ink-3,#888))}",
    ".pal ul{list-style:none;margin:0;padding:6px;overflow-y:auto}",
    ".pal li{padding:8px 12px;border-radius:8px;cursor:pointer}",
    ".pal li.on{background:var(--surface,rgba(127,127,127,.12))}",
    ".pal .pg{padding:10px 12px 4px;font:500 11px/1.4 var(--font-mono,var(--mono,monospace));color:var(--muted,var(--ink-3,#888));text-transform:lowercase;cursor:default}",
    ".pal .pt{font-size:15px;line-height:1.4}",
    ".pal .pm{font:400 12px/1.5 var(--font-mono,var(--mono,monospace));color:var(--muted,var(--ink-3,#888));margin-top:2px}",
    ".pal .ps{font-size:13.5px;line-height:1.5;color:var(--soft,var(--ink-2,#aaa));margin-top:2px}",
    ".pal mark{background:none;color:var(--amber,var(--accent,#d7a514));font-weight:600}",
    ".pal .pf{display:flex;gap:16px;flex-wrap:wrap;padding:9px 16px;border-top:1px solid var(--rule,#333);font:400 11.5px/1.4 var(--font-mono,var(--mono,monospace));color:var(--muted,var(--ink-3,#888))}",
    ".pal .pf .pal-x{all:unset;cursor:pointer;margin-left:auto}",
    ".pal .pf .pal-x:hover{color:var(--text,var(--ink,#eee))}",
    ".pal .pe{padding:14px 12px;color:var(--muted,var(--ink-3,#888));font-size:14px}",
    "mark.pal-flash{background:color-mix(in srgb,var(--amber,var(--accent,#d7a514)) 35%,transparent);color:inherit;border-radius:2px;transition:background 1s ease}",
    "@media (max-width:720px){.pal{top:8px;max-height:calc(100vh - 16px)}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var MOD = mac ? "⌘" : "Ctrl+";

  var scrim, box, input, list, items = [], active = 0, lastFocus = null;
  function build() {
    scrim = document.createElement("div"); scrim.className = "pal-scrim"; scrim.hidden = true;
    box = document.createElement("div"); box.className = "pal"; box.hidden = true;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Search notes");
    box.innerHTML = '<input type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Search notes, sections, text, or a command" spellcheck="false" autocomplete="off">'
      + '<ul id="pal-list" role="listbox"></ul>'
      + '<div class="pf"><span>↑↓ move</span><span>↵ open</span><span>' + MOD + '↵ new tab</span><button type="button" class="pal-x">esc close</button></div>';
    document.body.appendChild(scrim); document.body.appendChild(box);
    input = box.querySelector("input"); list = box.querySelector("ul");
    input.addEventListener("input", update);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[active]) go(items[active], e.metaKey || e.ctrlKey); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    scrim.addEventListener("click", close);
    /* clicks inside the palette keep the typing focus, so the keys keep working */
    box.addEventListener("mousedown", function (e) { if (e.target !== input) e.preventDefault(); });
    box.querySelector(".pal-x").addEventListener("click", close);
  }
  function open() {
    if (!box) build();
    if (!box.hidden) { input.select(); return; }
    lastFocus = document.activeElement;
    scrim.hidden = false; box.hidden = false;
    input.value = ""; update(); input.focus();
    load().then(update, function () { list.innerHTML = '<li class="pe">Couldn’t load the search index.</li>'; });
  }
  function close() {
    if (!box || box.hidden) return;
    scrim.hidden = true; box.hidden = true;
    input.blur();
    if (lastFocus && lastFocus !== document.body && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- matching ---------- */
  function norm(s) { return (s || "").toLowerCase(); }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hi(s, toks) {
    var out = esc(s);
    toks.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    });
    return out;
  }
  function score(text, toks) {   /* every token must appear; earlier and word-start hits score higher */
    var t = norm(text), s = 0;
    for (var i = 0; i < toks.length; i++) {
      var p = t.indexOf(toks[i]);
      if (p < 0) return -1;
      s += 10 - Math.min(p, 9) + ((p === 0 || /\W/.test(t[p - 1])) ? 6 : 0);
    }
    return s;
  }
  function snippet(text, tok) {
    var p = norm(text).indexOf(tok), a = Math.max(0, p - 50);
    var s = (a > 0 ? "…" : "") + text.slice(a, p + 110) + (p + 110 < text.length ? "…" : "");
    return s;
  }
  function commands() {
    var c = [{ kind: "cmd", t: "Switch light / dark", meta: "T", run: function () { var b = document.querySelector("[data-theme-toggle]"); if (b) b.click(); } },
             { kind: "cmd", t: "All notes", meta: "notes index", url: BASE }];
    var rn = window.ReaderNotes;
    if (rn && rn.count()) c.push({ kind: "cmd", t: "Your notes", meta: rn.count() + " on this page", run: function () { rn.openList(); } });
    return c;
  }
  function results(q) {
    var toks = norm(q).split(/\s+/).filter(Boolean), out = [];
    var cmds = commands();
    if (!toks.length) {
      out.push({ group: "commands" });
      cmds.forEach(function (c) { if (!c.hidden) out.push(c); });
      if (data && HERE) {
        var here = data.notes.filter(function (n) { return n.slug === HERE; })[0];
        if (here) {
          out.push({ group: "this note" });
          here.sections.forEach(function (s) { out.push({ kind: "sec", t: s.t, meta: here.title, slug: here.slug, id: s.id }); });
        }
      }
      if (data) {
        out.push({ group: "notes" });
        data.notes.forEach(function (n) { out.push({ kind: "note", t: n.title, meta: n.desc, slug: n.slug }); });
      }
      return out;
    }
    var c2 = cmds.map(function (c) { return { c: c, s: score(c.t + " " + (c.meta || ""), toks) }; }).filter(function (x) { return x.s >= 0; });
    if (c2.length) { out.push({ group: "commands" }); c2.forEach(function (x) { out.push(x.c); }); }
    if (!data) return out;
    var notes = [], secs = [], texts = [];
    data.notes.forEach(function (n) {
      var ns = score(n.title + " " + n.desc, toks);
      if (ns >= 0) notes.push({ s: ns + 20, it: { kind: "note", t: n.title, meta: n.desc, slug: n.slug, toks: toks } });
      n.sections.forEach(function (s) {
        var ss = score(s.t, toks);
        if (ss >= 0) secs.push({ s: ss + (n.slug === HERE ? 15 : 0), it: { kind: "sec", t: s.t, meta: n.title, slug: n.slug, id: s.id, toks: toks } });
      });
      if (q.trim().length >= 3) n.chunks.forEach(function (c) {
        var cs = score(c.x, toks);
        if (cs >= 0) texts.push({ s: cs + (n.slug === HERE ? 15 : 0), it: { kind: "text", t: snippet(c.x, toks[0]), meta: n.title + (c.h ? " · " + c.h : ""), slug: n.slug, id: c.s, phrase: q.trim(), toks: toks } });
      });
    });
    function add(name, arr, max) {
      if (!arr.length) return;
      arr.sort(function (a, b) { return b.s - a.s; });
      out.push({ group: name });
      arr.slice(0, max).forEach(function (x) { out.push(x.it); });
    }
    add("notes", notes, 6); add("sections", secs, 8); add("text", texts, 20);
    return out;
  }
  function update() {
    var q = input.value, rows = results(q);
    items = []; list.innerHTML = "";
    rows.forEach(function (r) {
      var li = document.createElement("li");
      if (r.group) { li.className = "pg"; li.textContent = r.group; li.setAttribute("role", "presentation"); list.appendChild(li); return; }
      var i = items.length; items.push(r);
      li.id = "pal-" + i; li.setAttribute("role", "option");
      var toks = r.toks || [];
      li.innerHTML = '<div class="pt">' + (r.kind === "text" ? "" : hi(r.t, toks)) + '</div>'
        + (r.kind === "text" ? '<div class="ps">' + hi(r.t, toks) + '</div>' : "")
        + (r.meta ? '<div class="pm">' + esc(r.meta) + '</div>' : "");
      if (r.kind === "text") li.removeChild(li.firstChild);
      li.addEventListener("mousemove", function () { if (active !== i) { active = i; paint(); } });
      li.addEventListener("click", function (e) { go(r, e.metaKey || e.ctrlKey); });
      list.appendChild(li);
    });
    if (!items.length) list.innerHTML = '<li class="pe">' + (data || !q ? "No matches." : "Loading…") + '</li>';
    active = 0; paint();
  }
  function paint() {
    Array.prototype.forEach.call(list.querySelectorAll('[role="option"]'), function (li) {
      var on = li.id === "pal-" + active;
      li.classList.toggle("on", on); li.setAttribute("aria-selected", on ? "true" : "false");
      if (on) li.scrollIntoView({ block: "nearest" });
    });
    input.setAttribute("aria-activedescendant", items.length ? "pal-" + active : "");
  }
  function move(d) { if (items.length) { active = (active + d + items.length) % items.length; paint(); } }

  /* ---------- going somewhere ---------- */
  function flash(phrase, id) {
    var scope = (id && document.getElementById(id)) || document.querySelector("article") || document.body;
    var root = document.querySelector("article") || document.body, needle = norm(phrase);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, started = !id || !document.getElementById(id);
    while ((n = w.nextNode())) {
      if (!started && (scope.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING || scope.contains(n))) started = true;
      if (!started) continue;
      var p = norm(n.nodeValue).indexOf(needle);
      if (p < 0) continue;
      var r = document.createRange(); r.setStart(n, p); r.setEnd(n, p + phrase.length);
      var m = document.createElement("mark"); m.className = "pal-flash";
      try { r.surroundContents(m); } catch (e) { break; }
      m.scrollIntoView({ block: "center" });
      setTimeout(function () { m.style.background = "transparent"; }, 1600);
      setTimeout(function () { var par = m.parentNode; if (!par) return; while (m.firstChild) par.insertBefore(m.firstChild, m); par.removeChild(m); par.normalize(); }, 2700);
      return true;
    }
    if (id && document.getElementById(id)) document.getElementById(id).scrollIntoView({ block: "start" });
    return false;
  }
  function go(it, newTab) {
    if (it.kind === "cmd") {
      close();
      if (it.run) it.run(); else if (it.url) { if (newTab) window.open(it.url, "_blank", "noopener"); else location.href = it.url; }
      return;
    }
    var url = BASE + it.slug + ".html" + (it.id ? "#" + it.id : "");
    if (it.kind === "text" && it.phrase) url += (it.id ? "" : "#") + ":~:text=" + encodeURIComponent(it.phrase);
    if (newTab) { window.open(url, "_blank", "noopener"); return; }
    close();
    if (it.slug === HERE) {
      if (it.kind === "text") flash(it.phrase, it.id);
      else if (it.id && document.getElementById(it.id)) { history.replaceState(null, "", "#" + it.id); document.getElementById(it.id).scrollIntoView({ block: "start" }); }
      else window.scrollTo(0, 0);
      return;
    }
    location.href = url;
  }

  /* ---------- keys and the header button ---------- */
  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.nodeName));
  }
  /* Escape closes the palette wherever the focus is */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && box && !box.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (box && !box.hidden) close(); else open();
      return;
    }
    if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "t" || e.key === "T") && !typing(e) && (!box || box.hidden)) {
      var b = document.querySelector("[data-theme-toggle]");
      if (b) { e.preventDefault(); b.click(); }
    }
  });
  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-search]"), function (b) {
      var k = b.querySelector("kbd"); if (k) k.textContent = MOD + "K";
      b.addEventListener("click", function (e) { e.preventDefault(); open(); });
    });
    var tg = document.querySelector("[data-theme-toggle]");
    if (tg) tg.setAttribute("title", (tg.getAttribute("title") || "Switch color mode") + " (T)");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
