(() => {
  const view=document.querySelector("#discover"); if(!view)return;
  const KEY="jarvis-discover-interests-v1";
  const LIBRARY_KEY="jarvis-link-library-v1";
  const LEARN_KEY="jarvis-learn-history-v1";
  const apiBase=()=>String(window.JARVIS_API||"").replace(/\/$/,"");
  const choices=["History","Geography","Science","Technology","Economics","Photography","Investing concepts","Psychology","Design","General knowledge"];

  function read(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]}}
  function write(value){try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}}
  function interests(){const v=read(KEY);return Array.isArray(v)?v:[];}
  function scoreMap(){const m=new Map();interests().forEach(x=>m.set(String(x.name||""),Number(x.score)||0));return m;}
  function bump(name,delta=1){const list=interests();const hit=list.find(x=>String(x.name||"").toLowerCase()===name.toLowerCase());if(hit)hit.score=Math.max(0,(Number(hit.score)||0)+delta);else list.push({name,score:Math.max(0,delta),source:"discover"});write(list.slice(-40));renderChips();}
  function signals(){
    const map=scoreMap();
    const lib=read(LIBRARY_KEY); if(Array.isArray(lib))lib.forEach(item=>(item.topics||[]).forEach(t=>{const k=String(t);if(k)map.set(k,(map.get(k)||0)+.5);}));
    const learn=read(LEARN_KEY); if(Array.isArray(learn))learn.slice(0,10).forEach(item=>{const k=String(item.topic||"");if(k)map.set(k,(map.get(k)||0)+1);});
    return [...map.entries()].filter(([,score])=>score>0).sort((a,b)=>b[1]-a[1]).map(([name])=>name).filter(Boolean).slice(0,8);
  }

  const panel=document.createElement("section");
  panel.className="discover-personal glass";
  panel.innerHTML=`
    <div class="discover-personal-head"><div><p class="eyebrow">FOR YOU</p><h3>Personalized Discover</h3></div><span>3 min</span></div>
    <p class="discover-personal-copy">Choose what you want more of. Jarvis also learns from your Learn sessions and saved Library topics.</p>
    <div id="discoverInterestChips" class="discover-interest-chips"></div>
    <div class="discover-personal-actions"><button id="discoverGenerate" type="button">✦ Teach me something</button><button id="discoverSurprise" type="button" class="secondary-btn">Surprise me</button></div>
    <div id="discoverPersonalStatus" class="discover-personal-status">No AI call happens until you ask for a personalized story.</div>
    <div id="discoverPersonalOutput" class="discover-personal-output" hidden></div>`;
  const story=view.querySelector(".story"); if(story)story.insertAdjacentElement("beforebegin",panel); else view.appendChild(panel);

  const chips=panel.querySelector("#discoverInterestChips"),output=panel.querySelector("#discoverPersonalOutput"),status=panel.querySelector("#discoverPersonalStatus");
  function renderChips(){
    const scores=scoreMap(); chips.innerHTML="";
    choices.forEach(name=>{const b=document.createElement("button");b.type="button";b.textContent=name;b.className=scores.get(name)>0?"active":"";b.addEventListener("click",()=>{const current=scoreMap().get(name)||0;bump(name,current>0?-current:2);});chips.appendChild(b);});
  }
  function chosen(){const s=signals();return s.length?s:choices.slice(0,4);}
  async function generate(surprise=false){
    const base=apiBase(); if(!base)return; const prefs=chosen();
    const interest=surprise?prefs[(new Date().getDate()+prefs.length)%prefs.length]:prefs[0];
    output.hidden=false;output.innerHTML='<div class="discover-loading">Finding a verified story worth learning…</div>';status.textContent="Researching a personalized 3-minute lesson";
    const prompt=[
      "PERSONALIZED DISCOVER MODE",
      `User interests/signals: ${prefs.join(", ")}`,
      `Primary theme for this lesson: ${interest}`,
      "Create one genuinely interesting 3-minute learning story. Pick a specific topic, not a broad textbook overview.",
      "Explain what happened/works, why it is surprising or useful, and why it matters. Make connections across fields when useful.",
      "Use Jarvis research and verification. Do not invent anecdotes or facts. If the topic is disputed, say what is established versus contested.",
      "Finish with: One thing to remember; One question to think about."
    ].join("\n");
    try{
      const res=await fetch(base+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:prompt}]})});
      const data=await res.json(); if(!res.ok)throw new Error(data?.error||"Discover request failed");
      if(window.JarvisAnswerUI)window.JarvisAnswerUI.renderInto(output,data.text||"No story returned",{verified:data.verified});else output.textContent=data.text||"No story returned";
      output.dataset.verified=data.verified===true?"true":"false";status.textContent=data.verified===true?"✓ Verified personalized story":"Story returned · verification unavailable";bump(interest,1);
    }catch(error){output.textContent="Jarvis could not build this story: "+String(error?.message||error);status.textContent="Could not create personalized story";}
  }
  panel.querySelector("#discoverGenerate")?.addEventListener("click",()=>generate(false));
  panel.querySelector("#discoverSurprise")?.addEventListener("click",()=>generate(true));
  renderChips();
})();