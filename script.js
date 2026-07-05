async function loadPosts() {
  const response = await fetch("../posts/index.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load posts index");
  return response.json();
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

async function renderMermaid() {
  if (!document.querySelector(".mermaid")) return;

  try {
    const mermaid = await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
    mermaid.default.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        background: "#f5f1e8",
        primaryColor: "#ede6d8",
        primaryTextColor: "#1f1b16",
        primaryBorderColor: "#8f3f25",
        lineColor: "#8f3f25",
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

renderBlogIndex().catch(console.error);
renderPost().catch(console.error);
