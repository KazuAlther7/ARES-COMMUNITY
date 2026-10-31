(() => {
  const { client: sb, esc, uploadImage } = window.ARES;
  const $ = (id) => document.getElementById(id);
  const ROLE_LIST = ["EXP", "Gold", "Mid", "Jungler", "Roamer"];
  const FORMATS = { single_elimination: "Single Elimination", double_elimination: "Double Elimination (bracket otomatis belum tersedia)", round_robin: "Round Robin (klasemen liga)", group_playoffs: "Group Stage + Playoffs" };
  let tab = "tournaments", tournaments = [], selT = "";

  const fmtErr = (e) => [e?.message, e?.details, e?.hint, e?.code && `(${e.code})`].filter(Boolean).join(" — ") || String(e);
  const toast = (m, bad) => { const t = $("toast"); t.textContent = m; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false; t.onclick = () => t.hidden = true; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, bad ? 15000 : 3500); };
  let warns = [];
  const safeUpload = async (file, folder) => {
    try { return await Promise.race([uploadImage(file, folder), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 25 dtk")), 25000))]); }
    catch (e) { warns.push(`gambar ${file.name} gagal diupload: ${fmtErr(e)}`); return undefined; }
  };
  const done = (msg) => { toast(msg + (warns.length ? " — PERINGATAN: " + warns.join("; ") : ""), warns.length > 0); warns = []; };
  const opts = (arr, sel, blank) => (blank ? `<option value="">${blank}</option>` : "") + arr.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
  const tOpts = (sel, blank) => opts(tournaments.map(t => [t.id, t.name]), sel, blank);
  const dtLocal = (s) => { if (!s) return ""; const d = new Date(s); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocal = (s) => s ? new Date(s).toISOString() : null;
  const run = async (fn, btn) => {
    const old = btn?.textContent; if (btn) { btn.disabled = true; btn.textContent = "SAVING…"; }
    try { await fn(); } catch (e) { console.error(e); toast(fmtErr(e), true); }
    finally { if (btn?.isConnected) { btn.disabled = false; btn.textContent = old; } }
  };
  window.addEventListener("unhandledrejection", (ev) => toast(fmtErr(ev.reason), true));

  if (!sb) { $("login-view").hidden = false; $("login-message").textContent = "Supabase belum dikonfigurasi (js/config.js)."; return; }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: ok } = await sb.rpc("is_admin");
    if (!ok) { await sb.auth.signOut(); showLogin("Akun ini belum memiliki akses admin."); return; }
    $("login-view").hidden = true; $("dash-view").hidden = false;
    const [h, hid] = location.hash.slice(1).split(":"); if (["tournaments", "teams", "matches"].includes(h)) goTab(h, hid); else render();
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

  function goTab(name, id) { tab = name; if (id) selT = id; document.querySelectorAll("#tabs a").forEach(x => x.classList.toggle("active", x.dataset.tab === name)); render(); }
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
      <label>Mode klasemen (liga/grup)<select name="standings_mode">${opts([["normal", "Normal Group Standings"], ["mlbb", "MLBB Group Standings"]], t.standings_mode || "normal")}</select></label>
      <div class="row2"><label>Status<select name="status">${opts([["upcoming", "Upcoming"], ["live", "Live"], ["completed", "Completed"]], t.status || "upcoming")}</select></label>
      <label>Max tim<input name="max_teams" type="number" min="2" value="${t.max_teams ?? 16}"></label></div>
      <div class="row2"><label>Prize pool (Rp)<input name="prize_pool" type="number" min="0" value="${t.prize_pool ?? 0}"></label>
      <label>Tanggal mulai<input name="start_date" type="datetime-local" value="${dtLocal(t.start_date)}"></label></div>
      <label>Deskripsi<textarea name="description" rows="3">${esc(t.description)}</textarea></label>
      <label>Rules<textarea name="rules" rows="4">${esc(t.rules)}</textarea></label>
      <div class="row2"><label>Logo<input name="logo" type="file" accept="image/*"></label><label>Banner<input name="banner" type="file" accept="image/*"></label></div>
      <button class="btn-primary" type="submit">${t.id ? "SAVE CHANGES" : "CREATE TOURNAMENT"}</button>${t.id ? ' <button class="btn-ghost" type="button" id="tcancel">CANCEL</button>' : ""}</form>
    <div class="a-card"><h3>ALL TOURNAMENTS</h3>${tournaments.map(x => `<div class="a-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.format)} · ${esc(x.status)}</small></div><div class="a-actions"><button data-act="edit" data-id="${x.id}">Edit</button><button data-act="teams" data-id="${x.id}">Teams</button><button data-act="bracket" data-id="${x.id}">Generate jadwal/bracket</button>${x.format === "group_playoffs" ? `<button data-act="playoffs" data-id="${x.id}">Generate playoffs</button>` : ""}<button data-act="share" data-id="${x.id}">Share</button><a href="tournament.html?id=${x.id}" target="_blank">Open ↗</a><button class="danger" data-act="del" data-id="${x.id}">Delete</button></div></div>`).join("") || '<div class="empty-state">Belum ada turnamen.</div>'}</div></div>`;
    $("tf").onsubmit = (e) => { e.preventDefault(); const btn = e.submitter; run(async () => {
      const f = new FormData(e.target);
      const row = { name: f.get("name").trim(), format: f.get("format"), standings_mode: f.get("standings_mode") || "normal", status: f.get("status"), max_teams: +f.get("max_teams") || null, prize_pool: +f.get("prize_pool") || 0, start_date: fromLocal(f.get("start_date")), description: f.get("description"), rules: f.get("rules") };
      let id = t.id;
      if (id) { const { error } = await sb.from("tournaments").update(row).eq("id", id); if (error) throw error; }
      else { const { data, error } = await sb.from("tournaments").insert(row).select("id").single(); if (error) throw error; id = data.id; }
      const img = {}, lf = f.get("logo"), bf = f.get("banner");
      if (btn && (lf?.size || bf?.size)) btn.textContent = "UPLOADING…";
      if (lf?.size) { const u = await safeUpload(lf, "tournaments"); if (u) img.logo_url = u; }
      if (bf?.size) { const u = await safeUpload(bf, "tournaments"); if (u) img.banner_url = u; }
      if (Object.keys(img).length) { const { error } = await sb.from("tournaments").update(img).eq("id", id); if (error) throw error; }
      if (t.id) { done("Tersimpan"); render(); }
      else { done("Turnamen dibuat — tambahkan tim di sini"); goTab("teams", id); }
    }, btn); };
    if (t.id) $("tcancel").onclick = () => renderTournaments();
    $("panel").onclick = (e) => { const b = e.target.closest("[data-act]"); if (!b) return; const x = tournaments.find(z => z.id === b.dataset.id);
      if (b.dataset.act === "edit") { renderTournaments(x); scrollTo(0, 0); }
      if (b.dataset.act === "del" && confirm(`Hapus "${x.name}" beserta semua match-nya?`)) run(async () => { const { error } = await sb.from("tournaments").delete().eq("id", x.id); if (error) throw error; toast("Dihapus"); render(); });
      if (b.dataset.act === "bracket") run(() => generateBracket(x));
      if (b.dataset.act === "playoffs") run(() => generatePlayoffs(x));
      if (b.dataset.act === "teams") goTab("teams", x.id);
      if (b.dataset.act === "share") { const u = new URL("tournament.html?id=" + x.id, location.href).href; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("Link disalin: " + u), () => prompt("Salin link:", u)); }
    };
  }

  async function generateBracket(t) {
    const B = ARES_BRACKET;
    if (t.format === "double_elimination") throw new Error("Double Elimination belum tersedia.");
    const { data: teams } = await sb.from("teams").select("id").eq("tournament_id", t.id).order("created_at");
    const min = t.format === "group_playoffs" ? 4 : 2;
    if (!teams || teams.length < min) throw new Error(`Minimal ${min} tim harus terdaftar di turnamen ini (menu Teams).`);
    const { count } = await sb.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", t.id);
    if (count && !confirm("Jadwal/bracket sudah ada. Generate ulang akan menghapus semua match & skor. Lanjut?")) return;
    let bo = 1;
    if (t.format !== "single_elimination") { bo = +prompt("Best of untuk fase liga/grup (1, 2, atau 3)?\nBo2: seri 1:1 boleh (1 poin).", "2"); if (![1, 2, 3].includes(bo)) throw new Error("Best of harus 1, 2, atau 3."); }
    const shuffle = confirm(`${teams.length} tim. OK = acak seed/undian, Cancel = urut pendaftaran.`);
    const ids = teams.map(x => x.id); if (shuffle) ids.sort(() => Math.random() - .5);
    let rows;
    if (t.format === "round_robin") rows = B.buildLeague(ids, bo, { stage: "league" });
    else if (t.format === "group_playoffs") {
      const max = Math.floor(ids.length / 2), g = +prompt(`Jumlah grup (2–${max})?`, String(Math.min(2, max)));
      if (!(g >= 2 && g <= max)) throw new Error("Jumlah grup tidak valid.");
      rows = B.buildGroups(ids, g, bo);
    } else rows = B.buildBracket(ids);
    rows = rows.map(m => ({ ...m, tournament_id: t.id }));
    await sb.from("matches").delete().eq("tournament_id", t.id);
    const { error } = await sb.from("matches").insert(rows); if (error) throw error;
    await sb.from("tournaments").update({ champion_id: null }).eq("id", t.id);
    toast(`Dibuat: ${rows.length} match`); selT = t.id; tab = "matches";
    document.querySelectorAll("#tabs a").forEach(x => x.classList.toggle("active", x.dataset.tab === "matches")); render();
  }

  async function generatePlayoffs(t) {
    const B = ARES_BRACKET;
    const { data: ms } = await sb.from("matches").select("*").eq("tournament_id", t.id);
    const gm = (ms || []).filter(m => m.stage === "group");
    if (!gm.length) throw new Error("Generate fase grup dulu.");
    const left = gm.filter(m => m.status !== "completed").length;
    if (left && !confirm(`${left} match grup belum selesai. Buat playoff dari klasemen sementara?`)) return;
    const names = [...new Set(gm.map(m => m.group_name))].sort();
    const ranked = names.map(g => { const list = gm.filter(m => m.group_name === g); const ids = [...new Set(list.flatMap(m => [m.team1_id, m.team2_id]))].map(id => ({ id })); return B.standings(ids, list).map(r => r.team.id); });
    const smallest = Math.min(...ranked.map(r => r.length));
    const k = +prompt(`Berapa tim lolos per grup (1–${smallest})?`, String(Math.min(2, smallest)));
    if (!(k >= 1 && k <= smallest)) throw new Error("Jumlah lolos tidak valid.");
    const seeds = []; for (let r = 0; r < k; r++) names.forEach((_, i) => seeds.push(ranked[i][r]));
    if (seeds.length < 2) throw new Error("Minimal 2 tim lolos.");
    const old = (ms || []).filter(m => m.stage === "playoff");
    if (old.length && !confirm("Playoff sudah ada. Generate ulang akan menghapusnya. Lanjut?")) return;
    if (old.length) await sb.from("matches").delete().in("id", old.map(x => x.id));
    const rows = B.buildPlayoffs(seeds).map(m => ({ ...m, tournament_id: t.id }));
    const { error } = await sb.from("matches").insert(rows); if (error) throw error;
    await sb.from("tournaments").update({ champion_id: null }).eq("id", t.id);
    toast(`Playoff dibuat: ${seeds.length} tim, ${rows.length} match`); selT = t.id; tab = "matches";
    document.querySelectorAll("#tabs a").forEach(x => x.classList.toggle("active", x.dataset.tab === "matches")); render();
  }

  // ---------- Teams (sinkron per turnamen) ----------
  async function renderTeams(edit, players) {
    const t = edit || {};
    const { data: all } = await sb.from("teams").select("*").order("created_at", { ascending: true });
    const teams = all || [], cur = tournaments.find(x => x.id === selT);
    const inT = teams.filter(x => x.tournament_id === selT), orphan = teams.filter(x => !x.tournament_id);
    const P = players || [];
    const rows = Array.from({ length: 7 }, (_, i) => { const sub = i >= 5; const p = P.filter(x => !!x.is_sub === sub)[sub ? i - 5 : i] || {};
      return `<div class="p-row"><span class="p-n">${sub ? "SUB " + (i - 4) : "P" + (i + 1)}</span><input name="nick${i}" placeholder="Nickname" value="${esc(p.nickname)}"><select name="role${i}">${opts(ROLE_LIST.map(r => [r, r]), p.role, "Role")}</select>${sub ? "<span></span>" : `<label class="cap-r"><input type="radio" name="cap" value="${i}" ${p.is_captain ? "checked" : ""}> Cap</label>`}</div>`; }).join("");
    const trow = (x) => `<div class="a-row"><div style="display:flex;gap:12px;align-items:center">${ARES.logo(x)}<div><strong>${esc(x.name)}</strong><small>${esc(x.tag || "")}</small></div></div><div class="a-actions"><button data-act="edit" data-id="${x.id}">Edit</button><button class="danger" data-act="del" data-id="${x.id}">Delete</button></div></div>`;
    $("panel").innerHTML = `<div class="a-card" style="margin-bottom:18px"><div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap"><label style="max-width:420px;margin:0;flex:1;min-width:220px">Turnamen aktif<select id="tsel">${tOpts(selT)}</select></label>${cur ? '<button type="button" class="btn-primary" id="bulkbtn">BULK ADD · SPREADSHEET</button>' : ""}</div>${cur ? `<small style="color:#888;display:block;margin-top:10px">Tim di sini otomatis tampil di halaman turnamen &amp; menu Teams publik · ${inT.length}${cur.max_teams ? " / " + cur.max_teams : ""} tim</small>` : '<div class="empty-state" style="margin-top:14px">Buat turnamen dulu di menu Tournaments.</div>'}</div>
    <div class="admin-grid">
    <form class="a-card" id="tmf"><h3>${t.id ? "EDIT" : "ADD"} TEAM${cur && !t.id ? " → " + esc(cur.name) : ""}</h3>
      <div class="row2"><label>Nama tim<input name="name" required value="${esc(t.name)}"></label><label>Tag / Slogan<input name="tag" maxlength="120" value="${esc(t.tag)}"></label></div>
      <div class="row2"><label>Turnamen<select name="tournament_id">${tOpts(t.id ? t.tournament_id : selT, "— tanpa turnamen —")}</select></label><label>Logo tim<input name="logo" type="file" accept="image/*"></label></div>
      <div class="eyebrow" style="margin-top:8px">ROSTER · 5 UTAMA + MAKS 2 CADANGAN</div>${rows}
      <button class="btn-primary" type="submit">${t.id ? "SAVE TEAM" : "ADD TEAM"}</button>${t.id ? ' <button class="btn-ghost" type="button" id="tmcancel">CANCEL</button>' : ""}</form>
    <div class="a-card"><h3>TEAMS${cur ? " · " + esc(cur.name) : ""}</h3>${inT.map(trow).join("") || '<div class="empty-state">Belum ada tim di turnamen ini.</div>'}
      ${orphan.length ? `<div class="eyebrow" style="margin:22px 0 4px">TANPA TURNAMEN (edit → pilih turnamen)</div>${orphan.map(trow).join("")}` : ""}</div></div>`;
    $("tsel").onchange = (e) => { selT = e.target.value; renderTeams(); };
    if ($("bulkbtn")) $("bulkbtn").onclick = () => ARES_BULK.open($("panel"), { sb, tournament: cur, existing: inT, esc, toast, fmtErr, done: () => renderTeams() });
    $("tmf").onsubmit = (e) => { e.preventDefault(); run(async () => {
      const f = new FormData(e.target);
      const row = { name: f.get("name").trim(), tag: (f.get("tag") || "").trim() || null, tournament_id: f.get("tournament_id") || null };
      if (row.tournament_id && row.tournament_id !== t.tournament_id) {
        const tt = tournaments.find(z => z.id === row.tournament_id), n = teams.filter(z => z.tournament_id === row.tournament_id).length;
        if (tt?.max_teams && n >= tt.max_teams) throw new Error(`Turnamen penuh (${tt.max_teams} tim).`);
      }
      const lf = f.get("logo"); if (lf?.size) row.logo_url = await safeUpload(lf, "teams");
      let id = t.id;
      if (id) { const { error } = await sb.from("teams").update(row).eq("id", id); if (error) throw error; }
      else { const { data, error } = await sb.from("teams").insert(row).select("id").single(); if (error) throw error; id = data.id; }
      const cap = f.get("cap"), pl = [];
      for (let i = 0; i < 7; i++) { const n = (f.get("nick" + i) || "").trim(); if (!n) continue;
        pl.push({ team_id: id, nickname: n, role: f.get("role" + i) || null, is_sub: i >= 5, is_captain: i < 5 && cap === String(i), sort_order: i }); }
      await sb.from("players").delete().eq("team_id", id);
      if (pl.length) { const { error } = await sb.from("players").insert(pl); if (error) throw error; }
      done("Tim tersimpan"); renderTeams();
    }, e.submitter); };
    if (t.id) $("tmcancel").onclick = () => renderTeams();
    $("panel").onclick = (e) => { const b = e.target.closest("[data-act]"); if (!b) return; const x = teams.find(z => z.id === b.dataset.id);
      if (b.dataset.act === "edit") run(async () => { const { data } = await sb.from("players").select("*").eq("team_id", x.id).order("sort_order"); renderTeams(x, data || []); scrollTo(0, 0); });
      if (b.dataset.act === "del" && confirm(`Hapus tim "${x.name}"?`)) run(async () => { const { error } = await sb.from("teams").delete().eq("id", x.id); if (error) throw error; toast("Dihapus"); renderTeams(); });
    };
  }

  // ---------- Matches ----------
  async function renderMatches() {
    const cur = tournaments.find(x => x.id === selT);
    const { data: ms } = selT ? await sb.from("matches").select("*, team1:teams!matches_team1_id_fkey(id,name), team2:teams!matches_team2_id_fkey(id,name)").eq("tournament_id", selT).order("round").order("position") : { data: [] };
    ARES.annotate(ms || [], cur?.status);
    const byRound = {}; (ms || []).forEach(m => (byRound[(m._ko ? "1" : "0") + "|" + String(m.round).padStart(3, "0") + "|" + (m.group_name || "")] ||= []).push(m));
    $("panel").innerHTML = `<div class="a-card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><h3>MATCHES</h3>${(ms || []).length ? '<button type="button" class="btn-ghost" id="resetall" style="border-color:#a33;color:#ff8a91">RESET SEMUA SKOR</button>' : ""}</div><label style="max-width:360px">Turnamen<select id="msel">${tOpts(selT)}</select></label>
      ${cur ? `<small style="color:#888;display:block">Status match ikut status turnamen (${esc(cur.status)}). Match otomatis Completed saat skor menang tercapai (knockout: Final Bo5, Semi Final Bo3, lainnya Bo1; liga/grup sesuai Bo yang dipilih — Bo2 boleh seri).</small>` : ""}
      ${Object.keys(byRound).sort().map(r => `<div class="eyebrow" style="margin:22px 0 10px">${esc(byRound[r][0].round_name)} · BO${byRound[r][0]._bo}</div>${byRound[r].map(m => { const ok = !m.is_bye && m.team1_id && m.team2_id; return `<div class="m-row" data-id="${m.id}">
        <div class="m-no">${m.is_bye ? "BYE" : "M" + m._no}</div><div class="m-team">${esc(m.team1?.name || "TBD")}</div>
        ${ok ? `<select class="sc2" name="sc">${ARES.scoreOpts(m)}</select>` : `<span class="m-st">—</span>`}
        <div class="m-team r">${esc(m.team2?.name || (m.is_bye ? "BYE" : "TBD"))}</div>
        <span class="m-st">${esc(m._st.toUpperCase())}</span>
        <input type="datetime-local" name="when" value="${dtLocal(m.scheduled_at)}"><button class="btn-primary sm" data-save ${ok ? "" : "disabled"}>SAVE</button></div>`; }).join("")}`).join("") || '<div class="empty-state">Belum ada match. Buat bracket dari menu Tournaments.</div>'}</div>`;
    $("msel").onchange = (e) => { selT = e.target.value; renderMatches(); };
    if ($("resetall")) $("resetall").onclick = (e) => { if (!confirm("Reset SEMUA skor turnamen ini? Skor, pemenang, dan juara dihapus (bracket awal tetap).")) return; run(async () => { const n = await ARES.resetScores(selT); toast(`${n} match direset`); renderMatches(); }, e.currentTarget); };
    $("panel").onclick = (e) => { const b = e.target.closest("[data-save]"); if (!b) return; run(() => saveMatch(ms.find(x => x.id === b.closest(".m-row").dataset.id), b.closest(".m-row")), b); };
  }

  async function saveMatch(m, el) {
    const q = (n) => el.querySelector(`[name=${n}]`).value, [s1, s2] = q("sc").split("-").map(Number);
    const r = await ARES.saveMatchResult(m, s1, s2, fromLocal(q("when")));
    toast(r.winner && r.final ? "🏆 Juara ditetapkan" : r.done ? "Match selesai — pemenang lanjut ke babak berikutnya" : "Skor tersimpan"); renderMatches();
  }

  init();
})();
