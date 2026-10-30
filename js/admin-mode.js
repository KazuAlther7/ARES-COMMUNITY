// Tombol "Admin Mode": dibuat HANYA jika sesi adalah admin. Hak tulis tetap dijaga RLS di database.
(() => {
  const A = window.ARES; if (!A || !A.client) return;
  const KEY = "ares_admin_mode";
  async function init() {
    const { data: { session } } = await A.client.auth.getSession();
    if (!session) return;
    const { data: ok } = await A.client.rpc("is_admin");
    if (!ok) return;
    A.admin.is = true; A.admin.on = localStorage.getItem(KEY) === "1";
    const link = document.querySelector(".admin-link");
    const btn = document.createElement("button");
    btn.className = "mode-btn"; btn.type = "button";
    const paint = () => { btn.textContent = A.admin.on ? "ADMIN MODE: ON" : "ADMIN MODE: OFF"; btn.classList.toggle("on", A.admin.on); document.body.classList.toggle("admin-on", A.admin.on); };
    btn.onclick = () => { A.admin.on = !A.admin.on; localStorage.setItem(KEY, A.admin.on ? "1" : "0"); paint(); window.dispatchEvent(new Event("ares-admin")); };
    if (link) { const w = document.createElement("div"); w.className = "topbar-right"; link.before(w); w.append(btn, link); link.firstChild.textContent = "CONTROL ROOM "; }
    paint(); window.dispatchEvent(new Event("ares-admin"));
  }
  init();
})();
