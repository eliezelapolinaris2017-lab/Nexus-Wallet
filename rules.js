const Rules = (() => {
  function toNum(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }

  function calcClientStats(clientId, visits){
    const v = visits.filter(x => x.clientId === clientId);
    const totalServicios = v.length;
    const totalGastado = v.reduce((s,a)=> s + toNum(a.price), 0);

    // Recurrente: si un mismo serviceName (o serviceId) aparece >=3 veces (en cualquier rango)
    const freq = new Map();
    for(const it of v){
      const key = (it.serviceId || it.serviceName || "serv").toString();
      freq.set(key, (freq.get(key)||0)+1);
    }
    let recurrente = false;
    for(const c of freq.values()){
      if(c >= 3){ recurrente = true; break; }
    }

    const vipAuto = (totalServicios >= 5) || (totalGastado >= 1000);

    return { totalServicios, totalGastado, vipAuto, recurrente };
  }

  function starsText(n){
    n = Math.max(0, Math.min(5, toNum(n)));
    return n ? "⭐".repeat(n) : "";
  }

  return { calcClientStats, starsText };
})();

