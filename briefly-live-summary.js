(() => {
  function normalized(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function sync(stories = window.JarvisBriefly?.stories || []) {
    if (!Array.isArray(stories) || !stories.length) return;
    const byTitle = new Map(stories.map(story => [normalized(story?.title), story]));

    document.querySelectorAll("#brieflyList .news-item").forEach(card => {
      const title = card.querySelector("h3");
      const summary = card.querySelector("p[id^='jarvis-news-summary-']");
      if (!title || !summary) return;
      const story = byTitle.get(normalized(title.textContent));
      if (!story?.summary) return;
      summary.textContent = String(story.summary).trim();
      card.querySelector("[data-jarvis-news]")?.remove();
    });
  }

  window.JarvisBrieflySummary = { sync };
  document.addEventListener("jarvis:briefly-data", event => sync(event.detail?.stories));
  document.addEventListener("click", event => {
    if (!event.target.closest?.('[data-go="briefly"]')) return;
    requestAnimationFrame(() => sync());
  });
})();
