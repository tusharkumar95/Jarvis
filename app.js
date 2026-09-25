const views=[...document.querySelectorAll(".view")];
const nav=[...document.querySelectorAll(".nav")];
function go(id){
  views.forEach(v=>v.classList.toggle("active",v.id===id));
  nav.forEach(n=>n.classList.toggle("active",n.dataset.go===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",()=>go(el.dataset.go)));

const now=new Date();
document.querySelector("#dateLabel").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
const hour=now.getHours();
document.querySelector("#greeting").textContent=(hour<12?"Good morning.":hour<18?"Good afternoon.":"Good evening.");

const savedTheme=localStorage.getItem("jarvis-theme");
if(savedTheme==="dark") document.body.classList.add("dark");
document.querySelector("#themeBtn").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("jarvis-theme",document.body.classList.contains("dark")?"dark":"light");
});

document.querySelector("#askForm").addEventListener("submit",e=>{
  e.preventDefault();
  const input=document.querySelector("#askInput");
  const value=input.value.trim();
  if(!value)return;
  const chat=document.querySelector("#chat");
  chat.insertAdjacentHTML("beforeend",`<div class="message user">${escapeHtml(value)}</div>`);
  setTimeout(()=>chat.insertAdjacentHTML("beforeend",`<div class="message jarvis">The interface is working. In Phase 2 this message will go through the free AI router instead of this placeholder.</div>`),250);
  input.value="";
});
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

document.querySelectorAll("[data-answer]").forEach(btn=>btn.addEventListener("click",()=>{
  const ans=document.querySelector("#quizAnswer");
  if(btn.dataset.answer==="right") ans.textContent="Correct — Mount Tambora is on Sumbawa, Indonesia.";
  else ans.textContent="Not this one. The answer is Indonesia.";
}));

document.querySelector("#startBuild").addEventListener("click",()=>{
  const idea=document.querySelector("#idea").value.trim();
  if(!idea)return;
  const words=idea.replace(/[^\w\s-]/g,"").split(/\s+/).filter(Boolean).slice(0,5);
  const name=words.length?words.map(w=>w[0].toUpperCase()+w.slice(1)).join(" "):"New App";
  document.querySelector("#projectName").textContent=name;
  document.querySelector("#projectCard").classList.remove("hidden");
});