(() => {
  const nativeFetch = window.fetch.bind(window);
  let moves = [];
  let meta = {};

  async function refreshMoves() {
    try {
      const response = await nativeFetch("../Briefly/moves-intelligence.json?jarvisMoves=" + Date.now(), { cache:"no-store" });
      if (!response.ok) return;
      const data = await response.json();
      moves = Array.isArray(data?.records) ? data.records.slice(0, 160) : [];
      meta = {
        updated:data?.updated || "",
        engine:data?.engine || "Moves Intelligence",
        policy:data?.policy || "",
        sources:data?.sources || {}
      };
      window.JarvisMoves = { ...meta, records:moves.map(move => ({...move})) };
    } catch {}
  }

  function wantsMovesContext(question) {
    return /\b(moves?|smart money|insider buying|insider selling|insiders?|accumulat(?:e|es|ed|ing|ion)|bulk deal|block deal|ownership activity|large buyer|large seller|who (?:is|has been) buying|who (?:is|has been) selling|institutional buying|institutional selling)\b/i.test(String(question || ""));
  }

  function matchQuery(move, question) {
    const q=String(question||"").toLowerCase();
    if (/\b(canada|canadian|tsx|tsxv|cse)\b/.test(q) && move.market!=="Canada") return false;
    if (/\b(india|indian|nse|bse)\b/.test(q) && move.market!=="India") return false;
    if (/\binsider buying\b/.test(q) && !(move.tags||[]).map(x=>String(x).toLowerCase()).includes("insider buying")) return false;
    if (/\binsider selling\b/.test(q) && move.direction!=="SELL") return false;
    if (/\baccumulat/.test(q) && !(move.tags||[]).map(x=>String(x).toLowerCase()).includes("accumulating")) return false;
    if (/\b(?:selling|seller|sold|sell)\b/.test(q) && !/\b(?:buy|buyer|buying|accumulat)/.test(q) && move.direction!=="SELL") return false;
    return true;
  }

  function money(move) {
    if (move.market === "India") return `₹${Number(move.valueCr || 0).toFixed(2)} Cr`;
    const value=Number(move.valueCAD || 0);
    return value ? `CAD ${Math.round(value).toLocaleString("en-CA")}` : "value unavailable";
  }

  function line(move,index) {
    const tags=Array.isArray(move.tags)?move.tags.join(", "):"";
    return [
      `${index+1}. ${move.market} — ${move.company || "Unknown company"}${move.symbol ? ` (${move.symbol})` : ""}`,
      `actor: ${move.investor || "Unknown"}${move.role ? `; role: ${move.role}` : move.actorType ? `; type: ${move.actorType}` : ""}`,
      `action: ${move.direction || ""}; disclosure type: ${move.dealType || ""}; value: ${money(move)}`,
      `signal: ${move.signal || ""}; Move Score: ${Number(move.moveScore || 0)}/100 (${move.strength || "unrated"}); observed days: ${Number(move.observedDays || 1)}`,
      tags ? `tags: ${tags}` : "",
      move.whyNotable ? `why notable: ${move.whyNotable}` : "",
      `source quality: ${move.sourceQuality || "public disclosure"}`,
      move.sourceUrl ? `source: ${move.sourceUrl}` : ""
    ].filter(Boolean).join(" — ");
  }

  function buildContext(question) {
    if (!moves.length) return "JARVIS MOVES CONTEXT: Briefly Moves Intelligence is currently unavailable.";
    let selected=moves.filter(move=>matchQuery(move,question));
    if (!selected.length) selected=[...moves];
    selected.sort((a,b)=>(Number(b.moveScore||0)-Number(a.moveScore||0)) || String(b.date||"").localeCompare(String(a.date||"")));
    const sourceNote=meta?.sources?.Canada?.automation || "Canadian activity is published only after public-disclosure verification.";
    return [
      "JARVIS MOVES INTELLIGENCE CONTEXT.",
      `Feed: ${meta.engine || "Moves Intelligence"}${meta.updated ? `; updated ${meta.updated}` : ""}.`,
      "Use only the records below when making claims about disclosed ownership activity. Do not infer undisclosed holdings, intent, future price performance, or investment merit.",
      "Move Score ranks disclosure significance from the observed data; it is not a buy/sell score or expected-return forecast.",
      "India records come from official NSE bulk/block disclosures. A bulk or block trade is not automatically bullish; market intermediaries are deliberately discounted.",
      `Canada rule: ${sourceNote} Never call a Canadian record 'insider buying' unless the supplied role/tags establish an insider open-market purchase.`,
      "When the user asks who is accumulating, prioritize repeated observed BUY days. When they ask about selling, keep BUY and SELL activity distinct. Mention important limitations plainly.",
      selected.slice(0,12).map(line).join("\n")
    ].join("\n\n");
  }

  window.fetch=async function(input,init){
    const url=typeof input==="string"?input:String(input?.url||"");
    const method=String(init?.method||(typeof input!=="string"?input?.method:"GET")||"GET").toUpperCase();
    if(method==="POST"&&/\/chat(?:\?|$)/.test(url)&&typeof init?.body==="string"){
      try{
        const body=JSON.parse(init.body);
        const messages=Array.isArray(body?.messages)?body.messages:[];
        const last=messages[messages.length-1];
        if(last?.role==="user"&&wantsMovesContext(last.content)){
          const context=buildContext(last.content);
          body.messages=[...messages.slice(0,-1),{role:"user",content:context},last];
          init={...init,body:JSON.stringify(body)};
        }
      }catch{}
    }
    return nativeFetch(input,init);
  };

  refreshMoves();
  const timer=setInterval(refreshMoves,5*60*1000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshMoves();});
  window.addEventListener("beforeunload",()=>clearInterval(timer),{once:true});
})();
