(() => {
  const view = document.querySelector("#learn");
  if (!view) return;
  const KEY = "jarvis-learn-history-v1";
  const INTEREST_KEY = "jarvis-discover-interests-v1";
  const apiBase = () => String(window.JARVIS_API || "").replace(/\/$/, "");
  const topic = view.querySelector("#learnTopic");
  const output = view.querySelector("#learnOutput");
  const status = view.querySelector("#learnStatus");
  const history = view.querySelector("#learnHistory");
  let level = "intermediate";
  let minutes = 10;
  let lastTopic = "";

  function read(key){ try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]} }
  function write(key,val){ try{localStorage.setItem(key,JSON.stringify(val))}catch{} }
  function setStatus(text){ if(status)status.textContent=text; }
  function rememberInterest(value){
    const clean=String(value||"").trim().slice(0,80); if(!clean)return;
    const data=read(INTEREST_KEY); const list=Array.isArray(data)?data:[];
    const found=list.find(x=>String(x.name||"").toLowerCase()===clean.toLowerCase());
    if(found) found.score=(Number(found.score)||0)+2; else list.push({name:clean,score:2,source:"learn"});
    write(INTEREST_KEY,list.slice(-30));
  }
  function saveHistory(item){ const list=read(KEY); const next=Array.isArray(list)?list:[]; next.unshift(item); write(KEY,next.slice(0,30)); renderHistory(); }
  function renderHistory(){
    if(!history)return; const list=read(KEY); history.innerHTML="";
    if(!Array.isArray(list)||!list.length){ history.innerHTML='<div class="learn-empty">No lessons yet. Your recent learning sessions will appear here.</div>'; return; }
    list.slice(0,5).forEach(item=>{
      const b=document.createElement("button"); b.type="button"; b.className="learn-history-item";
      b.innerHTML=`<span>${escapeHtml(item.topic||"Lesson")}</span><small>${escapeHtml(item.level||"")} · ${Number(item.minutes)||10} min</small>`;
      b.addEventListener("click",()=>{topic.value=item.topic||""; startLesson("lesson");}); history.appendChild(b);
    });
  }
  function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

  async function ask(prompt){
    const base=apiBase(); if(!base)throw new Error("Jarvis router is not connected");
    const res=await fetch(base+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:prompt}]})});
    const data=await res.json(); if(!res.ok)throw new Error(data?.error||"Jarvis could not answer"); return data;
  }

  async function startLesson(mode="lesson"){
    const value=topic.value.trim(); if(!value)return topic.focus();
    lastTopic=value; rememberInterest(value); output.hidden=false; output.innerHTML='<div class="learn-loading">Building a verified lesson…</div>'; setStatus("Researching and checking the lesson before showing it.");
    const baseRules=[
      "LEARN MODE",
      `Topic: ${value}`,
      `Learner level: ${level}`,
      `Time available: about ${minutes} minutes`,
      "Teach for understanding, not memorization. Start with the core idea, then build intuition, examples, common misconceptions, and practical significance.",
      "Use concrete examples and analogies where they genuinely help. Do not invent facts. For factual material, use Jarvis research and verification.",
      "End with 3 key takeaways and 3 quick-check questions. Keep the depth appropriate to the time limit."
    ];
    if(mode==="quiz") baseRules.push("Instead of a full lesson, create a challenging 6-question quiz with answers hidden below each question and brief explanations.");
    if(mode==="deeper") baseRules.push("Go one level deeper than the previous lesson: mechanisms, edge cases, nuance, and connections to adjacent ideas.");
    try{
      const data=await ask(baseRules.join("\n"));
      if(window.JarvisAnswerUI) window.JarvisAnswerUI.renderInto(output,data.text||"No lesson returned",{verified:data.verified}); else output.textContent=data.text||"No lesson returned";
      output.dataset.verified=data.verified===true?"true":"false";
      setStatus(data.verified===true?"✓ Verified lesson":"Lesson returned; verification status unavailable");
      if(mode==="lesson") saveHistory({topic:value,level,minutes,created:new Date().toISOString(),summary:String(data.text||"").slice(0,220)});
    }catch(error){ output.textContent="Jarvis could not build this lesson: "+String(error?.message||error); setStatus("Could not create lesson"); }
  }

  view.querySelectorAll("[data-learn-level]").forEach(btn=>btn.addEventListener("click",()=>{level=btn.dataset.learnLevel;view.querySelectorAll("[data-learn-level]").forEach(x=>x.classList.toggle("active",x===btn));}));
  view.querySelectorAll("[data-learn-minutes]").forEach(btn=>btn.addEventListener("click",()=>{minutes=Number(btn.dataset.learnMinutes)||10;view.querySelectorAll("[data-learn-minutes]").forEach(x=>x.classList.toggle("active",x===btn));}));
  view.querySelector("#learnStart")?.addEventListener("click",()=>startLesson("lesson"));
  view.querySelector("#learnQuiz")?.addEventListener("click",()=>startLesson("quiz"));
  view.querySelector("#learnDeeper")?.addEventListener("click",()=>{if(!topic.value.trim()&&lastTopic)topic.value=lastTopic;startLesson("deeper")});
  topic?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();startLesson("lesson");}});
  renderHistory();
})();