const S = {
  unlocked:false,
  tab:"Clientes",
  clients:[],
  visits:[],
  services:[],
  contracts:[]
};

async function boot(){
  await DB.open();
  await Security.ensureDefaultPin();
  registerSW();
  wireNav();
  wireLock();
  wireGlobalButtons();
  wireConfig();
  wireSearches();

  await seedDefaultsIfEmpty();
  await reloadAll();
  renderAll();
}

function registerSW(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}

/* ------------------ SEED ------------------ */
async function seedDefaultsIfEmpty(){
  const services = await DB.getAll("services");
  if(services.length === 0){
    const now = Date.now();
    const defaults = [
      { id:UI.uid("srv"), name:"Mantenimiento Preventivo", basePrice:120, recurrenceDays:180, active:true, createdAt:now, updatedAt:now },
      { id:UI.uid("srv"), name:"Instalación Básica", basePrice:650, recurrenceDays:0, active:true, createdAt:now, updatedAt:now },
      { id:UI.uid("srv"), name:"Diagnóstico Técnico", basePrice:65, recurrenceDays:0, active:true, createdAt:now, updatedAt:now },
    ];
    for(const s of defaults) await DB.put("services", s);
  }
}

/* ------------------ LOAD ------------------ */
async function reloadAll(){
  S.clients = await DB.getAll("clients");
  S.visits = await DB.getAll("visits");
  S.services = await DB.getAll("services");
  S.contracts = await DB.getAll("contracts");

  S.clients.sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));
  S.visits.sort((a,b)=> (b.dateISO||"").localeCompare(a.dateISO||""));
  S.services.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
  S.contracts.sort((a,b)=> (b.dateISO||"").localeCompare(a.dateISO||""));
}

/* ------------------ NAV ------------------ */
function wireNav(){
  document.querySelectorAll(".navBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setTab(btn.dataset.tab);
    });
  });
}

function setTab(name){
  S.tab = name;
  document.querySelectorAll(".navBtn").forEach(b=>b.classList.toggle("active", b.dataset.tab===name));
  document.querySelectorAll(".tab").forEach(s=>s.classList.remove("active"));
  const el = UI.$("tab"+name);
  if(el) el.classList.add("active");

  UI.$("topSub").textContent =
    name==="Clientes" ? "Clientes • Offline" :
    name==="Visitas" ? "Visitas realizadas • Servicios • $":
    name==="Servicios" ? "Catálogo de servicios" :
    name==="Vip" ? "VIP & Recurrentes" :
    name==="Telefonos" ? "Lista de teléfono" :
    name==="Contratos" ? "Contratos" :
    "Seguridad y respaldo";

  UI.$("btnQuickAdd").textContent =
    name==="Clientes" ? "+ Cliente" :
    name==="Visitas" ? "+ Visita" :
    name==="Servicios" ? "+ Servicio" :
    name==="Contratos" ? "+ Contrato" :
    "+ Añadir";

  if(name==="Telefonos") renderPhones();
  if(name==="Vip") renderVip();
}

/* ------------------ LOCK ------------------ */
function wireLock(){
  UI.$("btnUnlock").addEventListener("click", unlock);
  UI.$("pinInput").addEventListener("keydown", (e)=>{ if(e.key==="Enter") unlock(); });
}

async function unlock(){
  const pin = UI.$("pinInput").value.trim();
  const ok = await Security.verifyPin(pin);
  if(!ok){ UI.showMsg(UI.$("lockMsg"), "PIN incorrecto."); return; }
  S.unlocked = true;
  UI.$("lock").classList.add("hidden");
}

/* ------------------ GLOBAL BUTTONS ------------------ */
function wireGlobalButtons(){
  UI.$("btnQuickAdd").addEventListener("click", ()=>{
    if(S.tab==="Clientes") openClientModal(null);
    else if(S.tab==="Visitas") openVisitModal(null);
    else if(S.tab==="Servicios") openServiceModal(null);
    else if(S.tab==="Contratos") openContractModal(null);
  });

  UI.$("btnCloseModal").addEventListener("click", closeModal);

  UI.$("btnNewVisit").addEventListener("click", ()=>openVisitModal(null));
  UI.$("btnNewService").addEventListener("click", ()=>openServiceModal(null));
  UI.$("btnNewContract").addEventListener("click", ()=>openContractModal(null));

  UI.$("vipMode").addEventListener("change", renderVip);
}

