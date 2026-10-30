// Shared: Supabase client, helpers, role icons, team roster modal.
(() => {
  const cfg = window.ARES_CONFIG || {};
  const ok = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE_") && window.supabase;
  const client = ok ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));

  // Ikon role (SVG garis, gaya sendiri). Ganti dengan PNG resmi di assets/roles/ bila mau.
  const ROLES = {
    "EXP":     { color: "#e8793a", d: "M4 20L18 6l2-2M7 13l4 4M3 21l3-3" },
    "Gold":    { color: "#f2c94c", d: "M12 4a8 8 0 100 16 8 8 0 000-16zM9 12h6M12 9v6" },
    "Mid":     { color: "#6aa7ff", d: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" },
    "Jungler": { color: "#5fd08a", d: "M5 4c6 2 11 7 14 16M9 4c5 2 8 6 10 12M13 4c3 1.5 5 4 6 8" },
    "Roamer":  { color: "#b784f2", d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" }
  };
  const roleIcon = (role, size = 22) => {
    const r = ROLES[role]; if (!r) return "";
    return `<svg class="role-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${r.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${r.d}"/></svg>`;
  };
  const logo = (t, cls = "") => t?.logo_url
    ? `<span class="team-emblem ${cls}"><img src="${esc(t.logo_url)}" alt=""></span>`
    : `<span class="team-emblem ${cls}">${esc((t?.tag || t?.name || "?").slice(0, 2).toUpperCase())}</span>`;

  // Kecilkan gambar besar (foto HP) sebelum upload agar cepat.
  async function shrink(file, max = 1400) {
    try {
      if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size < 300000) return file;
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise(r => cv.toBlob(r, "image/webp", 0.88));
      return blob && blob.type === "image/webp" ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" }) : file;
    } catch { return file; }
  }
  async function uploadImage(file, folder) {
    if (!file) return null;
    file = await shrink(file);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await client.storage.from("ares-media").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return client.storage.from("ares-media").getPublicUrl(path).data.publicUrl;
  }

  async function showTeam(id) {
    if (!client || !id) return;
    document.querySelector(".modal-back")?.remove();
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal"><button class="modal-x" aria-label="Close">×</button><div class="modal-body"><div class="empty-state">Loading roster<span class="loader"></span></div></div></div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener("click", e => { if (e.target === back) close(); });
    back.querySelector(".modal-x").onclick = close;
    const [{ data: team }, { data: players }] = await Promise.all([
      client.from("teams").select("id,name,tag,logo_url,tournaments(name)").eq("id", id).single(),
      client.from("players").select("*").eq("team_id", id).order("sort_order")
    ]);
    const body = back.querySelector(".modal-body");
    if (!team) { body.innerHTML = '<div class="empty-state">Tim tidak ditemukan.</div>'; return; }
    const row = (p) => `<li class="player"><span class="player-role">${roleIcon(p.role, 26)}<small>${esc(p.role || "—")}</small></span><div><strong>${esc(p.nickname)}</strong>${p.is_captain ? '<em class="cap">CAPTAIN</em>' : ""}</div></li>`;
    const main = (players || []).filter(p => !p.is_sub), subs = (players || []).filter(p => p.is_sub);
    body.innerHTML = `<div class="roster-head">${logo(team, "xl")}<div><div class="eyebrow">${esc(team.tag || "TEAM")}</div><h3>${esc(team.name)}</h3>${team.tournaments?.name ? `<small>${esc(team.tournaments.name)}</small>` : ""}</div></div>
      <div class="eyebrow">STARTING ROSTER</div><ul class="roster">${main.map(row).join("") || '<li class="muted-li">Roster belum diisi.</li>'}</ul>
      ${subs.length ? `<div class="eyebrow" style="margin-top:18px">SUBSTITUTES</div><ul class="roster">${subs.map(row).join("")}</ul>` : ""}`;
  }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-team]");
    if (el && el.dataset.team) { e.preventDefault(); showTeam(el.dataset.team); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelector(".modal-back")?.remove(); });

  async function saveMatchResult(m, s1, s2, status, whenIso) {
    let winner = null;
    if (status === "completed") { if (s1 === s2) throw new Error("Skor seri — tentukan pemenang dulu."); winner = s1 > s2 ? m.team1_id : m.team2_id; }
    const { error } = await client.from("matches").update({ score1: s1, score2: s2, status, winner_id: winner, scheduled_at: whenIso ?? m.scheduled_at ?? null }).eq("id", m.id);
    if (error) throw error;
    const { data: all } = await client.from("matches").select("id,round,position").eq("tournament_id", m.tournament_id);
    const maxR = Math.max(...all.map(x => x.round));
    if (m.round < maxR) {
      const nx = all.find(x => x.round === m.round + 1 && x.position === Math.ceil(m.position / 2));
      const { error: e2 } = await client.from("matches").update({ [m.position % 2 ? "team1_id" : "team2_id"]: winner }).eq("id", nx.id); if (e2) throw e2;
    } else {
      await client.from("tournaments").update({ champion_id: winner, ...(winner ? { status: "completed" } : {}) }).eq("id", m.tournament_id);
    }
    return { winner, final: m.round === maxR };
  }
  window.ARES = { saveMatchResult, admin: { is: false, on: false }, client, esc, money, ROLES, roleIcon, logo, uploadImage, showTeam };
})();
