const Security = (() => {
  const PIN_KEY = "pin_hash";

  async function sha256(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  function isValidPin(pin){ return /^\d{4,8}$/.test(pin); }

  async function ensureDefaultPin(){
    const saved = await DB.get("settings", PIN_KEY);
    if(!saved){
      await DB.put("settings", { key: PIN_KEY, value: await sha256("1234") });
    }
  }

  async function verifyPin(pin){
    const rec = await DB.get("settings", PIN_KEY);
    if(!rec?.value) return false;
    return (await sha256(pin)) === rec.value;
  }

  async function changePin(oldPin, newPin){
    if(!isValidPin(newPin)) return { ok:false, msg:"PIN inválido (4–8 dígitos)." };
    if(!(await verifyPin(oldPin))) return { ok:false, msg:"PIN actual incorrecto." };
    await DB.put("settings", { key: PIN_KEY, value: await sha256(newPin) });
    return { ok:true, msg:"PIN actualizado ✅" };
  }

  return { ensureDefaultPin, verifyPin, changePin, isValidPin };
})();

