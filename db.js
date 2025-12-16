const DB = (() => {
  const DB_NAME = "nexus_wallet_db";
  const DB_VER  = 1;
  let _db;

  function open(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        const make = (name, key="id") => {
          if(!db.objectStoreNames.contains(name)){
            db.createObjectStore(name, { keyPath: key });
          }
        };

        make("clients");     // {id, nombre, telefono, direccion, notes, vipStarsManual, createdAt, updatedAt}
        make("visits");      // {id, clientId, serviceId, serviceName, dateISO, price, notes, createdAt, updatedAt}
        make("services");    // {id, name, basePrice, recurrenceDays, active, createdAt, updatedAt}
        make("contracts");   // {id, clientId, type, dateISO, status, notes, createdAt, updatedAt}
        make("agenda");      // {id: "YYYY-MM-DD", note, updatedAt}
        make("settings", "key"); // {key, value}

        // indexes útiles (solo para clients/visits)
        if(db.objectStoreNames.contains("clients")){
          const s = req.transaction?.objectStore("clients");
          if(s && !s.indexNames.contains("nombre")) s.createIndex("nombre","nombre",{unique:false});
          if(s && !s.indexNames.contains("telefono")) s.createIndex("telefono","telefono",{unique:false});
        }
        if(db.objectStoreNames.contains("visits")){
          const v = req.transaction?.objectStore("visits");
          if(v && !v.indexNames.contains("clientId")) v.createIndex("clientId","clientId",{unique:false});
          if(v && !v.indexNames.contains("dateISO")) v.createIndex("dateISO","dateISO",{unique:false});
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(true); };
      req.onerror = () => reject(req.error);
    });
  }

  function store(name, mode="readonly"){ return _db.transaction(name, mode).objectStore(name); }

  function get(name, key){
    return new Promise((resolve, reject) => {
      const r = store(name).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  }

  function put(name, val){
    return new Promise((resolve, reject) => {
      const r = store(name, "readwrite").put(val);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  function del(name, key){
    return new Promise((resolve, reject) => {
      const r = store(name, "readwrite").delete(key);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  function getAll(name){
    return new Promise((resolve, reject) => {
      const r = store(name).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async function clearAll(){
    await new Promise((resolve, reject) => {
      const t = _db.transaction(["clients","visits","services","contracts","agenda","settings"], "readwrite");
      ["clients","visits","services","contracts","agenda","settings"].forEach(n => t.objectStore(n).clear());
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  return { open, get, put, del, getAll, clearAll };
})();

