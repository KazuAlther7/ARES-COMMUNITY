(() => {
  const { client: sb, esc, uploadImage } = window.ARES;
  const $ = (id) => document.getElementById(id);
  const ROLE_LIST = ["EXP", "Gold", "Mid", "Jungler", "Roamer"];
  const FORMATS = { single_elimination: "Single Elimination", double_elimination: "Double Elimination (bracket otomatis belum tersedia)", round_robin: "Round Robin (bracket otomatis belum tersedia)", group_playoffs: "Group Stage + Playoffs (bracket otomatis belum tersedia)" };
  let tab = "tournaments", tournaments = [], selT = "";

  const toast = (m, bad) => { const t = $("toast"); t.textContent = m; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 3500); };
  const opts = (arr, sel, blank) => (blank ? `<option value="">${blank}</option>` : "") + arr.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
  const tOpts = (sel, blank) => opts(tournaments.map(t => [t.id, t.name]), sel, blank);
  const dtLocal = (s) => { if (!s) return ""; const d = new Date(s); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocal = (s) => s ? new Date(s).toISOString() : null;
  const run = async (fn) => { try { await fn(); } catch (e) { console.error(e); toast(e.message || String(e), true); } };

  if (!sb) { $("login-view").hidden = false; $("login-message").textContent = "Supabase belum dikonfigurasi (js/config.js)."; return; }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: ok } = await sb.rpc("is_admin");
    if (!ok) { await sb.auth.signOut(); showLogin("Akun ini belum memiliki akses admin."); return; }
    $("login-view").hidden = true; $("dash-view").hidden = false; render();
  }
  function showLogin(msg) { $("dash-view").hidden = true; $("login-view").hidden = false; $("login-message").textContent = msg || ""; }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault(); $("login-message").textContent = "Signing in...";
    const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) { $("login-message").textContent = error.message; return; }
    init();
  });
  $("logout").onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); showLogin(); };
  $("tabs").onclick = (e) => { const a = e.target.closest("[data-tab]"); if (!a) return; e.preventDefault(); tab = a.dataset.tab; document.querySelectorAll("#tabs a").forEach(x => x.classList.toggle("active", x === a)); render(); };

  async function loadTournaments() { const { data } = await sb.from("tournaments").select("*").order("created_at", { ascending: false }); tournaments = data || []; }
  async function render() {
    await loadTournaments();
    if (!selT || !tournaments.find(t => t.id === selT)) selT = tournaments[0]?.id || "";
    ({ tournaments: renderTournaments, teams: renderTeams, matches: renderMatches })[tab]();
  }

  // ---------- Tournaments ----------
  function renderTournaments(edit) {
    const t = edit || {};
    $("panel").innerHTML = `<div class="admin-grid">
    <form class="a-card" id="tf"><h3>${t.id ? "EDIT" : "CREATE"} TOURNAMENT</h3>
      <label>Nama<input name="name" required value="${esc(t.name)}"></label>
      <label>Format<select name="format">${opts(Object.entries(FORMATS), t.format || "single_elimination")}</select></label>
      <div class="row2"><label>Status<select name="status">${opts([["upcoming", "Upcoming"], ["live", "Live"], ["completed", "Completed"]], t.status || "upcoming")}</select></label>
      <label>Max tim<input name="max_teams" type="number" min="2" value="${t.max_teams ?? 16}"></label></div>
      <div class="row2"><label>Prize pool (Rp)<input name="prize_pool" type="number" min="0" value="${t.prize_pool ?? 0}"></label>
      <label>Tanggal mulai<input name="start_date" type="datetime-local" value="${dtLocal(t.start_date)}"></label></div>
      <label>Deskripsi<textarea name="description" rows="3">${esc(t.description)}</textarea></label>
      <label>Rules<textarea name="rules" rows="4">${esc(t.rules)}</textarea></label>
      <div class="row2"><label>Logo<input name="logo" type="file" accept="image/*"></label><label>Banner<input name="banner" type="file" accept="image/*"></label></div>
      <button class="btn-primary" type="submit">${t.id ? "SAVE CHANGES" : "CREATE TOURNAMENT"}</button>${t.id ? ' <button class="btn-ghost" type="button" id="tcancel">CANCEL</button>' : ""}</form>
    <div class="a-card"><h3>ALL TOURNAMENTS</h3>${tournaments.map(x => `<div class="a-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.format)} · ${esc(x.status)}</small></div><div class="a-actions"><button data-act="edit" data-id="${x.id}">Edit</button><button data-act="bracket" data-id="${x.id}">Generate bracket</button><a href="tournament.html?id=${x.id}" target="_blank">Open ↗</a><button class="danger" data-act="del" data-id="${x.id}">Delete</button></div></div>`).join("") || '<div class="empty-state">Belum ada turnamen.</div>'}</div></div>`;
    $("tf").onsubmit = (e) => { e.preventDefault(); run(async () => {
      const f = new FormData(e.target);
      const row = { name: f.get("name").trim(), format: f.get("format"), status: f.get("status"), max_teams: +f.get("max_teams") || null, prize_pool: +f.get("prize_pool") || 0, start_date: fromLocal(f.get("start_date")), description: f.get("description"), rules: f.get("rules") };
      const lf = f.get("logo"), bf = f.get("banner");
      if (lf?.size) row.logo_url = await uploadImage(lf, "tournaments");
      if (bf?.size) row.banner_url = await uploadImage(bf, "tournaments");
      const { error } = t.id ? await sb.from("tournaments").update(row).eq("id", t.id) : await sb.from("tournaments").insert(row);
      if (error) throw error; toast("Tersimpan"); render();
    }); };
    if (t.id) $("tcancel").onclick = () => renderTournaments();
    $("panel").onclick = (e) => { const b = e.target.closest("[data-act]"); if (!b) return; const x = tournaments.find(z => z.id === b.dataset.id);
      if (b.dataset.act === "edit") { renderTournaments(x); scrollTo(0, 0); }
      if (b.dataset.act === "del" && confirm(`Hapus "${x.name}" beserta semua match-nya?`)) run(async () => { const { error } = await sb.from("tournaments").delete().eq("id", x.id); if (error) throw error; toast("Dihapus"); render(); });
      if (b.dataset.act === "bracket") run(() => generateBracket(x));
    };
  }

  async function generateBracket(t) {
    if (t.format !== "single_elimination") throw new Error("Bracket otomatis baru tersedia untuk Single Elimination.");
    const { data: teams } = await sb.from("teams").select("id").eq("tournament_id", t.id).order("created_at");
    if (!teams || teams.length < 2) throw new Error("Minimal 2 tim harus terdaftar di turnamen ini (menu Teams).");
    const { count } = await sb.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", t.id);
    if (count && !confirm("Bracket sudah ada. Generate ulang akan menghapus semua match & skor. Lanjut?")) return;
    const shuffle = confirm(`${teams.length} tim. OK = acak seed, Cancel = urut pendaftaran.`);
    const ids = teams.map(x => x.id); if (shuffle) ids.sort(() => Math.random() - .5);
    const rows = ARES_BRACKET.buildBracket(ids).map(m => ({ ...m, tournament_id: t.id }));
    await sb.from("matches").delete().eq("tournament_id", t.id);
    const { error } = await sb.from("matches").insert(rows); if (error) throw error;
    await sb.from("tournaments").update({ champion_id: null }).eq("id", t.id);
    toast(`Bracket dibuat: ${rows.length} match`); selT = t.id; tab = "matches";
    document.querySelectorAll("#tabs a").forEach(x => x.classList.toggle("active", x.dataset.tab === "matches")); render();
  }

  // ---------- Teams ----------
  async function renderTeams(edit, players) {
    const t = edit || {}; const { data: teams } = await sb.from("teams").select("*, tournaments(name)").order("created_at", { ascending: false });
    const P = players || [];
    const rows = Array.from({ length: 7 }, (_, i) => { const sub = i >= 5; const p = P.filter(x => !!x.is_sub === sub)[sub ? i - 5 : i] || {};
      return `<div class="p-row"><span class="p-n">${sub ? "SUB " + (i - 4) : "P" + (i + 1)}</span><input name="nick${i}" placeholder="Nickname" value="${esc(p.nickname)}"><select name="role${i}">${opts(ROLE_LIST.map(r => [r, r]), p.role, "Role")}</select><input name="mid${i}" placeholder="MLBB ID" value="${esc(p.mlbb_id)}"><input name="srv${i}" placeholder="Server" value="${esc(p.server)}">${sub ? "<span></span>" : `<label class="cap-r"><input type="radio" name="cap" value="${i}" ${p.is_captain ? "checked" : ""}> Cap</label>`}</div>`; }).join("");
    $("panel").innerHTML = `<div class="admin-grid">
    <form class="a-card" id="tmf"><h3>${t.id ? "EDIT" : "ADD"} TEAM</h3>
      <div class="row2"><label>Nama tim<input name="name" required value="${esc(t.name)}"></label><label>Tag<input name="tag" maxlength="6" value="${esc(t.tag)}"></label></div>
      <div class="row2"><label>Turnamen<select name="tournament_id">${tOpts(t.tournament_id, "— tanpa turnamen —")}</select></label><label>Logo tim<input name="logo" type="file" accept="image/*"></label></div>
      <div class="eyebrow" style="margin-top:8px">ROSTER · 5 UTAMA + MAKS 2 CADANGAN · ID/SERVER OPSIONAL</div>${rows}
      <button class="btn-primary" type="submit">${t.id ? "SAVE TEAM" : "ADD TEAM"}</button>${t.id ? ' <button class="btn-ghost" type="button" id="tmcancel">CANCEL</button>' : ""}</form>
    <div class="a-card"><h3>ALL TEAMS</h3>${(teams || []).map(x => `<div class="a-row"><div style="display:flex;gap:12px;align-items:center">${ARES.logo(x)}<div><strong>${esc(x.name)}</strong><small>${esc(x.tag || "")} · ${esc(x.tournaments?.name || "tanpa turnamen")}</small></div></div><div class="a-actions"><button data-act="edit" data-id="${x.id}">Edit</button><button class="danger" data-act="del" data-id="${x.id}">Delete</button></div></div>`).join("") || '<div class="empty-state">Belum ada tim.</div>'}</div></div>`;
    $("tmf").onsubmit = (e) => { e.preventDefault(); run(async () => {
      const f = new FormData(e.target);
      const row = { name: f.get("name").trim(), tag: (f.get("tag") || "").trim().toUpperCase() || null, tournament_id: f.get("tournament_id") || null };
      const lf = f.get("logo"); if (lf?.size) row.logo_url = await uploadImage(lf, "teams");
      let id = t.id;
      if (id) { const { error } = await sb.from("teams").update(row).eq("id", id); if (error) throw error; }
      else { const { data, error } = await sb.from("teams").insert(row).select("id").single(); if (error) throw error; id = data.id; }
      const cap = f.get("cap"), pl = [];
      for (let i = 0; i < 7; i++) { const n = (f.get("nick" + i) || "").trim(); if (!n) continue;
        pl.push({ team_id: id, nickname: n, role: f.get("role" + i) || null, mlbb_id: (f.get("mid" + i) || "").trim() || null, server: (f.get("srv" + i) || "").trim() || null, is_sub: i >= 5, is_captain: i < 5 && cap === String(i), sort_order: i }); }
      await sb.from("players").delete().eq("team_id", id);
      if (pl.length) { const { error } = await sb.from("players").insert(pl); if (error) throw error; }
      toast("Tim tersimpan"); renderTeams();
    }); };
    if (t.id) $("tmcancel").onclick = () => renderTeams();
    $("panel").onclick = (e) => { const b = e.target.closest("[data-act]"); if (!b) return; const x = teams.find(z => z.id === b.dataset.id);
      if (b.dataset.act === "edit") run(async () => { const { data } = await sb.from("players").select("*").eq("team_id", x.id).order("sort_order"); renderTeams(x, data || []); scrollTo(0, 0); });
      if (b.dataset.act === "del" && confirm(`Hapus tim "${x.name}"?`)) run(async () => { const { error } = await sb.from("teams").delete().eq("id", x.id); if (error) throw error; toast("Dihapus"); renderTeams(); });
    };
  }

  // ---------- Matches ----------
  async function renderMatches() {
    const { data: ms } = selT ? await sb.from("matches").select("*, team1:teams!matches_team1_id_fkey(id,name), team2:teams!matches_team2_id_fkey(id,name)").eq("tournament_id", selT).order("round").order("position") : { data: [] };
    const byRound = {}; (ms || []).forEach(m => (byRound[m.round] ||= []).push(m));
    $("panel").innerHTML = `<div class="a-card"><h3>MATCHES</h3><label style="max-width:360px">Turnamen<select id="msel">${tOpts(selT)}</select></label>
      ${Object.keys(byRound).sort((a, b) => a - b).map(r => `<div class="eyebrow" style="margin:22px 0 10px">${esc(byRound[r][0].round_name)}</div>${byRound[r].map(m => `<div class="m-row" data-id="${m.id}">
        <div class="m-team">${esc(m.team1?.name || "TBD")}</div><input class="sc" type="number" min="0" name="s1" value="${m.score1 ?? 0}">
        <span>:</span><input class="sc" type="number" min="0" name="s2" value="${m.score2 ?? 0}"><div class="m-team r">${esc(m.team2?.name || (m.is_bye ? "BYE" : "TBD"))}</div>
        <select name="status">${opts([["scheduled", "Scheduled"], ["live", "Live"], ["completed", "Completed"]], m.status)}</select>
        <input type="datetime-local" name="when" value="${dtLocal(m.scheduled_at)}"><button class="btn-primary sm" data-save ${m.is_bye || !m.team1_id || !m.team2_id ? "disabled" : ""}>SAVE</button></div>`).join("")}`).join("") || '<div class="empty-state">Belum ada match. Buat bracket dari menu Tournaments.</div>'}</div>`;
    $("msel").onchange = (e) => { selT = e.target.value; renderMatches(); };
    $("panel").onclick = (e) => { const b = e.target.closest("[data-save]"); if (!b) return; run(() => saveMatch(ms.find(x => x.id === b.closest(".m-row").dataset.id), b.closest(".m-row"))); };
  }

  async function saveMatch(m, el) {
    const q = (n) => el.querySelector(`[name=${n}]`).value;
    const s1 = +q("s1") || 0, s2 = +q("s2") || 0, status = q("status");
    let winner = null;
    if (status === "completed") { if (s1 === s2) throw new Error("Skor seri — tentukan pemenang dulu."); winner = s1 > s2 ? m.team1_id : m.team2_id; }
    const { error } = await sb.from("matches").update({ score1: s1, score2: s2, status, winner_id: winner, scheduled_at: fromLocal(q("when")) }).eq("id", m.id);
    if (error) throw error;
    const { data: all } = await sb.from("matches").select("id,round,position").eq("tournament_id", m.tournament_id);
    const maxR = Math.max(...all.map(x => x.round));
    if (m.round < maxR) {
      const nx = all.find(x => x.round === m.round + 1 && x.position === Math.ceil(m.position / 2));
      const { error: e2 } = await sb.from("matches").update({ [m.position % 2 ? "team1_id" : "team2_id"]: winner }).eq("id", nx.id); if (e2) throw e2;
    } else {
      await sb.from("tournaments").update({ champion_id: winner, ...(winner ? { status: "completed" } : {}) }).eq("id", m.tournament_id);
    }
    toast(winner && m.round === maxR ? "🏆 Juara ditetapkan" : "Match tersimpan"); renderMatches();
  }

  init();
})();
