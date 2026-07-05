async function loadPosts() {
  const response = await fetch("../posts/index.json");
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

  lines.forEach((line) => {
    if (line.startsWith("```")) {
      if (code) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        code = false;
        codeLines = [];
      } else {
        flushParagraph();
        closeList();
        code = true;
      }
      return;
    }

    if (code) {
      codeLines.push(line);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      return;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      closeList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      return;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      return;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      return;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      return;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (!list) {
        html.push("<ul>");
        list = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      return;
    }

    if (line === "---") {
      flushParagraph();
      closeList();
      html.push("<hr>");
      return;
    }

    paragraph.push(line.trim());
  });

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
  const response = await fetch(`../posts/${slug}.md`);
  if (!response.ok) {
    target.innerHTML = "<p>Post not found.</p>";
    return;
  }

  const [meta, markdown] = parseFrontMatter(await response.text());
  document.title = `${meta.title || "Post"} · Deepam Minda`;
  target.innerHTML = `
    <a class="back-link" href="./">Back to blog</a>
    <article>
      <header>
        <h1>${escapeHtml(meta.title || "Untitled")}</h1>
        <p class="article-meta">${escapeHtml(meta.date || "")}</p>
      </header>
      <div class="article-body">${markdownToHtml(markdown.replace(/^# .+$/m, "").trim())}</div>
    </article>
  `;
}

renderBlogIndex().catch(console.error);
renderPost().catch(console.error);