/* ------------------ SEARCH WIRES ------------------ */
function wireSearches(){
  UI.$("qClients").addEventListener("input", renderClients);
  UI.$("filterClients").addEventListener("change", renderClients);

  UI.$("qVisits").addEventListener("input", renderVisits);
  UI.$("qServices").addEventListener("input", renderServices);
  UI.$("qContracts").addEventListener("input", renderContracts);
  UI.$("qPhones").addEventListener("input", renderPhones);
}

/* ------------------ RENDER ALL ------------------ */
function renderAll(){
  renderClients();
  renderVisits();
  renderServices();
  renderContracts();
  renderVip();
  renderPhones();
}

/* ------------------ HELPERS ------------------ */
function clientStats(clientId){
  return Rules.calcClientStats(clientId, S.visits);
}
function findClient(id){ return S.clients.find(c=>c.id===id) || null; }
function findService(id){ return S.services.find(s=>s.id===id) || null; }
function matchText(obj, q){
  if(!q) return true;
  q = q.toLowerCase();
  return (obj||"").toLowerCase().includes(q);
}

/* ------------------ CLIENTES ------------------ */
function renderClients(){
  const q = UI.$("qClients").value.trim().toLowerCase();
  const filter = UI.$("filterClients").value;
  const wrap = UI.$("clientsList");

  let list = S.clients.filter(c=>{
    const okQ =
      matchText(c.nombre,q) ||
      matchText(c.telefono,q) ||
      matchText(c.direccion,q);
    if(!okQ) return false;

    const st = clientStats(c.id);
    const vipManual = Number(c.vipStarsManual||0) > 0;
    const isVip = st.vipAuto || vipManual;
    const isRec = st.recurrente;

    if(filter==="vip") return isVip;
    if(filter==="recurrente") return isRec;
    return true;
  });

  if(list.length===0){
    wrap.innerHTML = `<div class="item"><div class="muted">No hay clientes todavía.</div></div>`;
    return;
  }

  wrap.innerHTML = list.map(c=>{
    const st = clientStats(c.id);
    const vipManual = Number(c.vipStarsManual||0);
    const vipAuto = st.vipAuto;
    const isVip = vipAuto || vipManual>0;
    const isRec = st.recurrente;

    const badges = [];
    if(isVip) badges.push(`<span class="badge gold">VIP ${Rules.starsText(vipManual) || "⭐"}</span>`);
    if(isRec) badges.push(`<span class="badge blue">Recurrente 🔁</span>`);
    badges.push(`<span class="badge">Servicios: <b>${st.totalServicios}</b></span>`);
    badges.push(`<span class="badge">Total: <b>${UI.money(st.totalGastado)}</b></span>`);

    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemName">${UI.esc(c.nombre||"(Sin nombre)")}</div>
            <div class="itemMeta">${UI.esc(c.telefono||"")} ${c.telefono? "•": ""} ${UI.esc(c.direccion||"")}</div>
            <div class="badges">${badges.join("")}</div>
          </div>
          <button class="btn small" data-edit-client="${c.id}">Editar</button>
        </div>

        <div class="itemActions">
          <a class="btn small" href="${UI.telLink(c.telefono||"")}">Llamar</a>
          <a class="btn small" href="${UI.waLink(c.telefono||"", c.nombre||"")}" target="_blank" rel="noreferrer">WhatsApp</a>
          <a class="btn small" href="${UI.mapsLink(c.direccion||"")}" target="_blank" rel="noreferrer">Mapa</a>
          <button class="btn small" data-add-visit="${c.id}">+ Visita</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-edit-client]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const id = b.getAttribute("data-edit-client");
      openClientModal(findClient(id));
    });
  });
  wrap.querySelectorAll("[data-add-visit]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const clientId = b.getAttribute("data-add-visit");
      openVisitModal({ presetClientId: clientId });
    });
  });
}

