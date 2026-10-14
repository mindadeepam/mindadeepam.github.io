/* Reader notes: select text (or tap an equation), write a note, keep reading. Notes are saved in
   this browser only (localStorage), shown as highlights, and listed under "Your notes" in the
   contents, where "copy all" copies them as text. Nothing is sent anywhere. */
(function () {
  var article = document.querySelector("article");
  if (!article) return;
  var STORE = "reader-notes:" + location.pathname;
  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { notes = []; }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(notes)); } catch (e) {} refreshCount(); }
  var api = window.ReaderNotes = { openList: function () {}, count: function () { return notes.length; } };

  /* ---------- finding passages: text plus equations (MathJax keeps each one's TeX) ---------- */
  var texOf = new Map();
  function readMath() {
    var doc = window.MathJax && MathJax.startup && MathJax.startup.document;
    if (!doc || !doc.math) return;
    var list = doc.math.toArray ? doc.math.toArray() : Array.from(doc.math);
    list.forEach(function (it) {
      if (it.typesetRoot) texOf.set(it.typesetRoot, it.display ? "$$" + it.math.trim() + "$$" : "$" + it.math.trim() + "$");
    });
  }
  var SKIP = /^(SCRIPT|STYLE|BUTTON|TEXTAREA|svg|NOSCRIPT)$/;
  function index(root) {
    var nodes = [], text = "";
    (function walk(el) {
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { nodes.push({ n: c, s: text.length }); text += c.nodeValue; }
        else if (c.nodeType === 1 && !SKIP.test(c.nodeName)) {
          if (c.nodeName === "MJX-CONTAINER") {
            var t = texOf.get(c) || "$…$";
            nodes.push({ n: c, s: text.length, m: true, len: t.length }); text += t;
          } else walk(c);
        }
      }
    })(root);
    return { nodes: nodes, text: text };
  }
  function len(o) { return o.m ? o.len : o.n.nodeValue.length; }
  function wrap(ix, start, end, id) {
    var segs = [];
    ix.nodes.forEach(function (o) {
      var a = Math.max(start, o.s) - o.s, b = Math.min(end, o.s + len(o)) - o.s;
      if (b <= a) return;
      if (o.m) { segs.push({ m: o.n }); return; }
      if (o.n.nodeValue.slice(a, b).trim()) segs.push({ n: o.n, a: a, b: b });
    });
    segs.forEach(function (g) {
      if (g.m) { g.m.classList.add("nh-eq"); g.m.setAttribute("data-nh", id); return; }
      var x = g.n;
      if (g.a > 0) x = x.splitText(g.a);
      if (g.b - g.a < x.nodeValue.length) x.splitText(g.b - g.a);
      var mk = document.createElement("mark");
      mk.className = "nh"; mk.setAttribute("data-nh", id); mk.tabIndex = 0;
      x.parentNode.insertBefore(mk, x); mk.appendChild(x);
    });
    return segs.length > 0;
  }
  function unwrap(id) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-nh="' + id + '"]'), function (el) {
      if (el.nodeName === "MARK") {
        var p = el.parentNode;
        while (el.firstChild) p.insertBefore(el.firstChild, el);
        p.removeChild(el); p.normalize();
      } else { el.classList.remove("nh-eq"); el.removeAttribute("data-nh"); }
    });
  }
  function anchor(n) {
    var ix = index(article), best = -1, score = -1, from = 0, i;
    var pre = n.pre || "", post = n.post || "";
    while ((i = ix.text.indexOf(n.quote, from)) >= 0) {
      var sc = 0, p = ix.text.slice(Math.max(0, i - pre.length), i), q = ix.text.substr(i + n.quote.length, post.length);
      for (var k = 1; k <= p.length && p[p.length - k] === pre[pre.length - k]; k++) sc++;
      for (k = 0; k < q.length && q[k] === post[k]; k++) sc++;
      if (sc > score) { score = sc; best = i; }
      from = i + 1;
    }
    return best >= 0 && wrap(ix, best, best + n.quote.length, n.id);
  }
  function sectionOf(root, node) {
    if (root !== article) {
      var dt = document.getElementById("dive-sheet-title");
      return "Deep dive: " + (dt ? dt.textContent : "");
    }
    var hs = article.querySelectorAll("h2, h3"), label = "";
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) label = hs[i].textContent;
      else break;
    }
    return label.replace(/^(\d+)/, "$1 ").trim();
  }
  function rootOf(node) {
    var slot = document.querySelector(".dive-sheet .dive-slot");
    return article.contains(node) ? article : (slot && slot.contains(node) ? slot : null);
  }

  /* ---------- rendering helpers ---------- */
  function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  /* MathJax can only measure what's on the page, so typeset after attaching */
  function typeset(el) { if (el.isConnected && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(function () {}); }
  function showQuote(el, q, n) {
    if (q.indexOf("$") < 0) { el.textContent = clip(q, n); return; }
    el.textContent = q.replace(/\$\$([^$]+)\$\$/g, "\\[$1\\]").replace(/\$([^$\n]+)\$/g, "\\($1\\)");
    typeset(el);
  }
  function eqClone(e) {
    var c = e.cloneNode(true);
    c.classList.remove("nh-eq", "nh-pick"); c.removeAttribute("data-nh"); c.classList.add("nh-eqcopy");
    return c;
  }
  function quoteInto(el, n, max) {
    var eqs = document.querySelectorAll('mjx-container[data-nh="' + n.id + '"]');
    if (eqs.length && !document.querySelector('mark[data-nh="' + n.id + '"]')) Array.prototype.forEach.call(eqs, function (e) { el.appendChild(eqClone(e)); });
    else showQuote(el, n.quote, max);
  }

  /* ---------- the "note" button and the popover ---------- */
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "nh-ask"; btn.textContent = "note"; btn.hidden = true;
  var pop = document.createElement("div");
  pop.className = "nh-pop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Note");
  document.body.appendChild(btn); document.body.appendChild(pop);
  function place(el, rect) {
    el.style.visibility = "hidden"; el.hidden = false;
    var w = el.offsetWidth, x = rect.left + window.scrollX + rect.width / 2 - w / 2;
    x = Math.max(window.scrollX + 12, Math.min(x, window.scrollX + document.documentElement.clientWidth - w - 12));
    el.style.left = x + "px"; el.style.top = (rect.bottom + window.scrollY + 10) + "px";
    el.style.visibility = "";
  }
  var pending = null, picked = null, timer = null;
  function unpick() { if (picked) { picked.classList.remove("nh-pick"); picked = null; } }
  function infoFromRange(r) {
    var root = rootOf(r.commonAncestorContainer);
    if (!root) return null;
    var ix = index(root), start = -1, end = -1;
    ix.nodes.forEach(function (o) {
      if (!r.intersectsNode(o.n)) return;
      var a = 0, b = len(o);
      if (!o.m) {
        if (o.n === r.startContainer) a = r.startOffset;
        if (o.n === r.endContainer) b = r.endOffset;
      }
      if (start < 0) start = o.s + a;
      end = o.s + b;
    });
    while (start >= 0 && start < end && /\s/.test(ix.text[start])) start++;
    while (end > start && /\s/.test(ix.text[end - 1])) end--;
    if (start < 0 || end - start < 2) return null;
    return { root: root, ix: ix, start: start, end: end, quote: ix.text.slice(start, end), node: r.startContainer, rect: r.getBoundingClientRect() };
  }
  document.addEventListener("selectionchange", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!pop.hidden || picked) return;
      var sel = window.getSelection();
      pending = sel && !sel.isCollapsed && sel.rangeCount ? infoFromRange(sel.getRangeAt(0)) : null;
      if (pending) place(btn, pending.rect); else btn.hidden = true;
    }, 220);
  });
  btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
  btn.addEventListener("click", function () { if (pending) editor(pending, null); });
  function closePop() { pop.hidden = true; pop.innerHTML = ""; unpick(); }

  /* write a new note (s = the selection) or edit an existing one (n) */
  function editor(s, n) {
    btn.hidden = true;
    pop.innerHTML = '<p class="nh-quote"></p><textarea rows="3" placeholder="Your note"></textarea>'
      + '<div class="nh-row"><button type="button" class="nh-btn nh-save">save</button><button type="button" class="nh-btn nh-cancel">cancel</button></div>';
    var rect = s ? s.rect : (document.querySelector('[data-nh="' + n.id + '"]') || article).getBoundingClientRect();
    place(pop, rect);
    var qEl = pop.querySelector(".nh-quote");
    if (s && picked) qEl.appendChild(eqClone(picked));
    else if (s) showQuote(qEl, s.quote, 180);
    else quoteInto(qEl, n, 180);
    var ta = pop.querySelector("textarea");
    if (n) ta.value = n.text;
    ta.focus();
    function save() {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      if (n) { n.text = text; persist(); closePop(); return; }
      var note = { id: "n" + Date.now().toString(36), quote: s.quote, pre: s.ix.text.slice(Math.max(0, s.start - 40), s.start),
        post: s.ix.text.slice(s.end, s.end + 40), section: sectionOf(s.root, s.node), text: text, at: new Date().toISOString().slice(0, 10) };
      notes.push(note); persist();
      wrap(s.ix, s.start, s.end, note.id);
      window.getSelection().removeAllRanges();
      closePop();
    }
    pop.querySelector(".nh-save").addEventListener("click", save);
    pop.querySelector(".nh-cancel").addEventListener("click", closePop);
    ta.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
      if (e.key === "Escape") closePop();
    });
  }
  function find(id) { for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i]; return null; }
  function remove(id) { notes = notes.filter(function (x) { return x.id !== id; }); persist(); unwrap(id); }
  function view(id, rect) {
    var n = find(id);
    if (!n) return;
    btn.hidden = true;
    pop.innerHTML = '<p class="nh-meta"></p><p class="nh-text"></p><div class="nh-row"><button type="button" class="nh-btn nh-edit">edit</button><button type="button" class="nh-btn nh-del">delete</button><button type="button" class="nh-btn nh-cancel">close</button></div>';
    pop.querySelector(".nh-meta").textContent = (n.section ? n.section + " · " : "") + n.at;
    pop.querySelector(".nh-text").textContent = n.text;
    pop.querySelector(".nh-edit").addEventListener("click", function () { editor(null, n); });
    pop.querySelector(".nh-del").addEventListener("click", function () { remove(id); closePop(); });
    pop.querySelector(".nh-cancel").addEventListener("click", closePop);
    place(pop, rect);
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    var sel = window.getSelection(), collapsed = !sel || sel.isCollapsed;
    var hit = e.target.closest("[data-nh]");
    if (hit && collapsed && !pop.contains(hit) && !sheet.contains(hit)) { view(hit.getAttribute("data-nh"), hit.getBoundingClientRect()); return; }
    var eq = e.target.closest("mjx-container");
    if (eq && collapsed && rootOf(eq) && !pop.contains(eq)) {
      /* an equation can't be drag-selected, so a tap picks the whole equation */
      var r = document.createRange();
      r.selectNode(eq);
      var s = infoFromRange(r);
      if (s) {
        closePop(); unpick();
        picked = eq; eq.classList.add("nh-pick");
        pending = s; place(btn, eq.getBoundingClientRect());
        return;
      }
    }
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) closePop();
    if (picked && !btn.contains(e.target)) { unpick(); btn.hidden = true; }
  });
  document.addEventListener("keydown", function (e) {
    var hit = e.target.closest && e.target.closest("mark.nh");
    if (hit && e.key === "Enter") view(hit.getAttribute("data-nh"), hit.getBoundingClientRect());
    if (e.key === "Escape" && (!pop.hidden || picked)) { e.stopPropagation(); closePop(); btn.hidden = true; }
  }, true);

  /* ---------- "Your notes": the list, in the same side panel as the deep dives ---------- */
  var scrim = document.createElement("div"), sheet = document.createElement("aside");
  scrim.className = "dive-scrim"; scrim.hidden = true;
  sheet.className = "dive-sheet nh-sheet"; sheet.hidden = true;
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "nh-sheet-title");
  sheet.innerHTML = '<div class="dive-head"><div><div class="dive-tag">your notes</div><h2 id="nh-sheet-title"></h2></div>'
    + '<div class="nh-head-btns"><button type="button" class="dive-close nh-copy">copy all</button><button type="button" class="dive-close nh-clear">delete all</button><button type="button" class="dive-close nh-x" aria-label="Close">close ✕</button></div></div>'
    + '<p class="nh-hint">Saved in this browser only. “copy all” gives you plain text to paste anywhere.</p><div class="nh-list"></div>';
  document.body.appendChild(scrim); document.body.appendChild(sheet);
  var title = document.querySelector("h1") ? document.querySelector("h1").textContent : document.title;
  sheet.querySelector("h2").textContent = title;
  var listOpen = false;
  function render() {
    var box = sheet.querySelector(".nh-list");
    box.innerHTML = "";
    if (!notes.length) { box.innerHTML = '<p class="nh-empty">No notes yet. Select any text, or tap an equation, then “note”.</p>'; return; }
    notes.forEach(function (n, i) {
      var row = document.createElement("div");
      row.className = "nh-item";
      row.innerHTML = '<p class="nh-meta"></p><blockquote></blockquote><p class="nh-text"></p><div class="nh-row"><button type="button" class="nh-btn nh-go">go to</button><button type="button" class="nh-btn nh-edit">edit</button><button type="button" class="nh-btn nh-del">delete</button></div>';
      box.appendChild(row);
      row.querySelector(".nh-meta").textContent = (i + 1) + " · " + (n.section || "") + (n.lost ? " · passage changed" : "");
      quoteInto(row.querySelector("blockquote"), n, 280);
      row.querySelector(".nh-text").textContent = n.text;
      row.querySelector(".nh-go").addEventListener("click", function () {
        var m = document.querySelector('[data-nh="' + n.id + '"]');
        closeList();
        if (m) setTimeout(function () { m.scrollIntoView({ block: "center" }); if (m.focus) m.focus({ preventScroll: true }); }, 240);
      });
      row.querySelector(".nh-del").addEventListener("click", function () { remove(n.id); render(); });
      row.querySelector(".nh-edit").addEventListener("click", function () { editInPlace(row, n); });
    });
  }
  /* edit a note right in the list: the text becomes a box with save / cancel */
  function editInPlace(row, n) {
    if (row.querySelector("textarea")) { row.querySelector("textarea").focus(); return; }
    var p = row.querySelector(".nh-text"), actions = row.querySelector(".nh-row");
    var ed = document.createElement("div");
    ed.className = "nh-editbox";
    ed.innerHTML = '<textarea rows="3"></textarea><div class="nh-row"><button type="button" class="nh-btn nh-save">save</button><button type="button" class="nh-btn nh-cancel">cancel</button></div>';
    var ta = ed.querySelector("textarea");
    ta.value = n.text;
    p.hidden = true; actions.hidden = true;
    row.insertBefore(ed, actions);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    function done() { ed.remove(); p.hidden = false; actions.hidden = false; }
    function save() {
      var t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      n.text = t; persist(); p.textContent = t; done();
    }
    ed.querySelector(".nh-save").addEventListener("click", save);
    ed.querySelector(".nh-cancel").addEventListener("click", done);
    ta.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
      if (e.key === "Escape") done();
    });
  }
  function openList() {
    listOpen = true;
    scrim.hidden = false; sheet.hidden = false; sheet.scrollTop = 0;
    render();
    requestAnimationFrame(function () { scrim.classList.add("open"); sheet.classList.add("open"); });
    document.body.classList.add("dive-lock");
    sheet.querySelector(".nh-x").focus();
  }
  function closeList() {
    if (!listOpen) return;
    listOpen = false;
    scrim.classList.remove("open"); sheet.classList.remove("open");
    document.body.classList.remove("dive-lock");
    setTimeout(function () { scrim.hidden = true; sheet.hidden = true; }, 230);
  }
  sheet.querySelector(".nh-x").addEventListener("click", closeList);
  scrim.addEventListener("click", closeList);
  document.addEventListener("keydown", function (e) { if (listOpen && e.key === "Escape") closeList(); });
  sheet.querySelector(".nh-clear").addEventListener("click", function () {
    if (!notes.length || !window.confirm("Delete all " + notes.length + " notes on this page? This can\u2019t be undone.")) return;
    notes.slice().forEach(function (n) { unwrap(n.id); });
    notes = []; persist(); render();
  });
  sheet.querySelector(".nh-copy").addEventListener("click", function () {
    var b = this, lines = ["Notes on “" + title + "”", location.origin + location.pathname, ""];
    notes.forEach(function (n, i) {
      lines.push((i + 1) + ". [" + (n.section || "") + "]");
      lines.push("   > " + n.quote.replace(/\s+/g, " "));
      lines.push("   " + n.text.replace(/\n/g, "\n   "));
      lines.push("");
    });
    var txt = lines.join("\n");
    function done() { b.textContent = "copied ✓"; setTimeout(function () { b.textContent = "copy all"; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { window.prompt("Copy:", txt); });
    else window.prompt("Copy:", txt);
  });

  /* entry point: the last line of the contents list, shown once there's a note */
  var ol = document.querySelector(".toc ol"), li = null, entry = null;
  if (ol) {
    li = document.createElement("li"); li.className = "nh-toc"; li.hidden = true;
    entry = document.createElement("a"); entry.setAttribute("href", "#your-notes");
    entry.innerHTML = '<span class="n">✱</span>Your notes <span class="nh-count"></span>';
    entry.addEventListener("click", function (e) { e.preventDefault(); openList(); });
    li.appendChild(entry); ol.appendChild(li);
  }
  function refreshCount() {
    if (!li) return;
    li.hidden = !notes.length;
    entry.querySelector(".nh-count").textContent = notes.length ? "(" + notes.length + ")" : "";
  }
  api.openList = openList;
  refreshCount();

  /* ---------- copying a passage: formulas come along as their TeX, tables as rows ---------- */
  /* MathJax draws formulas as SVG, which has no text, so a plain copy drops them. When the
     selection includes a formula, build the copied text ourselves: words as written, each formula
     as $…$ (or $$…$$ on its own line), list items as "- ", table rows as "| a | b |". */
  var BLOCK = /^(P|DIV|UL|OL|TABLE|PRE|BLOCKQUOTE|ASIDE|DETAILS|SUMMARY|FIGURE|SECTION|HEADER|FOOTER|H1|H2|H3|H4|H5|H6)$/;
  function copiedText(range) {
    var out = [], root = range.commonAncestorContainer;
    if (root.nodeType === 3) root = root.parentNode;
    var inside = root.closest && root.closest("mjx-container");
    if (inside) return texOf.get(inside) || "";
    function push(s) { out.push(s); }
    (function walk(el, pre) {
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (!range.intersectsNode(c)) continue;
        if (c.nodeType === 3) {
          var t = c.nodeValue, a = c === range.startContainer ? range.startOffset : 0, b = c === range.endContainer ? range.endOffset : t.length;
          t = t.slice(a, b);
          push(pre ? t : t.replace(/\s+/g, " "));
          continue;
        }
        if (c.nodeType !== 1 || SKIP.test(c.nodeName) || c.hidden || c.getAttribute("aria-hidden") === "true" && c.nodeName !== "MJX-CONTAINER") continue;
        var tag = c.nodeName;
        if (tag === "MJX-CONTAINER") {
          var tex = texOf.get(c) || "$…$";
          push(tex.indexOf("$$") === 0 ? "\n\n" + tex + "\n\n" : tex);
        } else if (c.classList.contains("pn")) {
          push(c.textContent.trim() + " ");
        } else if (tag === "BR") {
          push("\n");
        } else if (tag === "LI") {
          push("\n- "); walk(c, pre);
        } else if (tag === "TR") {
          push("\n|"); walk(c, pre);
          if (c.parentNode.nodeName === "THEAD") push("\n|" + new Array(c.children.length + 1).join(" --- |"));
        } else if (tag === "TD" || tag === "TH") {
          push(" "); walk(c, pre); push(" |");
        } else if (/^H[1-6]$/.test(tag)) {
          push("\n\n" + "######".slice(0, +tag[1]) + " "); walk(c, pre); push("\n\n");
        } else if (tag === "DETAILS" && !c.open) {
          var sm = c.querySelector("summary");   /* a closed fold: only its visible line */
          if (sm && range.intersectsNode(sm)) { push("\n"); walk(sm, pre); push("\n"); }
        } else if (BLOCK.test(tag)) {
          push(tag === "PRE" ? "\n\n```\n" : "\n"); walk(c, pre || tag === "PRE"); push(tag === "PRE" ? "\n```\n\n" : "\n");
        } else {
          walk(c, pre);
        }
      }
    })(root, !!(root.closest && root.closest("pre")));
    return out.join("")
      .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+(?=[^-|\s])/g, "\n")
      .replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  document.addEventListener("copy", function (e) {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !e.clipboardData) return;
    var range = sel.getRangeAt(0), host = range.commonAncestorContainer;
    if (host.nodeType === 3) host = host.parentNode;
    var hasMath = (host.closest && host.closest("mjx-container")) ||
      Array.prototype.some.call(host.querySelectorAll("mjx-container"), function (m) { return range.intersectsNode(m); });
    if (!hasMath) return;   /* no formulas: the browser's own copy is fine */
    readMath();
    var text = copiedText(range);
    if (!text) return;
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
  });

  function start() { readMath(); notes.forEach(function (n) { n.lost = !anchor(n); }); }
  var ready = window.MathJax && MathJax.startup && MathJax.startup.promise;
  if (ready) ready.then(start, start); else window.addEventListener("load", start);
})();
