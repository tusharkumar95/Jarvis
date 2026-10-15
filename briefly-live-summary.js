(() => {
  function normalized(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function syncBrieflySummaries() {
    const stories = Array.isArray(window.JarvisBriefly?.stories) ? window.JarvisBriefly.stories : [];
    if (!stories.length) return;

    const byTitle = new Map(stories.map(story => [normalized(story?.title), story]));

    document.querySelectorAll(".news-item").forEach(card => {
      const title = card.querySelector("h3");
      const summary = card.querySelector("p[id^='jarvis-news-summary-']");
      if (!title || !summary) return;

      const story = byTitle.get(normalized(title.textContent));
      if (!story?.summary) return;

      summary.textContent = String(story.summary).trim();

      const summarizeButton = card.querySelector("[data-jarvis-news]");
      if (summarizeButton) summarizeButton.remove();
    });
  }

  const observer = new MutationObserver(syncBrieflySummaries);
  observer.observe(document.body, { childList: true, subtree: true });

  syncBrieflySummaries();
  const timer = setInterval(syncBrieflySummaries, 2000);
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    clearInterval(timer);
  }, { once: true });
})();
