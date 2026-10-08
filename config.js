// Public configuration only. Never put API keys here.
window.JARVIS_API = "https://jarvis-ai-router.kumar-tushar95.workers.dev";

// Load local task management after the main app and memory layers are ready.
window.addEventListener("load", () => {
  if (document.querySelector('script[data-jarvis-tasks]')) return;
  const script = document.createElement("script");
  script.src = "tasks.js?v=1";
  script.dataset.jarvisTasks = "true";
  document.body.appendChild(script);
});
