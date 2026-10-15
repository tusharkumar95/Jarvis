// Public configuration only. Never put API keys here.
window.JARVIS_API = "https://jarvis-ai-router.kumar-tushar95.workers.dev";

window.addEventListener("load", () => {
  if (!document.querySelector('link[data-lab-builder]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "lab-builder.css?v=1";
    css.dataset.labBuilder = "1";
    document.head.appendChild(css);
  }
  if (!document.querySelector('script[data-lab-builder]')) {
    const script = document.createElement("script");
    script.src = "lab-builder.js?v=1";
    script.dataset.labBuilder = "1";
    document.body.appendChild(script);
  }
}, { once:true });