function openClientModal(client){
  const editing = !!client;
  const c = client || {
    id: UI.uid("cli"),
    nombre:"", telefono:"", direccion:"",
    notes:"", vipStarsManual:0,
    createdAt: Date.now(), updatedAt: Date.now()
  };

  UI.$("modalTitle").textContent = editing ? "Editar cliente" : "Nuevo cliente";
  UI.$("modalBody").innerHTML = `
    <div class="row"><input id="mNombre" class="input" placeholder="Nombre" value="${UI.esc(c.nombre)}"></div>
    <div class="row"><input id="mTelefono" class="input" inputmode="tel" placeholder="Teléfono" value="${UI.esc(c.telefono)}"></div>
    <div class="row"><input id="mDireccion" class="input" placeholder="Dirección" value="${UI.esc(c.direccion)}"></div>
    <div class="row gap">
      <select id="mStars" class="select">
        ${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${Number(c.vipStarsManual||0)===n?"selected":""}>${n===0?"Sin ⭐ manual":("⭐".repeat(n)+" ("+n+")")}</option>`).join("")}
      </select>
      <button id="mMap" class="btn">Mapa</button>
    </div>
    <div class="row">
      <textarea id="mNotes" class="textarea" rows="3" placeholder="Notas...">${UI.esc(c.notes||"")}</textarea>
    </div>

    <div class="row gap right">
      ${editing ? `<button id="mDel" class="btn dangerBtn">Eliminar</button>` : ""}
      <button id="mSave" class="btn primary">Guardar</button>
    </div>
  `;

  UI.$("modal").classList.remove("hidden");
  UI.showMsg(UI.$("modalMsg"), "");

  UI.$("mMap").addEventListener("click", ()=>{
    const addr = UI.$("mDireccion").value.trim();
    if(addr) window.open(UI.mapsLink(addr), "_blank");
  });

  UI.$("mSave").addEventListener("click", async ()=>{
    const nombre = UI.$("mNombre").value.trim();
    if(!nombre){ UI.showMsg(UI.$("modalMsg"), "Escribe el nombre."); return; }

    c.nombre = nombre;
    c.telefono = UI.$("mTelefono").value.trim();
    c.direccion = UI.$("mDireccion").value.trim();
    c.vipStarsManual = Number(UI.$("mStars").value||0);
    c.notes = UI.$("mNotes").value.trim();
    c.updatedAt = Date.now();

    await DB.put("clients", c);
    await reloadAll();
    renderAll();
    closeModal();
  });

  if(editing){
    UI.$("mDel").addEventListener("click", async ()=>{
      if(!confirm("¿Eliminar este cliente?")) return;

      const visits = (await DB.getAll("visits")).filter(v=>v.clientId===c.id);
      for(const v of visits) await DB.del("visits", v.id);

      const contracts = (await DB.getAll("contracts")).filter(k=>k.clientId===c.id);
      for(const k of contracts) await DB.del("contracts", k.id);

      await DB.del("clients", c.id);
      await reloadAll();
      renderAll();
      closeModal();
    });
  }
}

/* ------------------ VISITAS ------------------ */
function renderVisits(){
  const q = UI.$("qVisits").value.trim().toLowerCase();
  const wrap = UI.$("visitsList");

  let list = S.visits.filter(v=>{
    const client = findClient(v.clientId);
    const hay = [
      client?.nombre||"",
      v.serviceName||"",
      v.dateISO||"",
      String(v.price||""),
      v.notes||""
    ].join(" ").toLowerCase();
    return !q || hay.includes(q);
  });

  if(list.length===0){
    wrap.innerHTML = `<div class="item"><div class="muted">No hay visitas registradas.</div></div>`;
    return;
  }

  wrap.innerHTML = list.map(v=>{
    const c = findClient(v.clientId);
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemName">${UI.esc(c?.nombre || "Cliente")}</div>
            <div class="itemMeta">${UI.esc(v.dateISO)} • ${UI.esc(v.serviceName||"Servicio")} • <b>${UI.money(v.price)}</b></div>
            ${v.notes? `<div class="tiny muted" style="margin-top:6px">${UI.esc(v.notes)}</div>`:""}
          </div>
          <button class="btn small" data-edit-visit="${v.id}">Editar</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-edit-visit]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const id = b.getAttribute("data-edit-visit");
      const visit = S.visits.find(x=>x.id===id);
      openVisitModal(visit);
    });
  });
}

function openVisitModal(visit){
  const editing = !!visit && !visit.presetClientId;
  const nowISO = UI.dateISO(new Date());

  const v = editing ? { ...visit } : {
    id: UI.uid("vis"),
    clientId: visit?.presetClientId || (S.clients[0]?.id || ""),
    serviceId: S.services[0]?.id || "",
    serviceName: "",
    dateISO: nowISO,
    price: 0,
    notes:"",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  UI.$("modalTitle").textContent = editing ? "Editar visita" : "Nueva visita";
  UI.$("modalBody").innerHTML = `
    <div class="row">
      <select id="vClient" class="select">
        ${S.clients.map(c=>`<option value="${c.id}" ${c.id===v.clientId?"selected":""}>${UI.esc(c.nombre)}</option>`).join("")}
      </select>
    </div>

    <div class="row">
      <select id="vService" class="select">
        ${S.services.filter(s=>s.active!==false).map(s=>`<option value="${s.id}" ${s.id===v.serviceId?"selected":""}>${UI.esc(s.name)}</option>`).join("")}
      </select>
    </div>

    <div class="row gap">
      <input id="vDate" class="input" type="date" value="${UI.esc(v.dateISO)}" />
      <input id="vPrice" class="input" inputmode="decimal" placeholder="Precio" value="${UI.esc(String(v.price||0))}" />
    </div>

    <div class="row">
      <textarea id="vNotes" class="textarea" rows="3" placeholder="Notas...">${UI.esc(v.notes||"")}</textarea>
    </div>

    <div class="row gap right">
      ${editing ? `<button id="vDel" class="btn dangerBtn">Eliminar</button>` : ""}
      <button id="vSave" class="btn primary">Guardar</button>
    </div>
  `;

  UI.$("modal").classList.remove("hidden");
  UI.showMsg(UI.$("modalMsg"), "");

  const refreshPrice = () => {
    const srv = findService(UI.$("vService").value);
    if(!editing && srv){
      UI.$("vPrice").value = String(srv.basePrice ?? 0);
    }
  };
  refreshPrice();
  UI.$("vService").addEventListener("change", refreshPrice);

  UI.$("vSave").addEventListener("click", async ()=>{
    if(S.clients.length===0){ UI.showMsg(UI.$("modalMsg"), "Crea un cliente primero."); return; }

    v.clientId = UI.$("vClient").value;
    v.serviceId = UI.$("vService").value;

    const srv = findService(v.serviceId);
    v.serviceName = srv?.name || "Servicio";

    v.dateISO = UI.$("vDate").value || nowISO;
    v.price = Number(UI.$("vPrice").value||0) || 0;
    v.notes = UI.$("vNotes").value.trim();
    v.updatedAt = Date.now();

    await DB.put("visits", v);

    await reloadAll();
    renderAll();
    closeModal();
  });

  if(editing){
    UI.$("vDel").addEventListener("click", async ()=>{
      if(!confirm("¿Eliminar esta visita?")) return;
      await DB.del("visits", v.id);
      await reloadAll();
      renderAll();
      closeModal();
    });
  }
}

/* ------------------ SERVICIOS ------------------ */
function renderServices(){
  const q = UI.$("qServices").value.trim().toLowerCase();
  const wrap = UI.$("servicesList");

  let list = S.services.filter(s => !q || (s.name||"").toLowerCase().includes(q));

  if(list.length===0){
    wrap.innerHTML = `<div class="item"><div class="muted">No hay servicios.</div></div>`;
    return;
  }

  wrap.innerHTML = list.map(s=>`
    <div class="item">
      <div class="itemTop">
        <div>
          <div class="itemName">${UI.esc(s.name)}</div>
          <div class="itemMeta">Precio base: <b>${UI.money(s.basePrice||0)}</b> ${s.recurrenceDays? `• Recurrencia: ${s.recurrenceDays} días`:""}</div>
          <div class="badges">
            <span class="badge ${s.active===false?"":"gold"}">${s.active===false?"Inactivo":"Activo"}</span>
          </div>
        </div>
        <button class="btn small" data-edit-service="${s.id}">Editar</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-edit-service]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const id = b.getAttribute("data-edit-service");
      openServiceModal(findService(id));
    });
  });
}

