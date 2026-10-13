(() => {
  const responseMeta = new Map();
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === "string" ? input : String(input?.url || "");
      const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      if (method === "POST" && /\/(chat)(?:\?|$)/.test(url)) {
        const clone = response.clone();
        const data = await clone.json();
        const text = String(data?.text || "").trim();
        if (text) responseMeta.set(text, {
          verified: data?.verified === true,
          verification: data?.verification || "",
          provider: data?.provider || "",
          model: data?.model || ""
        });
      }
    } catch {}
    return response;
  };

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function linkify(text) {
    const safe = esc(text);
    return safe.replace(/(https?:\/\/[^\s<]+)/g, raw => {
      const clean = raw.replace(/[),.;]+$/, "");
      const tail = raw.slice(clean.length);
      let label = "Source";
      try { label = new URL(clean).hostname.replace(/^www\./, ""); } catch {}
      return `<a class="answer-link" href="${clean}" target="_blank" rel="noopener">${esc(label)} ↗</a>${esc(tail)}`;
    });
  }

  function render(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    const lines = text.split(/\r?\n/);
    const out = [];
    let inCode = false;
    let code = [];
    let inSources = false;
    let bullets = [];

    const flushBullets = () => {
      if (!bullets.length) return;
      out.push(`<ul>${bullets.map(v => `<li>${linkify(v)}</li>`).join("")}</ul>`);
      bullets = [];
    };
    const flushCode = () => {
      if (!code.length) return;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      code = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (/^```/.test(line.trim())) {
        flushBullets();
        if (inCode) { flushCode(); inCode = false; }
        else inCode = true;
        continue;
      }
      if (inCode) { code.push(rawLine); continue; }
      if (/^sources used:?$/i.test(line.trim())) {
        flushBullets();
        inSources = true;
        out.push('<div class="answer-sources"><span>Sources</span>');
        continue;
      }
      if (inSources) {
        if (!line.trim()) continue;
        const urls = line.match(/https?:\/\/[^\s]+/g) || [];
        if (urls.length) {
          urls.forEach(url => {
            const clean = url.replace(/[),.;]+$/, "");
            let label = "Source";
            try { label = new URL(clean).hostname.replace(/^www\./, ""); } catch {}
            out.push(`<a href="${esc(clean)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`);
          });
          continue;
        }
        inSources = false;
        out.push("</div>");
      }
      const bullet = line.match(/^[-•]\s+(.+)/);
      if (bullet) { bullets.push(bullet[1]); continue; }
      flushBullets();
      if (!line.trim()) { out.push('<div class="answer-gap"></div>'); continue; }
      if (line.length <= 58 && /:$/.test(line) && !/^https?:/i.test(line)) {
        out.push(`<div class="answer-section">${esc(line.replace(/:$/, ""))}</div>`);
      } else {
        out.push(`<p>${linkify(line)}</p>`);
      }
    }
    flushBullets();
    if (inCode) flushCode();
    if (inSources) out.push("</div>");
    return out.join("");
  }

  function enhanceMessage(node) {
    if (!node || node.dataset.answerEnhanced === "1" || !node.classList.contains("jarvis")) return;
    const raw = node.textContent.trim();
    if (!raw || raw === "Thinking…" || raw.startsWith("Jarvis could not reach")) return;
    node.dataset.rawText = raw;
    node.innerHTML = `<div class="answer-body">${render(raw)}</div>`;
    node.dataset.answerEnhanced = "1";
    const meta = responseMeta.get(raw);
    if (meta?.verified) node.dataset.verified = "true";
    if (meta?.verification) node.dataset.verification = meta.verification;

    if (meta) {
      const actions = document.createElement("div");
      actions.className = "answer-actions";
      [["Simpler","Explain your last answer more simply."],["Deeper","Go deeper on your last answer and add the important nuance."],["Compare","Give me the most useful comparison related to your last answer."]].forEach(([label,prompt]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          const input = document.querySelector("#askInput");
          if (!input) return;
          input.value = prompt;
          input.focus();
        });
        actions.appendChild(button);
      });
      node.appendChild(actions);
    }
  }

  function observeChat() {
    const chat = document.querySelector("#chat");
    if (!chat) return;
    chat.querySelectorAll(".message.jarvis").forEach(enhanceMessage);
    new MutationObserver(mutations => {
      mutations.forEach(m => {
        if (m.type === "characterData") enhanceMessage(m.target.parentElement?.closest?.(".message.jarvis"));
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.(".message.jarvis")) enhanceMessage(node);
          node.querySelectorAll?.(".message.jarvis").forEach(enhanceMessage);
        });
        if (m.target?.nodeType === 1 && m.target.matches?.(".message.jarvis")) {
          m.target.dataset.answerEnhanced = "0";
          enhanceMessage(m.target);
        }
      });
    }).observe(chat, { childList:true, subtree:true, characterData:true });
  }

  window.JarvisAnswerUI = {
    render,
    renderInto(element, text, meta = {}) {
      if (!element) return;
      element.dataset.rawText = String(text || "");
      element.innerHTML = render(text);
      element.classList.add("answer-body");
      element.toggleAttribute("data-verified", meta.verified === true);
    }
  };

  observeChat();
})();