(() => {
  const mount = document.querySelector("#universalSearchMount");
  if (!mount) return;

  let brieflyRows = [];

  const stores = [
    { key:"jarvis-tasks-v1", type:"Task", target:"tasks", rows:v => (Array.isArray(v)?v:[]).map(x => ({title:x.text, body:x.due ? `Due ${x.due}` : "Task", taskSheet:true})) },
    { key:"jarvis-lab-projects-v1", type:"Project", target:"lab", rows:v => (Array.isArray(v)?v:[]).map(x => ({title:x.name||x.idea||"Project", body:x.idea||"Lab project", anchor:"projectsList"})) },
    { key:"jarvis-personal-memory-v1", type:"Memory", target:"ask", rows:v => (Array.isArray(v)?v:[]).map(x => ({title:x.text, body:"Personal memory"})) },
    { key:"jarvis-link-library-v1", type:"Website", target:"library", rows:v => (Array.isArray(v)?v:[]).map(x => ({title:x.title||x.url, body:[x.description,x.note,(x.topics||[]).join(" ")].filter(Boolean).join(" · "), url:x.url, anchor:"libraryList"})) },
    { key:"jarvis-chat-history-v1", type:"Chat", target:"ask", rows:v => (Array.isArray(v)?v:[]).map(x => ({title:(x.role==="user"?"You: ":"Jarvis: ") + String(x.content||"").slice(0,90), body:String(x.content||""), anchor:"chat"})) },
    { key:"jarvis-learn-history-v1", type:"Lesson", target:"learn", rows:v => (Array.isArray(v)?v:[]).map(x => ({title:x.topic||"Lesson", body:[x.level,x.minutes?`${x.minutes} min`:"",x.summary].filter(Boolean).join(" · "), anchor:"learnOutput"})) }
  ];

  mount.innerHTML = `
    <div class="universal-search glass">
      <span class="universal-search-icon">⌕</span>
      <input id="universalSearchInput" type="search" placeholder="Search everything in Jarvis…" autocomplete="off" aria-label="Search everything in Jarvis" />
      <button id="universalSearchClear" type="button" aria-label="Clear search">×</button>
    </div>
    <div id="universalSearchResults" class="universal-results" hidden></div>`;

  const input = mount.querySelector("#universalSearchInput");
  const clear = mount.querySelector("#universalSearchClear");
  const results = mount.querySelector("#universalSearchResults");

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }

  async function refreshBrieflyRows() {
    try {
      const response = await fetch("../Briefly/data.json?search=" + Date.now(), { cache:"no-store" });
      if (!response.ok) return;
      const data = await response.json();
      brieflyRows = (Array.isArray(data?.stories) ? data.stories : []).slice(0, 12).map(story => ({
        type:"Briefly",
        target:"briefly",
        title:String(story?.title || "News story"),
        body:[story?.cat,story?.summary,story?.why,story?.change].filter(Boolean).join(" · "),
        newsId:story?.id || ""
      }));
      if (input.value.trim()) render();
    } catch {}
  }

  function tokens(text) {
    return String(text||"").toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  }

  function score(row, query) {
    const hay = `${row.title||""} ${row.body||""}`.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return 0;
    let s = hay.includes(q) ? 8 : 0;
    for (const t of tokens(q)) {
      if ((row.title||"").toLowerCase().includes(t)) s += 4;
      else if (hay.includes(t)) s += 2;
    }
    if (row.type === "Briefly") s += 0.5;
    return s;
  }

  function allRows() {
    const localRows = stores.flatMap(store => {
      let rows = [];
      try { rows = store.rows(read(store.key)); } catch {}
      return rows.filter(x => x?.title).map(x => ({...x, type:store.type, target:store.target}));
    });
    return [...localRows, ...brieflyRows];
  }

  function goTo(row) {
    if (row.taskSheet) {
      document.querySelector('[aria-label="Open Tasks"]')?.click();
      return;
    }
    document.querySelector(`[data-go="${row.target}"]`)?.click();
    setTimeout(() => {
      const anchor = row.anchor ? document.getElementById(row.anchor) : null;
      if (anchor) anchor.scrollIntoView({behavior:"smooth",block:"start"});
    }, 180);
  }

  function render() {
    const q = input.value.trim();
    if (!q) { results.hidden = true; results.innerHTML=""; return; }
    const ranked = allRows().map(row => ({row, score:score(row,q)})).filter(x => x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
    results.hidden = false;
    results.innerHTML = "";
    if (!ranked.length) {
      results.innerHTML = '<div class="universal-empty">Nothing in Jarvis matches that yet.</div>';
      return;
    }
    ranked.forEach(({row}) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "universal-result";
      const type = document.createElement("span"); type.className="universal-type"; type.textContent=row.type;
      const body = document.createElement("div");
      const title = document.createElement("b"); title.textContent=row.title;
      const snippet = document.createElement("small"); snippet.textContent=String(row.body||"").slice(0,150);
      body.append(title,snippet);
      const arrow = document.createElement("span"); arrow.textContent="→";
      button.append(type,body,arrow);
      button.addEventListener("click",()=>goTo(row));
      results.appendChild(button);
    });
  }

  input.addEventListener("input",render);
  input.addEventListener("keydown",e=>{ if(e.key==="Escape"){input.value="";render();input.blur();} });
  clear.addEventListener("click",()=>{input.value="";render();input.focus();});

  refreshBrieflyRows();
  const refreshTimer = setInterval(refreshBrieflyRows, 10 * 60 * 1000);
  window.addEventListener("beforeunload", () => clearInterval(refreshTimer), { once:true });
})();
