(() => {
  const form = document.getElementById("login-form");
  const msg = document.getElementById("login-message");
  const cfg = window.ARES_CONFIG || {};
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!window.supabase || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes("PASTE_")) {
      msg.textContent = "Isi Supabase anon/publishable key terlebih dahulu.";
      return;
    }
    const client = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    msg.textContent = "Signing in...";
    const {data,error} = await client.auth.signInWithPassword({
      email:document.getElementById("email").value.trim(),
      password:document.getElementById("password").value
    });
    if (error) { msg.textContent = error.message; return; }
    const role = data.user?.app_metadata?.role;
    if (role !== "admin") {
      await client.auth.signOut();
      msg.textContent = "Akun ini belum memiliki akses admin.";
      return;
    }
    msg.textContent = "Login berhasil. Dashboard admin akan ditambahkan pada tahap berikutnya.";
  });
})();
