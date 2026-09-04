async function loadPosts() {
  const response = await fetch("../posts/index.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load posts index");
  return response.json();
}

function initializeThemeToggle() {
  const storageKey = "deepam-theme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist = false) {
    root.dataset.theme = theme;
    if (themeMeta) themeMeta.content = theme === "light" ? "#f6f7f3" : "#070707";
    if (toggle) {
      const nextTheme = theme === "dark" ? "light" : "dark";
      toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
      toggle.setAttribute("title", `Switch to ${nextTheme} mode`);
    }
    if (persist) localStorage.setItem(storageKey, theme);
  }

  applyTheme(root.dataset.theme || "dark");

  toggle?.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  });
}

function parseFrontMatter(markdown) {
  if (!markdown.startsWith("---")) return [{}, markdown];
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return [{}, markdown];

  const raw = markdown.slice(3, end).trim();
  const meta = {};
  raw.split("\n").forEach((line) => {
    const index = line.indexOf(":");
    if (index > -1) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  });
  return [meta, markdown.slice(end + 4).trim()];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let paragraph = [];
  let list = false;
  let code = false;
  let codeLanguage = "";
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!list) return;
    html.push("</ul>");
    list = false;
  }

  function isTableSeparator(line) {
    return /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line);
  }

  function renderTable(start) {
    const rows = [];
    let index = start;
    while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
      rows.push(lines[index]);
      index += 1;
    }

    const cells = (row) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);

    const header = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    html.push(`
      <div class="table-wrap">
        <table>
          <thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>
          <tbody>
            ${body
              .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
    `);
    return index - 1;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (code) {
        const codeText = escapeHtml(codeLines.join("\n"));
        if (codeLanguage === "mermaid") {
          html.push(`<div class="mermaid">${codeText}</div>`);
        } else {
          const language = codeLanguage ? escapeHtml(codeLanguage) : "text";
          html.push(`
            <figure class="code-block" data-language="${language}">
              <pre><code class="language-${language}">${codeText}</code></pre>
            </figure>
          `);
        }
        code = false;
        codeLanguage = "";
        codeLines = [];
      } else {
        flushParagraph();
        closeList();
        code = true;
        codeLanguage = line.slice(3).trim().toLowerCase();
      }
      continue;
    }

    if (code) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    if (line.includes("|") && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      closeList();
      i = renderTable(i);
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      closeList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (!list) {
        html.push("<ul>");
        list = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (line === "---") {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return html.join("\n");
}

async function renderBlogIndex() {
  const target = document.querySelector("[data-blog-list]");
  if (!target) return;

  const posts = await loadPosts();
  target.innerHTML = posts
    .map(
      (post) => `
        <a class="post-row" href="./post.html?slug=${post.slug}">
          <span>${post.title}</span>
          <time datetime="${post.date}">${post.displayDate}</time>
        </a>
      `
    )
    .join("");
}

async function renderPost() {
  const target = document.querySelector("[data-post]");
  if (!target) return;

  const slug = new URLSearchParams(window.location.search).get("slug") || "how-to-async-in-python";
  const response = await fetch(`../posts/${slug}.md`, { cache: "no-cache" });
  if (!response.ok) {
    target.innerHTML = "<p>Post not found.</p>";
    return;
  }

  const [meta, markdown] = parseFrontMatter(await response.text());
  document.title = `${meta.title || "Post"} · Deepam Minda`;
  target.innerHTML = `
    <a class="back-link" href="./">Back to blog</a>
    <button class="jump-button" type="button" data-jump="bottom" aria-label="Jump to bottom">
      <span aria-hidden="true">↓</span>
    </button>
    <article>
      <header>
        <h1>${escapeHtml(meta.title || "Untitled")}</h1>
        <p class="article-meta">${escapeHtml(meta.date || "")}</p>
      </header>
      <div class="article-body">${markdownToHtml(markdown.replace(/^# .+$/m, "").trim())}</div>
      <span id="post-bottom" tabindex="-1"></span>
    </article>
  `;
  bindJumpControls();
  highlightCodeBlocks();
  renderMermaid();
}

function bindJumpControls() {
  const button = document.querySelector("[data-jump]");
  if (!button) return;

  function syncDirection() {
    const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 160;
    const nextDirection = nearBottom ? "top" : "bottom";
    button.dataset.jump = nextDirection;
    button.setAttribute("aria-label", nextDirection === "top" ? "Jump to top" : "Jump to bottom");
    button.querySelector("span").textContent = nextDirection === "top" ? "↑" : "↓";
  }

  button.addEventListener("click", () => {
    const target = button.dataset.jump === "bottom" ? document.querySelector("#post-bottom") : document.body;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window.addEventListener("scroll", syncDirection, { passive: true });
  window.addEventListener("resize", syncDirection);
  syncDirection();
}

function bindWorkPanels() {
  const trigger = document.querySelector("[data-work-toggle]");
  const detail = document.querySelector("[data-work-detail]");
  if (!trigger || !detail) return;

  function setOpen(open) {
    trigger.setAttribute("aria-expanded", String(open));
    trigger.classList.toggle("is-open", open);
    detail.classList.toggle("is-open", open);
    detail.hidden = !open;
  }

  trigger.addEventListener("click", () => {
    setOpen(trigger.getAttribute("aria-expanded") !== "true");
  });
}

function bindProjectRows() {
  const rows = Array.from(document.querySelectorAll("[data-project-row]"));
  if (!rows.length) return;
  const panel = document.querySelector("[data-project-panel]");
  const panelKicker = document.querySelector("[data-project-panel-kicker]");
  const panelTitle = document.querySelector("[data-project-panel-title]");
  const panelSummary = document.querySelector("[data-project-panel-summary]");
  const panelDetail = document.querySelector("[data-project-panel-detail]");
  let activeRow = null;

  function renderPanel(row) {
    if (!panel || !panelKicker || !panelTitle || !panelSummary || !panelDetail) return;

    if (!row) {
      panel.hidden = true;
      panelKicker.textContent = "";
      panelTitle.textContent = "";
      panelSummary.textContent = "";
      panelDetail.textContent = "";
      return;
    }

    panel.hidden = false;
    panelKicker.textContent = row.querySelector(".project-kicker")?.textContent.trim() || "";
    panelTitle.textContent = row.querySelector("h3")?.textContent.trim() || "";
    panelSummary.textContent = row.querySelector(".project-summary")?.textContent.trim() || "";
    panelDetail.textContent = row.querySelector(".project-detail")?.textContent.trim() || "";
  }

  function setActive(rowToActivate) {
    activeRow = rowToActivate;
    rows.forEach((row) => {
      const isActive = row === rowToActivate;
      row.classList.toggle("is-active", isActive);
      row.setAttribute("aria-expanded", String(isActive));
    });
    renderPanel(rowToActivate);
  }

  rows.forEach((row) => {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-expanded", "false");
    row.addEventListener("click", () => {
      setActive(activeRow === row ? null : row);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setActive(activeRow === row ? null : row);
    });
  });

  setActive(rows[0]);
}

function bindLocalTime() {
  const targets = document.querySelectorAll("[data-local-time]");
  if (!targets.length) return;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  function renderTime() {
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
    const value = `${parts.hour}:${parts.minute} ${parts.dayPeriod.toLowerCase()} ist`;
    targets.forEach((target) => {
      target.textContent = value;
    });
  }

  renderTime();
  window.setInterval(renderTime, 30000);
}

async function renderGithubActivity() {
  const target = document.querySelector("[data-github-activity]");
  if (!target) return;

  const kickerTarget = target.querySelector(".github-kicker");
  const totalTarget = target.querySelector("[data-github-total]");
  const noteTarget = target.querySelector("[data-github-note]");
  const monthsTarget = target.querySelector("[data-github-months]");
  const gridTarget = target.querySelector("[data-github-grid]");
  if (!kickerTarget || !totalTarget || !noteTarget || !monthsTarget || !gridTarget) return;

  try {
    const response = await fetch("/api/github-activity", { cache: "no-cache" });
    if (!response.ok) throw new Error(`GitHub activity request failed: ${response.status}`);

    const payload = await response.json();
    const cells = Array.isArray(payload.cells) ? payload.cells : [];
    if (!cells.length) throw new Error(payload.error || "No contribution data returned");

    const weekPositions = [...new Set(cells.map((cell) => cell.x))].sort((a, b) => a - b);
    const dayPositions = [...new Set(cells.map((cell) => cell.y))].sort((a, b) => a - b);
    const weekIndex = new Map(weekPositions.map((position, index) => [position, index]));
    const dayIndex = new Map(dayPositions.map((position, index) => [position, index]));
    const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const seenMonths = new Set();
    const monthLabels = [];

    for (const cell of [...cells].sort((a, b) => a.date.localeCompare(b.date))) {
      const monthKey = cell.date.slice(0, 7);
      if (seenMonths.has(monthKey)) continue;
      seenMonths.add(monthKey);
      monthLabels.push({
        label: dateFormatter.format(new Date(`${cell.date}T00:00:00`)),
        week: weekIndex.get(cell.x) || 0,
      });
    }

    const total = new Intl.NumberFormat("en-US").format(Number(payload.total) || 0);
    const title = typeof payload.title === "string" ? payload.title : "contributions in the last year";
    kickerTarget.textContent = "all activity";
    totalTarget.textContent = `${total} ${title}`;
    noteTarget.textContent =
      typeof payload.note === "string" && payload.note
        ? payload.note
        : `Last 12 months across ${weekPositions.length} weeks.`;

    monthsTarget.style.setProperty("--github-weeks", String(weekPositions.length));
    gridTarget.style.setProperty("--github-weeks", String(weekPositions.length));

    monthsTarget.innerHTML = monthLabels
      .map((month) => `<span style="grid-column: ${month.week + 1};">${month.label}</span>`)
      .join("");

    gridTarget.innerHTML = cells
      .slice()
      .sort((left, right) => {
        const weekDelta = (weekIndex.get(left.x) || 0) - (weekIndex.get(right.x) || 0);
        if (weekDelta !== 0) return weekDelta;
        return (dayIndex.get(left.y) || 0) - (dayIndex.get(right.y) || 0);
      })
      .map((cell) => {
        const level = Math.max(0, Math.min(4, Number(cell.level) || 0));
        const count = Number(cell.count) || 0;
        return `
          <span
            class="github-cell"
            data-level="${level}"
            title="${cell.date}: ${count} contributions"
            aria-label="${cell.date}: ${count} contributions"
          ></span>
        `;
      })
      .join("");

    target.dataset.state = "ready";
  } catch (error) {
    console.error("GitHub activity failed", error);
    kickerTarget.textContent = "contribution graph";
    totalTarget.textContent = "GitHub activity unavailable";
    noteTarget.textContent = "Couldn’t load the live contribution graph right now.";
    monthsTarget.innerHTML = "";
    gridTarget.innerHTML = "";
    target.dataset.state = "error";
  }
}

async function renderMermaid() {
  if (!document.querySelector(".mermaid")) return;

  try {
    const mermaid = await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
    mermaid.default.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        background: "#070707",
        primaryColor: "#0e0b06",
        primaryTextColor: "#f3f2ee",
        primaryBorderColor: "#ffc400",
        lineColor: "#ffc400",
        secondaryColor: "#141006",
        tertiaryColor: "#1b1509",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
    });
    await mermaid.default.run({ querySelector: ".mermaid" });
  } catch (error) {
    console.error("Mermaid failed to render", error);
  }
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function highlightCodeBlocks() {
  if (!document.querySelector(".code-block")) return;

  try {
    await loadExternalScript("https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js");
    await loadExternalScript("https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-clike.min.js");
    await loadExternalScript("https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-python.min.js");
    await loadExternalScript("https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js");
    window.Prism.highlightAllUnder(document.querySelector(".article-body"));
  } catch (error) {
    console.error("Syntax highlighting failed", error);
  }
}

initializeThemeToggle();
renderBlogIndex().catch(console.error);
renderPost().catch(console.error);
bindWorkPanels();
bindProjectRows();
bindLocalTime();
renderGithubActivity().catch(console.error);
