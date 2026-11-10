// Shell Fuel Tip. Location is requested only on tap and is not saved to persistent storage.
(() => {
  const root = document.getElementById("fuel");
  if (!root) return;
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const getLocal = (name, fallback) => { try { return JSON.parse(localStorage.getItem(name)) ?? fallback; } catch { return fallback; } };
  const putLocal = (name, value) => { try { localStorage.setItem(name, JSON.stringify(value)); } catch {} };
  const prefs = getLocal("jarvis-fuel-preferences-v1", {fuel:"regular",radius:"8",litres:40});
  const favorites = new Set(getLocal("jarvis-fuel-favorites-v1", []));
  const grade = byId("fuelGrade"), radius = byId("fuelRadius"), litres = byId("fuelLitres");
  grade.value = ["regular","midgrade","premium","diesel"].includes(prefs.fuel) ? prefs.fuel : "regular";
  radius.value = ["5","8","10","15"].includes(String(prefs.radius)) ? String(prefs.radius) : "8";
  litres.value = Number.isFinite(+prefs.litres) ? Math.max(1,Math.min(100,+prefs.litres)) : 40;
  let location = null, data = null, busy = false;
  const list = byId("fuelResults"), status = byId("fuelStatus"), summary = byId("fuelSummary");
  function setStatus(message){status.textContent = message;}
  function savePrefs(){putLocal("jarvis-fuel-preferences-v1",{fuel:grade.value,radius:radius.value,litres:Number(litres.value)||40});}
  function ageLabel(iso) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return {label:"Report time unavailable",old:true};
    const hours = Math.max(0,(Date.now()-ms)/3600000);
    const label = hours < 1 ? "Reported within the last hour" : hours < 24 ? "Reported " + Math.floor(hours) + "h ago" : "Reported " + Math.floor(hours/24) + "d ago";
    return {label, old:hours>24};
  }
  function priceFor(station) {
    const entries = (station.prices || []).filter(p => p.fuel === grade.value && Number.isFinite(+p.centsPerLitre) && +p.centsPerLitre > 0);
    return entries.find(p=>p.payment==="credit") || entries.find(p=>p.payment==="cash") || entries[0] || null;
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI/180, a = (lat2-lat1)*r/2, b=(lon2-lon1)*r/2;
    return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(a)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(b)**2)));
  }
  function stationDistance(s) {
    const la=+s.location?.latitude, lo=+s.location?.longitude;
    return location && Number.isFinite(la) && Number.isFinite(lo) ? distanceKm(location.lat, location.lng, la, lo) : (+s.distanceKm||99);
  }
  function stationKey(s) {return String(s.id || s.location?.latitude + "," + s.location?.longitude);}
  function render() {
    savePrefs();
    if (!data) return;
    const all = Array.isArray(data.stations) ? data.stations : [];
    const near = all.slice().sort((a,b)=>stationDistance(a)-stationDistance(b));
    const priced = near.filter(s=>priceFor(s));
    const pricedSorted = priced.slice().sort((a,b)=>priceFor(a).centsPerLitre-priceFor(b).centsPerLitre);
    const cheapest = pricedSorted[0];
    const nearestPriced = priced.length ? priced[0] : null;
    const amount = Math.max(1,Math.min(100,Number(litres.value)||40));
    const saving = cheapest && nearestPriced ? Math.max(0,(priceFor(nearestPriced).centsPerLitre-priceFor(cheapest).centsPerLitre)*amount/100) : 0;
    const nearestDist = cheapest ? stationDistance(cheapest) : 0;
    summary.hidden = !pricedSorted.length;
    if (pricedSorted.length) {
      summary.innerHTML = "<strong>" + pricedSorted.length + " Shell station" + (pricedSorted.length===1?"":"s") + " with reported " + escapeHtml(grade.options[grade.selectedIndex].text.toLowerCase()) + " prices</strong><span>Lowest reported: " + priceFor(cheapest).centsPerLitre.toFixed(1) + "¢/L · " + nearestDist.toFixed(1) + " km straight-line distance. " + (saving >= .01 ? "Potential saving on "+amount+" L versus the closest priced Shell: $"+saving.toFixed(2)+" (before extra driving)." : "") + "</span>";
    }
    const ordered = [...pricedSorted, ...near.filter(s=>!priceFor(s))].sort((a,b)=>{
      const af=favorites.has(stationKey(a)), bf=favorites.has(stationKey(b));
      return af===bf?0:af?-1:1;
    });
    if (!ordered.length) {list.innerHTML='<div class="fuel-empty">No Shell stations were returned for this area. Try a wider radius or use GasBuddy to check nearby stations.</div>';return;}
    list.innerHTML = ordered.map(s=>{
      const p=priceFor(s), age=p?ageLabel(p.postedAt):null;
      const lat=Number(s.location?.latitude), lng=Number(s.location?.longitude);
      const hasCoords=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>0&&lng<0;
      const route=hasCoords?"https://maps.apple.com/?daddr="+lat+","+lng+"&dirflg=d":"";
      const addr=[s.address?.street,s.address?.city,s.address?.state].filter(Boolean).join(", ");
      const id=stationKey(s);
      return '<article class="fuel-result glass"><div class="fuel-result-top"><div><h3>'+escapeHtml(s.name||"Shell")+'</h3><div class="fuel-addr">'+escapeHtml(addr)+' · '+stationDistance(s).toFixed(1)+' km away (straight line)</div></div><div class="fuel-number">'+(p?p.centsPerLitre.toFixed(1)+"¢":"—")+'<small> / L</small></div></div>'+
        (cheapest && id===stationKey(cheapest)?'<span class="fuel-best">LOWEST REPORTED PRICE</span>':"")+
        '<div class="fuel-reported'+(age?.old?" fuel-warning":"")+'">'+(p?escapeHtml(age.label)+(p.payment==="cash"?" · cash price":" · card price"):"No recent "+escapeHtml(grade.value)+" price reported")+'</div>'+
        '<div class="fuel-result-actions">'+(route?'<a href="'+route+'" target="_blank" rel="noopener">Directions</a>':"")+'<button type="button" data-fuel-fav="'+escapeHtml(id)+'">'+(favorites.has(id)?"★ Saved":"☆ Save")+'</button></div></article>';
    }).join("");
  }
  async function fetchPrices() {
    if (!location || busy) return;
    busy=true;
    byId("fuelLocate").disabled=true;byId("fuelRefresh").disabled=true;
    setStatus("Checking the latest available station reports…");
    const base=String(window.JARVIS_API||"").replace(/\/$/,"");
    if (!base) {setStatus("Jarvis's secure backend is not configured.");busy=false;byId("fuelLocate").disabled=false;byId("fuelRefresh").disabled=false;return;}
    const query=new URLSearchParams({lat:location.lat.toFixed(4),lng:location.lng.toFixed(4),radius:radius.value});
    try {
      const res=await fetch(base+"/fuel?"+query.toString(),{cache:"no-store"});
      const reply=await res.json();
      if (!res.ok) throw Error(reply.error || "Price feed unavailable.");
      data=reply;
      const snapshot=reply.asOf ? "Snapshot " + reply.asOf : "Provider snapshot";
      const fetched=reply.fetchedAt ? new Date(reply.fetchedAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "";
      setStatus(snapshot+" · Fetched "+fetched+(reply.cached?" (cached)":"")+". Prices may be older than the snapshot; check each report time.");
      render();
    } catch (error) {
      setStatus(String(error.message||"Could not retrieve prices.")+" You can still check Shell prices through GasBuddy.");
      if (!data) list.innerHTML='<div class="fuel-empty">Live price lookup not available yet. The GasBuddy link below lets you check reported prices and filter by Shell.</div>';
    } finally {
      busy=false;byId("fuelLocate").disabled=false;byId("fuelRefresh").disabled=false;
    }
  }
  byId("fuelLocate").addEventListener("click",()=>{
    if (!navigator.geolocation){setStatus("Location is unavailable in this browser. Try the Toronto centre option.");return;}
    setStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(pos=>{
      location={lat:pos.coords.latitude,lng:pos.coords.longitude};fetchPrices();
    },()=>setStatus("Location permission was not granted. Try the Toronto centre option or enable location access in iPhone Settings."),{enableHighAccuracy:false,timeout:12000,maximumAge:120000});
  });
  byId("fuelToronto").addEventListener("click",()=>{location={lat:43.6532,lng:-79.3832};setStatus("Searching from central Toronto (not your precise location).");fetchPrices();});
  byId("fuelRefresh").addEventListener("click",()=>{if (location) fetchPrices();else setStatus("Choose your location first.");});
  [grade,litres].forEach(el=>el.addEventListener("change",render));
  radius.addEventListener("change",()=>{savePrefs();if (location)fetchPrices();});
  list.addEventListener("click",event=>{
    const btn=event.target.closest("[data-fuel-fav]");
    if (!btn)return;
    const id=btn.getAttribute("data-fuel-fav");if(favorites.has(id))favorites.delete(id);else favorites.add(id);
    putLocal("jarvis-fuel-favorites-v1",[...favorites]);render();
  });
})();
