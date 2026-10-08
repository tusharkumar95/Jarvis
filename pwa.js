(() => {
  const topActions = document.querySelector(".top-actions");
  if (topActions && !document.querySelector("#connectionStatus")) {
    const status = document.createElement("span");
    status.id = "connectionStatus";
    status.className = "connection-status";
    topActions.insertBefore(status, topActions.firstChild);
  }

  const style = document.createElement("style");
  style.textContent = `.connection-status{font-size:.78rem;opacity:.65;white-space:nowrap}.connection-status.offline{opacity:.9}`;
  document.head.appendChild(style);

  function renderConnection() {
    const el = document.querySelector("#connectionStatus");
    if (!el) return;
    el.textContent = navigator.onLine ? "Online" : "Offline shell";
    el.classList.toggle("offline", !navigator.onLine);
  }

  window.addEventListener("online", renderConnection);
  window.addEventListener("offline", renderConnection);
  renderConnection();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();