function openServiceModal(service){
  const editing = !!service;
  const s = editing ? { ...service } : {
    id: UI.uid("srv"),
    name:"",
    basePrice:0,
    recurrenceDays:0,
    active:true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  UI.$("modalTitle").textContent = editing ? "Editar servicio" : "Nuevo servicio";
  UI.$("modalBody").innerHTML = `
    <div class="row"><input id="sName" class="input" placeholder="Nombre del servicio" value="${UI.esc(s.name)}"></div>
    <div class="row gap">
      <input id="sPrice" class="input" inputmode="decimal" placeholder="Precio base" value="${UI.esc(String(s.basePrice||0))}">
      <input id="sRec" class="input" inputmode="numeric" placeholder="Recurrencia (días) opcional" value="${UI.esc(String(s.recurrenceDays||0))}">
    </div>
    <div class="row gap">
      <select id="sActive" class="select">
        <option value="1" ${s.active!==false?"selected":""}>Activo</option>
        <option value="0" ${s.active===false?"selected":""}>Inactivo</option>
      </select>
    </div>

    <div class="row gap right">
      ${editing ? `<button id="sDel" class="btn dangerBtn">Eliminar</button>` : ""}
      <button id="sSave" class="btn primary">Guardar</button>
    </div>
  `;

  UI.$("modal").classList.remove("hidden");
  UI.showMsg(UI.$("modalMsg"), "");

  UI.$("sSave").addEventListener("click", async ()=>{
    const name = UI.$("sName").value.trim();
    if(!name){ UI.showMsg(UI.$("modalMsg"), "Escribe el nombre del servicio."); return; }
    s.name = name;
    s.basePrice = Number(UI.$("sPrice").value||0) || 0;
    s.recurrenceDays = Number(UI.$("sRec").value||0) || 0;
    s.active = UI.$("sActive").value === "1";
    s.updatedAt = Date.now();

    await DB.put("services", s);
    await reloadAll();
    renderAll();
    closeModal();
  });

  if(editing){
    UI.$("sDel").addEventListener("click", async ()=>{
      if(!confirm("¿Eliminar este servicio? (no borra visitas pasadas)")) return;
      await DB.del("services", s.id);
      await reloadAll();
      renderAll();
      closeModal();
    });
  }
}

/* ------------------ VIP ------------------ */
function renderVip(){
  const mode = UI.$("vipMode").value;
  const wrap = UI.$("vipList");

  const enriched = S.clients.map(c=>{
    const st = clientStats(c.id);
    const vipManual = Number(c.vipStarsManual||0);
    const isVip = st.vipAuto || vipManual>0;
    return { c, st, vipManual, isVip };
  });

  let list = [];
  if(mode==="vip"){
    list = enriched.filter(x=>x.isVip)
      .sort((a,b)=> (b.vipManual - a.vipManual) || (b.st.totalGastado - a.st.totalGastado));
  }else if(mode==="recurrente"){
    list = enriched.filter(x=>x.st.recurrente)
      .sort((a,b)=> (b.st.totalServicios - a.st.totalServicios));
  }else{
    list = enriched.slice().sort((a,b)=> (b.st.totalGastado - a.st.totalGastado)).slice(0, 50);
  }

  if(list.length===0){
    wrap.innerHTML = `<div class="item"><div class="muted">No hay datos todavía.</div></div>`;
    return;
  }

  wrap.innerHTML = list.map(x=>{
    const badges = [];
    if(x.isVip) badges.push(`<span class="badge gold">VIP ${Rules.starsText(x.vipManual) || "⭐"}</span>`);
    if(x.st.recurrente) badges.push(`<span class="badge blue">Recurrente 🔁</span>`);
    badges.push(`<span class="badge">Servicios: <b>${x.st.totalServicios}</b></span>`);
    badges.push(`<span class="badge">Total: <b>${UI.money(x.st.totalGastado)}</b></span>`);
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemName">${UI.esc(x.c.nombre)}</div>
            <div class="itemMeta">${UI.esc(x.c.telefono||"")} ${x.c.telefono?"•":""} ${UI.esc(x.c.direccion||"")}</div>
            <div class="badges">${badges.join("")}</div>
          </div>
          <button class="btn small" data-edit-client="${x.c.id}">Editar</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-edit-client]").forEach(b=>{
    b.addEventListener("click", ()=>{
      openClientModal(findClient(b.getAttribute("data-edit-client")));
    });
  });
}

