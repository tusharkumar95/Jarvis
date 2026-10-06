// Public configuration only. Never put API keys here.
window.JARVIS_API = "https://jarvis-ai-router.kumar-tushar95.workers.dev";

// Load the private, on-device chat history layer after the main app starts.
window.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src = "chat-memory.js";
  document.body.appendChild(script);
});
