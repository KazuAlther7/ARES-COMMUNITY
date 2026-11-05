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
      ${subs.length ? `<div class="eyebrow" style="margin-top:18px">SUBSTITUTES</div><ul class="roster">${subs.map(row).join("")}</ul>` : ""}
      <button type="button" class="prof-btn" data-prof><i class="ico ico-stats"></i> PROFIL &amp; RIWAYAT TIM</button><div class="prof" id="prof-box" hidden></div>`;
    // Profil tim: dibuka (dan dimuat) hanya saat tombol diklik. Tim yg sama di banyak turnamen = baris teams berbeda → digabung lewat nama.
    const pb = body.querySelector("[data-prof]"), box = body.querySelector("#prof-box");
    pb.onclick = async () => {
      if (!box.hidden) { box.hidden = true; pb.innerHTML = '<i class="ico ico-stats"></i> PROFIL &amp; RIWAYAT TIM'; return; }
      box.hidden = false; pb.innerHTML = "▲ TUTUP PROFIL";
      if (!box.dataset.done) { box.innerHTML = '<div class="empty-state">Memuat profil<span class="loader"></span></div>'; try { box.innerHTML = await teamProfileHtml(team); box.dataset.done = "1"; } catch (err) { box.innerHTML = `<div class="empty-state">Gagal memuat profil: ${esc(err.message || err)}</div>`; } }
    };
  }
  // Hall of Fame: klik tim → hanya juara yang diraih + statistik (tanpa roster).
  async function showTeamHof(team) {
    document.querySelector(".modal-back")?.remove();
    const back = document.createElement("div"); back.className = "modal-back";
    back.innerHTML = `<div class="modal"><button class="modal-x" aria-label="Close">×</button><div class="roster-head">${logo(team, "xl")}<div><h3>${esc(team.name)}</h3><small>HALL OF FAME</small></div></div><div class="prof" style="margin-top:18px"><div class="empty-state">Memuat<span class="loader"></span></div></div></div>`;
    document.body.appendChild(back);
    back.addEventListener("click", e => { if (e.target === back) back.remove(); });
    back.querySelector(".modal-x").onclick = () => back.remove();
    const box = back.querySelector(".prof");
    try { box.innerHTML = await teamProfileHtml(team, { hof: true }); } catch (err) { box.innerHTML = `<div class="empty-state">Gagal memuat: ${esc(err.message || err)}</div>`; }
  }
  async function teamProfileHtml(team, opts = {}) {
    const A = window.ARES, like = String(team.name || "").trim().replace(/[\\%_]/g, (c) => "\\" + c);
    const { data: rows, error } = await client.from("teams").select("id,tournaments(id,name,game,status,champion_id,is_hidden,start_date,created_at)").ilike("name", like);
    if (error) throw error;
    const mine = (rows || []).filter(r => r.tournaments && (A.admin.on || !r.tournaments.is_hidden));
    const ids = new Set(mine.map(r => r.id));
    if (!ids.size) return '<div class="empty-state">Belum ada data.</div>';
    const idList = [...ids].join(",");
    const { data: ms, error: e2 } = await client.from("matches").select("id,tournament_id,round,position,stage,bracket_side,round_name,team1_id,team2_id,score1,score2,winner_id,status,is_bye,scheduled_at,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)").or(`team1_id.in.(${idList}),team2_id.in.(${idList})`);
    if (e2) throw e2;
    const tById = Object.fromEntries(mine.map(r => [r.tournaments.id, r.tournaments]));
    const done = (ms || []).filter(m => !m.is_bye && m.team1_id && m.team2_id && (m.status === "completed" || m.winner_id) && tById[m.tournament_id]);
    let W = 0, L = 0, D = 0, gf = 0, ga = 0; const per = {};
    const hist = done.map(m => {
      const me = ids.has(m.team1_id) ? 1 : 2, my = me === 1 ? m.score1 : m.score2, op = me === 1 ? m.score2 : m.score1, opp = (me === 1 ? m.team2 : m.team1)?.name || "?";
      const res = m.winner_id ? (ids.has(m.winner_id) ? "W" : "L") : "D";
      if (res === "W") W++; else if (res === "L") L++; else D++;
      gf += +my || 0; ga += +op || 0;
      const t = (per[m.tournament_id] ||= { w: 0, l: 0 }); if (res === "W") t.w++; else if (res === "L") t.l++;
      // Urutan "terbaru dimainkan": turnamen terbaru dulu; dalam turnamen sama → jadwal (kalau ada), lalu urutan babak (Final paling akhir).
      const sd = m.bracket_side, lg = m.stage === "league" || m.stage === "group";
      const prog = lg ? m.round : 1000 + (sd === "final" ? 900 : sd === "third" ? 899 : sd === "losers" ? (m.round + 2) * 10 : sd === "winners" ? (m.round + 1) * 10 + 1 : m.round * 10);
      const tt = tById[m.tournament_id];
      return { res, my: +my || 0, op: +op || 0, opp, t: tt.name, rn: m.round_name || "", at: m.scheduled_at || "", tk: String(tt.start_date || tt.created_at || ""), tid: m.tournament_id, prog, pos: m.position || 0 };
    }).sort((a, b) => b.tk.localeCompare(a.tk) || (a.tid === b.tid && a.at && b.at ? String(b.at).localeCompare(String(a.at)) : 0) || b.prog - a.prog || b.pos - a.pos).slice(0, 5);
    const trophies = mine.filter(r => r.tournaments.champion_id === r.id).length, played = W + L + D;
    const tl = [...mine].sort((a, b) => String(b.tournaments.start_date || b.tournaments.created_at || "").localeCompare(String(a.tournaments.start_date || a.tournaments.created_at || "")));
    return `<div class="prof-stats"><div><b>${W}-${L}${D ? "-" + D : ""}</b><small>MATCH W-L${D ? "-D" : ""}</small></div><div><b>${played ? Math.round(W * 100 / played) : 0}%</b><small>WIN RATE</small></div><div><b>${gf}-${ga}</b><small>GAME MENANG-KALAH</small></div><div><b><i class="ico ico-trophy"></i> ${trophies}</b><small>TROPHY</small></div></div>
      ${opts.hof ? `<div class="eyebrow" style="margin-top:16px">JUARA DIRAIH (${trophies})</div>
      <ul class="prof-list">${tl.filter(r => r.tournaments.champion_id === r.id).map(r => { const t = r.tournaments; return `<li><span><i class="ico ico-trophy"></i> <a href="tournament.html?id=${t.id}">${esc(t.name)}</a>${t.game ? ` <i>${esc(t.game)}</i>` : ""}</span><em class="gold">JUARA</em></li>`; }).join("") || '<li class="muted-li">Belum ada.</li>'}</ul>`
      : `<div class="eyebrow" style="margin-top:16px">TURNAMEN DIIKUTI (${tl.length})</div>
      <ul class="prof-list">${tl.map(r => { const t = r.tournaments, st = per[t.id] || { w: 0, l: 0 }, champ = t.champion_id === r.id; return `<li><span>${champ ? '<i class="ico ico-trophy"></i> ' : ""}<a href="tournament.html?id=${t.id}">${esc(t.name)}</a>${t.game ? ` <i>${esc(t.game)}</i>` : ""}</span><em class="${champ ? "gold" : ""}">${champ ? "JUARA" : esc((t.status || "").toUpperCase())} · ${st.w}-${st.l}</em></li>`; }).join("")}</ul>`}
      <div class="eyebrow" style="margin-top:16px">5 MATCH TERAKHIR</div>
      <ul class="prof-list">${hist.map(h => `<li><span><b class="res ${h.res}">${h.res}</b> vs ${esc(h.opp)} <i>${esc(h.t)}${h.rn ? " · " + esc(h.rn) : ""}</i></span><em>${h.my} : ${h.op}</em></li>`).join("") || '<li class="muted-li">Belum ada match selesai.</li>'}</ul>`;
  }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-team]");
    if (el && el.dataset.team) { e.preventDefault(); showTeam(el.dataset.team); }
  });
  // Menu navbar bisa di-scroll (geser jari / roda mouse); link aktif otomatis di tengah.
  document.querySelectorAll(".topbar nav").forEach(n => {
    n.addEventListener("wheel", (e) => { if (n.scrollWidth <= n.clientWidth) return; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return; e.preventDefault(); n.scrollLeft += d; }, { passive: false });
    const a = n.querySelector(".active"); if (a) n.scrollLeft = a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2;
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelector(".modal-back")?.remove(); });

  async function saveMatchResult(m, s1, s2, whenIso) {
    const B = window.ARES_BRACKET;
    const [{ data: t }, { data: all }] = await Promise.all([
      client.from("tournaments").select("status,format").eq("id", m.tournament_id).single(),
      client.from("matches").select("id,round,position,stage,bracket_side,team1_id,team2_id,score1,score2,status,winner_to,loser_to,best_of").eq("tournament_id", m.tournament_id)
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
    const ko = all.filter(B.isKO), bo = m.best_of || 1, wins = Math.ceil(bo / 2); // best_of udah fixed sejak digenerate (WB final Bo5, LB final Bo3, dst)
    if (s1 > wins || s2 > wins || (s1 === wins && s2 === wins)) throw new Error(`Skor tidak valid untuk Bo${bo}`);
    const done = s1 === wins || s2 === wins;
    const winner = done ? (s1 > s2 ? m.team1_id : m.team2_id) : null;
    const loser = done ? (winner === m.team1_id ? m.team2_id : m.team1_id) : null;
    const { error } = await client.from("matches").update({ score1: s1, score2: s2, status: done ? "completed" : live, winner_id: winner, scheduled_at: whenIso ?? m.scheduled_at ?? null }).eq("id", m.id);
    if (error) throw error;
    let final = false;
    if (done) {
      const self = ko.find(x => x.id === m.id); // winner_to/loser_to hasil query sebelum skor ini disimpan
      const wt = self?.winner_to, lt = self?.loser_to;
      if (wt) { const nx = ko.find(x => (x.bracket_side || null) === (wt.side || null) && x.round === wt.round && x.position === wt.position); if (nx) { const { error: e2 } = await client.from("matches").update({ [wt.slot === 1 ? "team1_id" : "team2_id"]: winner }).eq("id", nx.id); if (e2) throw e2; } }
      else if (self?.bracket_side !== "third") { await client.from("tournaments").update({ champion_id: winner, status: "completed" }).eq("id", m.tournament_id); final = true; } // match juara 3 tidak menentukan juara
      if (lt && loser) { const nx = ko.find(x => (x.bracket_side || null) === (lt.side || null) && x.round === lt.round && x.position === lt.position); if (nx) { const { error: e3 } = await client.from("matches").update({ [lt.slot === 1 ? "team1_id" : "team2_id"]: loser }).eq("id", nx.id); if (e3) throw e3; } }
      // Double elimination: match BYE di Winners Bracket gak punya "yang kalah", jadi slot Losers Bracket terkait
      // baru kelihatan lengkap belakangan — cek ulang & auto-selesaikan BYE baru yg baru kebuka.
      if (ko.some(x => x.bracket_side)) {
        const { data: fresh } = await client.from("matches").select("id,round,position,bracket_side,team1_id,team2_id,winner_id,is_bye,status,winner_to,loser_to,stage").eq("tournament_id", m.tournament_id);
        const ko2 = (fresh || []).filter(B.isKO);
        B.propagateByes(ko2);
        await Promise.all(ko2.filter(x => x.is_bye && fresh.find(f => f.id === x.id && !f.is_bye)).map(x => client.from("matches").update({ team1_id: x.team1_id, team2_id: x.team2_id, winner_id: x.winner_id, is_bye: true, status: "completed" }).eq("id", x.id)));
      }
    }
    return { winner, final, done };
  }
  // Reset semua skor: seed asli (round 1 Winners/bracket tunggal) dipertahankan, sisanya dikosongkan lalu BYE di-replay via winner_to.
  async function resetScores(tid) {
    const B = window.ARES_BRACKET;
    const [{ data: t0 }, { data: ms0, error }] = await Promise.all([
      client.from("tournaments").select("status,format").eq("id", tid).single(),
      client.from("matches").select("id,round,position,stage,bracket_side,team1_id,team2_id,winner_to,loser_to").eq("tournament_id", tid)
    ]);
    if (error) throw error; if (!ms0.length) throw new Error("Belum ada match.");
    let ms = ms0;
    if (t0?.format === "group_playoffs") { // playoff berasal dari klasemen → dihapus, generate ulang setelah grup selesai
      const po = ms.filter(m => m.stage === "playoff");
      if (po.length) await client.from("matches").delete().in("id", po.map(x => x.id));
      ms = ms.filter(m => m.stage !== "playoff");
    }
    const sources = B.fedSlots(ms), sk = (m, slot) => `${m.bracket_side || ""}:${m.round}-${m.position}#${slot}`;
    const st = ms.map(m => {
      const ko = B.isKO(m);
      const keep1 = !ko || !(sources[sk(m, 1)] || []).length, keep2 = !ko || !(sources[sk(m, 2)] || []).length;
      return { id: m.id, round: m.round, position: m.position, bracket_side: m.bracket_side || null,
        team1_id: keep1 ? m.team1_id : null, team2_id: keep2 ? m.team2_id : null,
        winner_id: null, status: "scheduled", is_bye: false, winner_to: m.winner_to, loser_to: m.loser_to };
    });
    B.propagateByes(st); // isi ulang BYE yg auto-lanjut (termasuk rantai WB→LB di double elim); match liga/grup otomatis gak kesentuh (winner_to kosong)
    const res = await Promise.all(st.map(m => client.from("matches").update({ team1_id: m.team1_id, team2_id: m.team2_id, score1: 0, score2: 0, winner_id: m.winner_id, status: m.status, is_bye: m.is_bye }).eq("id", m.id)));
    const bad = res.find(r => r.error); if (bad) throw bad.error;
    await client.from("tournaments").update({ champion_id: null, ...(t0?.status === "completed" ? { status: "upcoming" } : {}) }).eq("id", tid);
    return st.length;
  }
  // Generate bracket playoff dari klasemen grup saat ini. k = jumlah tim lolos per grup.
  // Dipakai dari admin.html (tab Tournaments) maupun langsung dari tournament.html (panel Set Scores).
  async function generatePlayoffs(tid, k) {
    const B = window.ARES_BRACKET;
    const [{ data: t }, { data: ms0 }] = await Promise.all([
      client.from("tournaments").select("standings_mode,third_place").eq("id", tid).single(),
      client.from("matches").select("*").eq("tournament_id", tid)
    ]);
    const mode = t?.standings_mode === "mlbb" ? "mlbb" : "normal";
    const gm = (ms0 || []).filter(m => m.stage === "group");
    if (!gm.length) throw new Error("Generate fase grup dulu.");
    const left = gm.filter(m => m.status !== "completed").length;
    if (left && !confirm(`${left} match grup belum selesai. Buat playoff dari klasemen sementara?`)) return null;
    const names = [...new Set(gm.map(m => m.group_name))].sort();
    const ranked = names.map(g => { const list = gm.filter(m => m.group_name === g); const ids = [...new Set(list.flatMap(m => [m.team1_id, m.team2_id]))].map(id => ({ id })); return B.standings(ids, list, mode).map(r => r.team.id); });
    const smallest = Math.min(...ranked.map(r => r.length));
    if (!(k >= 1 && k <= smallest)) throw new Error(`Jumlah tim lolos harus 1–${smallest}.`);
    const seeds = []; for (let r = 0; r < k; r++) names.forEach((_, i) => seeds.push(ranked[i][r]));
    if (seeds.length < 2) throw new Error("Minimal 2 tim lolos.");
    const old = (ms0 || []).filter(m => m.stage === "playoff");
    if (old.length && !confirm("Playoff sudah ada. Generate ulang akan menghapusnya. Lanjut?")) return null;
    if (old.length) await client.from("matches").delete().in("id", old.map(x => x.id));
    const rows = B.buildPlayoffs(seeds, { third: !!t?.third_place && seeds.length >= 4 }).map(m => ({ ...m, tournament_id: tid }));
    const { error } = await client.from("matches").insert(rows); if (error) throw error;
    await client.from("tournaments").update({ champion_id: null, qualify_count: k }).eq("id", tid);
    return { seeds: seeds.length, matches: rows.length };
  }
  const scoreOpts = (m) => {
    const o = window.ARES_BRACKET.scoreOptions(m._bo), cur = [m.score1 || 0, m.score2 || 0];
    if (!o.some(x => x[0] === cur[0] && x[1] === cur[1])) o.push(cur);
    return o.map(([a, b]) => `<option value="${a}-${b}" ${a === cur[0] && b === cur[1] ? "selected" : ""}>${a} : ${b}</option>`).join("");
  };

  // ----- Predictions: pengunjung tebak juara (nama + tim). Dipakai di tournament.html & predictions.html -----
  async function renderPredict(el, t, teams) {
    const st = el.__pred ||= { team: null, name: "" };
    const old = el.querySelector(".pred-name"); if (old) st.name = old.value; // jaga ketikan waktu auto-refresh
    const key = "ares_pred_" + t.id; let mine = null; try { mine = JSON.parse(localStorage.getItem(key)); } catch {}
    const { data: rows, error } = await client.from("predictions").select("id,team_id,voter_name,created_at").eq("tournament_id", t.id).order("created_at", { ascending: false });
    if (error) { el.innerHTML = '<div class="empty-state">Predictions belum siap — jalankan SQL update di Supabase dulu.</div>'; return; }
    const closed = t.status === "completed" || !!t.champion_id, A = window.ARES;
    const cnt = {}; rows.forEach(r => cnt[r.team_id] = (cnt[r.team_id] || 0) + 1);
    const total = rows.length, list = [...teams].sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || String(a.name).localeCompare(String(b.name)));
    const champ = t.champion_id ? teams.find(x => x.id === t.champion_id) : null;
    const right = champ ? rows.filter(r => r.team_id === champ.id) : [];
    const myTeam = mine && teams.find(x => x.id === mine.team);
    const opts = list.map(x => { const c = cnt[x.id] || 0, pc = total ? Math.round(c * 100 / total) : 0;
      return `<button type="button" class="pred-opt ${st.team === x.id ? "sel" : ""} ${champ && champ.id === x.id ? "champ" : ""}" data-pt="${x.id}" ${closed || mine ? "disabled" : ""}>${logo(x)}<span class="pn">${esc(x.name)}</span><span class="pbar"><i style="width:${pc}%"></i></span><b>${c} · ${pc}%</b></button>`; }).join("");
    let foot;
    if (closed) foot = `<p class="hint">Prediksi ditutup — turnamen selesai.${champ ? ` Juara: <b>${esc(champ.name)}</b>. ${right.length ? `Tebakan benar (${right.length}): ${right.map(r => esc(r.voter_name)).join(", ")}.` : "Tidak ada yang menebak benar."}` : ""}</p>`;
    else if (mine) foot = `<p class="hint">✓ Prediksimu tersimpan: <b>${esc(mine.name)}</b> → <b>${esc(myTeam?.name || "?")}</b>.</p>`;
    else foot = `<div class="pred-form"><input class="pred-name" maxlength="24" placeholder="Nama / nickname kamu" value="${esc(st.name)}"><button type="button" data-psend>KIRIM PREDIKSI</button></div><p class="hint">Pilih tim juara, isi namamu (1 nama = 1 prediksi, tidak bisa diubah).</p>`;
    const adm = A.admin.on && rows.length ? `<details class="pred-adm"><summary>ADMIN · ${rows.length} prediksi</summary>${rows.map(r => `<div><span>${esc(r.voter_name)} → ${esc(teams.find(x => x.id === r.team_id)?.name || "?")}</span><button type="button" data-pdel="${r.id}">hapus</button></div>`).join("")}</details>` : "";
    el.innerHTML = `<div class="pred"><div class="pred-total">${total} PREDIKSI MASUK${closed ? " · DITUTUP" : ""}</div><div class="pred-opts">${opts || '<div class="empty-state">Belum ada tim terdaftar.</div>'}</div>${foot}${adm}</div>`;
    el.onclick = async (e) => {
      const o = e.target.closest("[data-pt]"), d = e.target.closest("[data-pdel]"), s = e.target.closest("[data-psend]");
      if (o && !o.disabled) { st.team = o.dataset.pt; const n = el.querySelector(".pred-name"); if (n) st.name = n.value; return renderPredict(el, t, teams); }
      if (d && confirm("Hapus prediksi ini?")) { const { error: er } = await client.from("predictions").delete().eq("id", d.dataset.pdel); if (er) alert(er.message); return renderPredict(el, t, teams); }
      if (s) {
        const name = (el.querySelector(".pred-name").value || "").trim(); st.name = name;
        if (!st.team) return alert("Pilih tim juara dulu."); if (name.length < 2) return alert("Isi nama minimal 2 huruf.");
        s.disabled = true;
        const { error: er } = await client.from("predictions").insert({ tournament_id: t.id, team_id: st.team, voter_name: name });
        if (er) { s.disabled = false; return alert(er.code === "23505" ? "Nama itu sudah dipakai untuk memprediksi. Pakai nama lain." : (er.message || "Gagal kirim prediksi.")); }
        try { localStorage.setItem(key, JSON.stringify({ team: st.team, name })); } catch {}
        renderPredict(el, t, teams);
      }
    };
  }
  window.ARES = { showTeamHof, renderPredict, saveMatchResult, resetScores, generatePlayoffs, scoreOpts, annotate: (...a) => window.ARES_BRACKET.annotate(...a), admin: { is: false, on: false }, client, esc, money, ROLES, roleIcon, logo, uploadImage, showTeam };
})();
