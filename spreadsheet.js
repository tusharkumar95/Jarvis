(() => {
  const view=document.querySelector("#spreadsheet"); if(!view)return;
  const apiBase=()=>String(window.JARVIS_API||"").replace(/\/$/,"");
  const input=view.querySelector("#spreadsheetQuestion");
  const output=view.querySelector("#spreadsheetOutput");
  const status=view.querySelector("#spreadsheetStatus");
  let mode="excel";

  const tips=[
    {mode:"excel",title:"LET makes complex formulas readable",body:"Use LET to name repeated calculations inside a formula. It can improve readability and can avoid recalculating the same expression multiple times.",example:'=LET(rate,B2/12,n,C2*12,pmt,-PMT(rate,n,A2),pmt)'},
    {mode:"vba",title:"Avoid Select and Activate",body:"Qualify Workbook, Worksheet and Range objects directly. Code becomes faster, safer and less dependent on what the user currently has selected.",example:'ThisWorkbook.Worksheets("Data").Range("A1").Value = "Ready"'},
    {mode:"sheets",title:"ARRAYFORMULA can replace copied-down formulas",body:"When a calculation is naturally column-oriented, one array formula can often replace hundreds of copied formulas and reduce maintenance.",example:'=ARRAYFORMULA(IF(A2:A="","",A2:A*B2:B))'},
    {mode:"apps",title:"Batch reads and writes in Apps Script",body:"Calling getValue/setValue cell-by-cell is slow. Read a range once with getValues(), work with the JavaScript array, then write once with setValues().",example:'const v=sheet.getRange(2,1,lastRow-1,4).getValues();\n// transform v in memory\nsheet.getRange(2,1,v.length,v[0].length).setValues(v);'},
    {mode:"excel",title:"Use XLOOKUP's if_not_found argument",body:"Instead of wrapping a lookup in IFERROR, XLOOKUP can return a clean fallback itself, while leaving unrelated errors visible.",example:'=XLOOKUP(A2,IDs,Names,"Not found")'},
    {mode:"vba",title:"Range.Find remembers previous UI settings",body:"Excel's Find method can reuse LookIn, LookAt and other settings from prior Find operations. Pass important arguments explicitly in production macros.",example:'Set hit = rng.Find(What:=key, LookIn:=xlValues, LookAt:=xlWhole, MatchCase:=False)'},
    {mode:"sheets",title:"QUERY can reshape data in one formula",body:"QUERY is useful when you need select/filter/group/aggregate logic in a single expression instead of chains of helper formulas.",example:'=QUERY(A1:D,"select A,sum(D) where B=\'Open\' group by A label sum(D) \'Total\'",1)'},
    {mode:"apps",title:"Use LockService for concurrent edits",body:"If multiple users or triggers can update the same data, LockService can prevent race conditions around critical read-modify-write sections.",example:'const lock=LockService.getDocumentLock();\nlock.waitLock(30000);\ntry { /* critical work */ } finally { lock.releaseLock(); }'},
    {mode:"excel",title:"Dynamic arrays can eliminate helper columns",body:"FILTER, UNIQUE, SORT, TAKE, DROP, CHOOSECOLS and related functions let one formula return an entire result set that spills automatically.",example:'=SORT(UNIQUE(FILTER(A2:A100,B2:B100="Active")))'},
    {mode:"vba",title:"Move ranges through arrays, not loops",body:"For large ranges, assigning Range.Value2 to a Variant array and processing in memory is usually much faster than touching each cell through COM repeatedly.",example:'Dim data As Variant\ndata = ws.Range("A2:D50000").Value2'},
    {mode:"sheets",title:"Use named functions for reusable logic",body:"Google Sheets named functions let you package complicated formulas with readable parameters so you can reuse them without Apps Script.",example:'Example idea: NET_MARGIN(revenue,cost) → =(revenue-cost)/revenue'},
    {mode:"apps",title:"PropertiesService is a lightweight key-value store",body:"Use script, user or document properties for small configuration/state values instead of hiding settings in random spreadsheet cells.",example:'PropertiesService.getScriptProperties().setProperty("LAST_RUN", new Date().toISOString());'},
    {mode:"excel",title:"LAMBDA turns formulas into reusable functions",body:"A LAMBDA can encapsulate logic without VBA. Combine it with LET and named formulas to create maintainable workbook-level functions.",example:'=LAMBDA(x,IF(x="","",TRIM(CLEAN(x))))'},
    {mode:"vba",title:"Restore Application state in a cleanup block",body:"If you disable ScreenUpdating, EnableEvents or Calculation, always restore them even when the macro errors. A single cleanup label is a reliable pattern.",example:'On Error GoTo CleanUp\nApplication.ScreenUpdating=False\n\' work\nCleanUp:\nApplication.ScreenUpdating=True'},
    {mode:"sheets",title:"LET exists in Google Sheets too",body:"LET can make long formulas easier to read by binding intermediate expressions once and referring to them by name.",example:'=LET(filtered,FILTER(A2:D,B2:B="Active"),SORT(filtered,4,FALSE))'},
    {mode:"apps",title:"Prefer installable triggers when authorization matters",body:"Simple triggers such as onEdit have restrictions. Installable triggers can run with authorization and support more services, but you should understand whose account executes them.",example:'Use ScriptApp.newTrigger("myEditHandler").forSpreadsheet(ss).onEdit().create();'}
  ];

  function dayIndex(){const d=new Date();return Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()/86400000);}
  function renderTip(offset=0){
    const tip=tips[(dayIndex()+offset)%tips.length];
    view.querySelector("#spreadsheetTipMode").textContent=({excel:"Excel",vba:"Excel VBA",sheets:"Google Sheets",apps:"Apps Script"})[tip.mode];
    view.querySelector("#spreadsheetTipTitle").textContent=tip.title;
    view.querySelector("#spreadsheetTipBody").textContent=tip.body;
    view.querySelector("#spreadsheetTipCode").textContent=tip.example;
  }
  let tipOffset=0; renderTip();
  view.querySelector("#spreadsheetAnotherTip")?.addEventListener("click",()=>{tipOffset++;renderTip(tipOffset);});

  function modeName(){return {excel:"Microsoft Excel formulas/features",vba:"Excel VBA",sheets:"Google Sheets",apps:"Google Apps Script for Sheets"}[mode];}
  view.querySelectorAll("[data-sheet-mode]").forEach(btn=>btn.addEventListener("click",()=>{
    mode=btn.dataset.sheetMode; view.querySelectorAll("[data-sheet-mode]").forEach(x=>x.classList.toggle("active",x===btn));
    input.placeholder=`Ask an expert ${modeName()} question…`;
  }));

  async function ask(){
    const q=input.value.trim(); if(!q)return input.focus();
    const base=apiBase(); if(!base)return;
    output.hidden=false; output.innerHTML='<div class="expert-loading">Checking official references and building the answer…</div>'; status.textContent="Expert mode · researching";
    const prompt=[
      "SPREADSHEET EXPERT MODE",
      `Area: ${modeName()}`,
      `User question: ${q}`,
      "Give an expert-level solution. Be practical and exact. If a workbook/sheet layout assumption matters, state it.",
      "For formulas: provide the exact formula first, then explain it, compatibility/version issues, and a robust alternative when useful.",
      "For VBA or Apps Script: provide production-quality code, explain the object/API choices, error handling, performance, and common failure modes. Avoid unnecessary Select/Activate in VBA and avoid cell-by-cell service calls in Apps Script.",
      "If the user's approach is inefficient or fragile, say so and propose a better design.",
      "Use official Microsoft or Google documentation retrieved by Jarvis as the primary authority. If the current behavior cannot be verified, say so rather than guessing."
    ].join("\n");
    try{
      const res=await fetch(base+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:prompt}]})});
      const data=await res.json(); if(!res.ok)throw new Error(data?.error||"Expert request failed");
      if(window.JarvisAnswerUI)window.JarvisAnswerUI.renderInto(output,data.text||"No answer",{verified:data.verified}); else output.textContent=data.text||"No answer";
      output.dataset.verified=data.verified===true?"true":"false";
      status.textContent=data.verified===true?"✓ Verified against available references":"Answer returned · verification unavailable";
    }catch(error){output.textContent="Spreadsheet Expert could not answer: "+String(error?.message||error);status.textContent="Could not complete expert check";}
  }
  view.querySelector("#spreadsheetAsk")?.addEventListener("click",ask);
  input?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask();}});
  view.querySelectorAll("[data-sheet-example]").forEach(btn=>btn.addEventListener("click",()=>{input.value=btn.dataset.sheetExample;input.focus();}));
})();