/* ------------------ CONTRATOS ------------------ */
function renderContracts(){
  const q = UI.$("qContracts").value.trim().toLowerCase();
  const wrap = UI.$("contractsList");

  let list = S.contracts.filter(k=>{
    const c = findClient(k.clientId);
    const hay = `${c?.nombre||""} ${k.type||""} ${k.status||""} ${k.dateISO||""} ${k.notes||""}`.toLowerCase();
    return !q || hay.includes(q);
  });

  if(list.length===0){
    wrap.innerHTML = `<div class="item"><div class="muted">No hay contratos.</div></div>`;
    return;
  }

  wrap.innerHTML = list.map(k=>{
    const c = findClient(k.clientId);
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemName">${UI.esc(c?.nombre||"Cliente")}</div>
            <div class="itemMeta">${UI.esc(k.dateISO||"")} • ${UI.esc(k.type||"Contrato")} • <b>${UI.esc(k.status||"Pendiente")}</b></div>
            ${k.notes? `<div class="tiny muted" style="margin-top:6px">${UI.esc(k.notes)}</div>`:""}
          </div>
          <button class="btn small" data-edit-contract="${k.id}">Editar</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-edit-contract]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const id = b.getAttribute("data-edit-contract");
      const k = S.contracts.find(x=>x.id===id);
      openContractModal(k);
    });
  });
}

