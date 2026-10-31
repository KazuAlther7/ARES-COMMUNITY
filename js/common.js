// Shared: Supabase client, helpers, role icons, team roster modal.
(() => {
  const cfg = window.ARES_CONFIG || {};
  const ok = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE_") && window.supabase;
  const client = ok ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));

  // Ikon role: gambar di assets/roles/
  const ROLES = { "EXP": "exp", "Gold": "gold", "Mid": "mid", "Jungler": "jungler", "Roamer": "roamer" };
  const roleIcon = (role, size = 22) => ROLES[role] ? `<img class="role-ico" src="assets/roles/${ROLES[role]}.png" width="${size}" height="${size}" alt="${esc(role)}">` : "";
  const logo = (t, cls = "") => t?.logo_url
    ? `<span class="team-emblem ${cls}"><img src="${esc(t.logo_url)}" alt=""></span>`
    : `<span class="team-emblem ${cls}">${esc((t?.name || "?").slice(0, 2).toUpperCase())}</span>`;

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
    body.innerHTML = `<div class="roster-head">${logo(team, "xl")}<div><h3>${esc(team.name)}</h3>${team.tag ? `<p class="slogan">“${esc(team.tag)}”</p>` : ""}${team.tournaments?.name ? `<small>${esc(team.tournaments.name)}</small>` : ""}</div></div>
      <div class="eyebrow">STARTING ROSTER</div><ul class="roster">${main.map(row).join("") || '<li class="muted-li">Roster belum diisi.</li>'}</ul>
      ${subs.length ? `<div class="eyebrow" style="margin-top:18px">SUBSTITUTES</div><ul class="roster">${subs.map(row).join("")}</ul>` : ""}`;
  }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-team]");
    if (el && el.dataset.team) { e.preventDefault(); showTeam(el.dataset.team); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelector(".modal-back")?.remove(); });

  async function saveMatchResult(m, s1, s2, whenIso) {
    const B = window.ARES_BRACKET;
    const [{ data: t }, { data: all }] = await Promise.all([
      client.from("tournaments").select("status,format").eq("id", m.tournament_id).single(),
      client.from("matches").select("id,round,position,stage,team1_id,team2_id,score1,score2,status").eq("tournament_id", m.tournament_id)
    ]);
    const live = t?.status === "live" ? "live" : "scheduled";
    if (!B.isKO(m)) { // fase liga / grup
      const bo = m.best_of || 1;
      if (!B.scoreOptions(bo).some(o => o[0] === s1 && o[1] === s2)) throw new Error(`Skor tidak valid untuk Bo${bo}`);
      const done = B.isDone(s1, s2, bo), winner = done && s1 !== s2 ? (s1 > s2 ? m.team1_id : m.team2_id) : null;
      const { error } = await client.from("matches").update({ score1: s1, score2: s2, status: done ? "completed" : live, winner_id: winner, scheduled_at: whenIso ?? m.scheduled_at ?? null }).eq("id", m.id);
      if (error) throw error;
      let final = false;
      if (t?.format === "round_robin") { // juara = pemuncak klasemen setelah semua match selesai
        const rows = all.map(x => x.id === m.id ? { ...x, score1: s1, score2: s2, status: done ? "completed" : live } : x);
        const finished = rows.every(x => x.status === "completed");
        const ids = [...new Set(rows.flatMap(x => [x.team1_id, x.team2_id]))].filter(Boolean).map(id => ({ id }));
        const champ = finished ? B.standings(ids, rows).at(0)?.team.id : null;
        await client.from("tournaments").update({ champion_id: champ || null, ...(finished ? { status: "completed" } : {}) }).eq("id", m.tournament_id);
        final = finished;
      }
      return { winner, final, done, draw: done && !winner };
    }
    const ko = all.filter(B.isKO), maxR = Math.max(...ko.map(x => x.round)), bo = B.bestOf(m.round, maxR), wins = Math.ceil(bo / 2);
    if (s1 > wins || s2 > wins || (s1 === wins && s2 === wins)) throw new Error(`Skor tidak valid untuk Bo${bo}`);
    const done = s1 === wins || s2 === wins;
    const winner = done ? (s1 > s2 ? m.team1_id : m.team2_id) : null;
    const { error } = await client.from("matches").update({ score1: s1, score2: s2, status: done ? "completed" : live, best_of: bo, winner_id: winner, scheduled_at: whenIso ?? m.scheduled_at ?? null }).eq("id", m.id);
    if (error) throw error;
    if (m.round < maxR) {
      const nx = ko.find(x => x.round === m.round + 1 && x.position === Math.ceil(m.position / 2));
      const { error: e2 } = await client.from("matches").update({ [m.position % 2 ? "team1_id" : "team2_id"]: winner }).eq("id", nx.id); if (e2) throw e2;
    } else {
      await client.from("tournaments").update({ champion_id: winner, ...(winner ? { status: "completed" } : {}) }).eq("id", m.tournament_id);
    }
    return { winner, final: m.round === maxR, done };
  }
  // Reset semua skor: bracket (seed babak 1 + BYE) dipertahankan, babak berikutnya dikosongkan.
  async function resetScores(tid) {
    const B = window.ARES_BRACKET;
    const [{ data: t0 }, { data: ms0, error }] = await Promise.all([
      client.from("tournaments").select("status,format").eq("id", tid).single(),
      client.from("matches").select("id,round,position,stage,team1_id,team2_id,is_bye").eq("tournament_id", tid)
    ]);
    if (error) throw error; if (!ms0.length) throw new Error("Belum ada match.");
    let ms = ms0;
    if (t0?.format === "group_playoffs") { // playoff berasal dari klasemen → dihapus, generate ulang setelah grup selesai
      const po = ms.filter(m => m.stage === "playoff");
      if (po.length) await client.from("matches").delete().in("id", po.map(x => x.id));
      ms = ms.filter(m => m.stage !== "playoff");
    }
    const st = ms.map(m => ({ id: m.id, round: m.round, position: m.position, ko: B.isKO(m), is_bye: m.is_bye, team1_id: !B.isKO(m) || m.round === 1 ? m.team1_id : null, team2_id: !B.isKO(m) || m.round === 1 ? m.team2_id : null, winner_id: null, status: "scheduled" }));
    const by = {}; st.filter(m => m.ko).forEach(m => by[m.round + "-" + m.position] = m);
    st.filter(m => m.ko && m.round === 1 && m.is_bye).forEach(m => {
      m.winner_id = m.team1_id; m.status = "completed";
      const nx = by["2-" + Math.ceil(m.position / 2)]; if (nx) nx[m.position % 2 ? "team1_id" : "team2_id"] = m.winner_id;
    });
    const res = await Promise.all(st.map(m => client.from("matches").update({ team1_id: m.team1_id, team2_id: m.team2_id, score1: 0, score2: 0, winner_id: m.winner_id, status: m.status }).eq("id", m.id)));
    const bad = res.find(r => r.error); if (bad) throw bad.error;
    await client.from("tournaments").update({ champion_id: null, ...(t0?.status === "completed" ? { status: "upcoming" } : {}) }).eq("id", tid);
    return st.length;
  }
  const scoreOpts = (m) => {
    const o = window.ARES_BRACKET.scoreOptions(m._bo), cur = [m.score1 || 0, m.score2 || 0];
    if (!o.some(x => x[0] === cur[0] && x[1] === cur[1])) o.push(cur);
    return o.map(([a, b]) => `<option value="${a}-${b}" ${a === cur[0] && b === cur[1] ? "selected" : ""}>${a} : ${b}</option>`).join("");
  };
  window.ARES = { saveMatchResult, resetScores, scoreOpts, annotate: (...a) => window.ARES_BRACKET.annotate(...a), admin: { is: false, on: false }, client, esc, money, ROLES, roleIcon, logo, uploadImage, showTeam };
})();
