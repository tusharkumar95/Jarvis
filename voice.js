(() => {
  const form = document.querySelector("#askForm");
  const input = document.querySelector("#askInput");
  if (!form || !input) return;

  if (document.querySelector("#voiceBtn")) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "voiceBtn";
  button.className = "voice-btn";
  button.setAttribute("aria-label", "Use voice input");
  button.textContent = "🎙︎";
  form.insertBefore(button, form.querySelector('button[type="submit"]'));

  const style = document.createElement("style");
  style.textContent = `
    .composer{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:end;gap:8px}.voice-btn{width:42px;height:42px;border:0;border-radius:50%;background:rgba(100,100,100,.08);color:inherit;font:inherit;font-size:1.05rem;cursor:pointer}.voice-btn.listening{background:rgba(100,100,100,.16);transform:scale(1.04)}.voice-btn:disabled{opacity:.35;cursor:default}
  `;
  document.head.appendChild(style);

  if (!SpeechRecognition) {
    button.disabled = true;
    button.title = "Voice input is not available in this browser";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = document.documentElement.lang || navigator.language || "en-CA";
  let finalText = "";

  recognition.onstart = () => {
    finalText = "";
    button.classList.add("listening");
    button.textContent = "●";
    button.title = "Listening… tap to stop";
  };

  recognition.onresult = event => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finalText += transcript;
      else interim += transcript;
    }
    const text = (finalText + interim).trim();
    if (text) input.value = text;
  };

  recognition.onerror = event => {
    button.title = event?.error === "not-allowed" ? "Microphone permission was not granted" : "Voice input stopped";
  };

  recognition.onend = () => {
    button.classList.remove("listening");
    button.textContent = "🎙︎";
    button.title = "Use voice input";
    input.focus();
  };

  button.addEventListener("click", () => {
    if (button.classList.contains("listening")) {
      try { recognition.stop(); } catch {}
      return;
    }
    try { recognition.start(); }
    catch {}
  });
})();