function openContractModal(contract){
  const editing = !!contract;
  const nowISO = UI.dateISO(new Date());
  const k = editing ? { ...contract } : {
    id: UI.uid("con"),
    clientId: S.clients[0]?.id || "",
    type:"Servicio",
    dateISO: nowISO,
    status:"Pendiente",
    notes:"",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  UI.$("modalTitle").textContent = editing ? "Editar contrato" : "Nuevo contrato";
  UI.$("modalBody").innerHTML = `
    <div class="row">
      <select id="kClient" class="select">
        ${S.clients.map(c=>`<option value="${c.id}" ${c.id===k.clientId?"selected":""}>${UI.esc(c.nombre)}</option>`).join("")}
      </select>
    </div>
    <div class="row gap">
      <input id="kType" class="input" placeholder="Tipo (ej. Mantenimiento / Instalación)" value="${UI.esc(k.type||"")}">
      <input id="kDate" class="input" type="date" value="${UI.esc(k.dateISO||nowISO)}">
    </div>
    <div class="row">
      <select id="kStatus" class="select">
        ${["Pendiente","Activo","Cerrado","Cancelado"].map(s=>`<option ${k.status===s?"selected":""}>${s}</option>`).join("")}
      </select>
    </div>
    <div class="row">
      <textarea id="kNotes" class="textarea" rows="3" placeholder="Notas...">${UI.esc(k.notes||"")}</textarea>
    </div>
    <div class="row gap right">
      ${editing ? `<button id="kDel" class="btn dangerBtn">Eliminar</button>` : ""}
      <button id="kSave" class="btn primary">Guardar</button>
    </div>
  `;

  UI.$("modal").classList.remove("hidden");
  UI.showMsg(UI.$("modalMsg"), "");

  UI.$("kSave").addEventListener("click", async ()=>{
    if(S.clients.length===0){ UI.showMsg(UI.$("modalMsg"), "Crea un cliente primero."); return; }
    k.clientId = UI.$("kClient").value;
    k.type = UI.$("kType").value.trim() || "Servicio";
    k.dateISO = UI.$("kDate").value || nowISO;
    k.status = UI.$("kStatus").value;
    k.notes = UI.$("kNotes").value.trim();
    k.updatedAt = Date.now();

    await DB.put("contracts", k);
    await reloadAll();
    renderAll();
    closeModal();
  });

  if(editing){
    UI.$("kDel").addEventListener("click", async ()=>{
      if(!confirm("¿Eliminar este contrato?")) return;
      await DB.del("contracts", k.id);
      await reloadAll();
      renderAll();
      closeModal();
    });
  }
}

/* ------------------ TELEFONOS ------------------ */
function renderPhones(){
  const q = UI.$("qPhones").value.trim().toLowerCase();
  const wrap = UI.$("phonesList");

  let list = S.clients.filter(c=>{
    const hay = `${c.nombre||""} ${c.telefono||""}`.toLowerCase();
    return !q || hay.includes(q);
  });

  if(list.length===0){
    wrap.innerHTML = `<div class="item"><div class="muted">No hay teléfonos.</div></div>`;
    return;
  }

  wrap.innerHTML = list.map(c=>`
    <div class="item">
      <div class="itemTop">
        <div>
          <div class="itemName">${UI.esc(c.nombre||"")}</div>
          <div class="itemMeta">${UI.esc(c.telefono||"")}</div>
        </div>
        <a class="btn small" href="${UI.telLink(c.telefono||"")}">Llamar</a>
      </div>
    </div>
  `).join("");
}

/* ------------------ MODAL ------------------ */
function closeModal(){
  UI.$("modal").classList.add("hidden");
  UI.$("modalBody").innerHTML = "";
  UI.showMsg(UI.$("modalMsg"), "");
}

/* ------------------ CONFIG ------------------ */
function wireConfig(){
  UI.$("btnChangePin").addEventListener("click", async ()=>{
    const oldPin = UI.$("pinOld").value.trim();
    const newPin = UI.$("pinNew").value.trim();
    const res = await Security.changePin(oldPin, newPin);
    UI.showMsg(UI.$("cfgMsg"), res.msg, res.ok);
    if(res.ok){ UI.$("pinOld").value=""; UI.$("pinNew").value=""; }
  });

  UI.$("btnExport").addEventListener("click", async ()=>{
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clients: await DB.getAll("clients"),
      visits: await DB.getAll("visits"),
      services: await DB.getAll("services"),
      contracts: await DB.getAll("contracts")
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus_wallet_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  UI.$("importFile").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const data = JSON.parse(await file.text());
      const putAll = async (name, arr) => {
        if(!Array.isArray(arr)) return;
        for(const it of arr){
          if(it && (it.id || it.key)){
            await DB.put(name, it);
          }
        }
      };
      await putAll("clients", data.clients);
      await putAll("visits", data.visits);
      await putAll("services", data.services);
      await putAll("contracts", data.contracts);

      await reloadAll();
      renderAll();
      alert("Importado ✅");
    }catch(err){
      alert("No se pudo importar: " + err.message);
    }finally{
      e.target.value = "";
    }
  });

  UI.$("btnWipe").addEventListener("click", async ()=>{
    const pin = UI.$("wipePin").value.trim();
    if(!(await Security.verifyPin(pin))){
      UI.showMsg(UI.$("wipeMsg"), "PIN incorrecto.");
      return;
    }
    if(!confirm("¿Seguro que deseas borrar TODO?")) return;

    await DB.clearAll();
    await Security.ensureDefaultPin();
    await seedDefaultsIfEmpty();
    await reloadAll();
    renderAll();

    UI.$("wipePin").value="";
    UI.showMsg(UI.$("wipeMsg"), "Listo ✅ (PIN volvió a 1234)", true);
  });
}

boot();
