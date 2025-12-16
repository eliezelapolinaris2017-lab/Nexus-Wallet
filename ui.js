const UI = (() => {
  const $ = (id) => document.getElementById(id);

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function showMsg(el, text, good=false){
    if(!el) return;
    el.textContent = text || "";
    el.style.color = good ? "rgba(240,210,138,.95)" : "";
  }

  function mapsLink(address){
    const q = encodeURIComponent(address || "");
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function telLink(phone){
    const p = (phone||"").replace(/[^\d+]/g,"");
    return `tel:${p}`;
  }

  function waLink(phone, name){
    const p = (phone||"").replace(/[^\d]/g,"");
    const msg = encodeURIComponent(`Hola ${name||""}, te habla Nexus Wallet (Oasis). `);
    // PR normalmente +1
    return `https://wa.me/1${p}?text=${msg}`;
  }

  function money(n){
    n = Number(n||0);
    return n.toLocaleString("en-US",{style:"currency",currency:"USD"});
  }

  function uid(prefix){
    return `${prefix}_${crypto.randomUUID()}`;
  }

  function monthTitle(d){
    return d.toLocaleString("es-PR",{ month:"long", year:"numeric" });
  }

  function dateISO(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const da = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }

  return { $, esc, showMsg, mapsLink, telLink, waLink, money, uid, monthTitle, dateISO };
})();

