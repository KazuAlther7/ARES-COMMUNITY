(() => {
  const { client, esc, money, logo } = window.ARES;
  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id");
  if (!client || !id) { $("t-head").innerHTML = '<div class="empty-state">Turnamen tidak ditemukan atau Supabase belum terhubung.</div>'; $("bracket").innerHTML = ""; return; }

  const slot = (t, score, win, bye) => `<div class="slot ${win ? "win" : ""} ${t ? "" : "tbd"}" ${t ? `data-team="${t.id}"` : ""}>${t ? logo(t) : '<span class="team-emblem">?</span>'}<span class="slot-name">${t ? esc(t.name) : (bye ? "BYE" : "TBD")}</span><b>${t ? Number(score || 0) : ""}</b></div>`;

  const dtLocal = (s) => { if (!s) return ""; const d = new Date(s); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocal = (s) => s ? new Date(s).toISOString() : null;
  const shareUrl = location.origin + location.pathname + "?id=" + id;
  const TROPHY = '<svg class="trophy" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8h24v14a12 12 0 01-24 0V8z" fill="currentColor" fill-opacity=".18"/><path d="M20 12h-8v4a8 8 0 008 8M44 12h8v4a8 8 0 01-8 8M32 34v10M22 56h20M26 44h12v12H26z"/></svg>';
  const champCol = (fin) => {
    const done = fin.winner_id && fin._st === "completed";
    const champ = done ? (fin.winner_id === fin.team1_id ? fin.team1 : fin.team2) : null;
    const runner = done ? (fin.winner_id === fin.team1_id ? fin.team2 : fin.team1) : null;
    return `<div class="b-round is-last champ-col"><div class="b-title">CHAMPION</div><div class="b-matches"><div class="b-item"><div class="b-match b-champ ${champ ? "has" : ""}"><div class="b-head"><span>CHAMPION</span><span>1ST</span></div><div class="champ-body">${TROPHY}${champ ? `<div class="champ-team" data-team="${champ.id}">${logo(champ, "lg")}<strong>${esc(champ.name)}</strong></div>` : '<div class="champ-tbd">TBD</div>'}</div><div class="b-foot">${runner ? `RUNNER-UP · <b data-team="${runner.id}" style="cursor:pointer">${esc(runner.name)}</b>` : "MENUNGGU GRAND FINAL"}</div></div></div></div></div>`;
  };
  // ----- fase liga / grup: klasemen doang (jadwal/matchday ada di menu Live Matches) -----
  function renderLeague(t, lg, teams) {
    const el = $("t-league");
    if (!lg.length) { el.hidden = true; el.innerHTML = ""; return; }
    const tmap = Object.fromEntries(teams.map(x => [x.id, x]));
    lg.forEach(m => { if (m.team1) tmap[m.team1.id] = m.team1; if (m.team2) tmap[m.team2.id] = m.team2; });
    const groups = {}; lg.forEach(m => (groups[m.group_name || ""] ||= []).push(m));
    const isRR = t.format === "round_robin";
    const mode = t.standings_mode === "mlbb" ? "mlbb" : "normal";
    const showQualify = t.format === "group_playoffs" && t.qualify_count > 0;
    const qc = t.qualify_count || 0;
    const head = mode === "mlbb"
      ? `<tr><th>#</th><th class="tl">TIM</th><th>MP</th><th>W-L</th><th>NET</th><th>GAME</th></tr>`
      : `<tr><th>#</th><th class="tl">TIM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr>`;
    let hint = mode === "mlbb"
      ? "MLBB Group Standings · MP = jumlah match menang. Urutan: Match Point → Net Game Win → Game Menang."
      : "Menang 3 poin · seri 1 · kalah 0. Poin sama → selisih gol (GD), lalu gol masuk (GF). Gol = kemenangan game.";
    if (showQualify) hint += ` · Hijau = ${qc} besar (lolos playoff), merah = tersingkir.`;
    const row = (r, i, champ) => {
      const qualIn = showQualify ? i < qc : null;
      const topCls = qualIn === null && i === 0 && r.P ? "top" : "";
      const cls = `${topCls} ${champ ? "champ" : ""} ${qualIn === true ? "q-in" : qualIn === false ? "q-out" : ""}`;
      const name = `<td class="tl tm" data-team="${r.team.id}">${logo(r.team)}<span>${esc(r.team.name)}</span>${champ ? " 🏆" : ""}</td>`;
      return mode === "mlbb"
        ? `<tr class="${cls}"><td>${i + 1}</td>${name}<td><b>${r.W}</b></td><td>${r.W}-${r.L}</td><td>${r.GD > 0 ? "+" : ""}${r.GD}</td><td>${r.GF}-${r.GA}</td></tr>`
        : `<tr class="${cls}"><td>${i + 1}</td>${name}<td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF}</td><td>${r.GA}</td><td>${r.GD > 0 ? "+" : ""}${r.GD}</td><td><b>${r.Pts}</b></td></tr>`;
    };
    el.innerHTML = `<div class="section-heading"><div><div class="eyebrow">${isRR ? "LEAGUE TABLE" : "GROUP STAGE"}</div><h2>${isRR ? "STANDINGS" : "GROUPS"}<span>.</span></h2></div>${mode === "mlbb" ? '<span class="mode-pill">MLBB STANDINGS</span>' : ""}<button type="button" class="export-btn" data-export="t-league"><svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17 7.3 11.7l1.4-1.4L12 13.6V3zM5 19h14v2H5z"/></svg>EXPORT PNG</button></div>` +
      Object.keys(groups).sort().map(g => {
        const gm = groups[g].sort((a, b) => a.round - b.round || a.position - b.position);
        const ids = [...new Set(gm.flatMap(m => [m.team1_id, m.team2_id]).filter(Boolean))];
        const rows = window.ARES_BRACKET.standings(ids.map(i => tmap[i]).filter(Boolean), gm, mode);
        return `<div class="lg-block">${g ? `<h3 class="lg-title">${esc(g)}</h3>` : ""}<div class="tbl-wrap"><table class="standings">${head}${rows.map((r, i) => row(r, i, t.champion_id === r.team.id)).join("")}</table></div>
        <p class="hint">${hint}</p></div>`;
      }).join("");
    el.hidden = false;
  }
  // ----- panel admin: set skor, padat per matchday/round — hanya utk format ber-klasemen grup -----
  const spRow = (m) => `<div class="sp-row ${m._st === "live" ? "is-live" : ""}" data-mid="${m.id}"><span class="sp-no">M${m._no}</span><span class="sp-t" data-team="${m.team1_id}">${esc(m.team1?.name || "TBD")}</span><select name="sc">${window.ARES.scoreOpts(m)}</select><span class="sp-t r" data-team="${m.team2_id}">${esc(m.team2?.name || "TBD")}</span><input type="datetime-local" name="when" value="${dtLocal(m.scheduled_at)}" title="Jadwal — sinkron ke Live Matches"><button type="button" data-msave>SAVE</button></div>`;
  const spBox = (label, ms) => `<div class="sp-box"><div class="sp-box-h">${esc(label)}</div>${ms.map(spRow).join("")}</div>`;
  function renderScorePanel(t, allMs) {
    const el = $("t-scorepanel");
    if (!el) return;
    const useScorePanel = t.format === "round_robin" || t.format === "group_playoffs";
    if (!useScorePanel || !window.ARES.admin.on) { el.hidden = true; el.innerHTML = ""; return; }
    const editable = (allMs || []).filter(m => m.team1_id && m.team2_id && !m.is_bye);
    const lg = editable.filter(m => !m._ko), ko = editable.filter(m => m._ko);
    if (!editable.length && t.format !== "group_playoffs") { el.hidden = true; el.innerHTML = ""; return; }

    let genBar = "";
    if (t.format === "group_playoffs" && lg.length) {
      const sizes = {}; lg.forEach(m => { (sizes[m.group_name || ""] ||= new Set()).add(m.team1_id); sizes[m.group_name || ""].add(m.team2_id); });
      const minSize = Math.min(...Object.values(sizes).map(s => s.size)) || 2;
      const cur = Math.min(t.qualify_count || 2, minSize);
      const qOpts = Array.from({ length: minSize }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === cur ? "selected" : ""}>${n}</option>`).join("");
      genBar = `<div class="sp-gen"><label>Tim lolos / grup<select id="qcount">${qOpts}</select></label><button type="button" id="genplayoffs">GENERATE PLAYOFFS →</button></div>`;
    }

    let boxes = "";
    if (lg.length) {
      const groups = {}; lg.forEach(m => (groups[(m.group_name || "") + "|" + String(m.round).padStart(3, "0")] ||= []).push(m));
      boxes += Object.keys(groups).sort().map(k => {
        const ms = groups[k].sort((a, b) => a.position - b.position);
        const label = (ms[0].group_name ? ms[0].group_name + " · " : "") + "MD" + ms[0].round;
        return spBox(label, ms);
      }).join("");
    }
    if (ko.length) {
      const groups = {}; ko.forEach(m => (groups[m.round] ||= []).push(m));
      boxes += Object.keys(groups).sort((a, b) => a - b).map(r => {
        const ms = groups[r].sort((a, b) => a.position - b.position);
        return spBox(ms[0].round_name || ("Round " + r), ms);
      }).join("");
    }
    el.innerHTML = `<div class="section-heading"><div><div class="eyebrow">ADMIN ONLY</div><h2>SET SCORES<span>.</span></h2></div>${boxes ? '<button type="button" class="btn-primary" id="saveall">SAVE ALL</button>' : ""}</div>${genBar}${boxes ? `<div class="sp-grid">${boxes}</div>` : '<p class="hint">Belum ada match playoff — generate dulu dari klasemen grup.</p>'}`;
    el.hidden = false;
  }
  async function load() {
    const [{ data: t, error }, { data: ms }, { data: teams }] = await Promise.all([
      client.from("tournaments").select("*").eq("id", id).single(),
      client.from("matches").select("*, team1:teams!matches_team1_id_fkey(id,name,tag,logo_url), team2:teams!matches_team2_id_fkey(id,name,tag,logo_url)").eq("tournament_id", id).order("round").order("position"),
      client.from("teams").select("id,name,tag,logo_url").eq("tournament_id", id).order("created_at")
    ]);
    if (error || !t) { $("t-head").innerHTML = '<div class="empty-state">Turnamen tidak ditemukan.</div>'; return; }
    document.title = `${t.name} — ARES COMMUNITY`;
    const champ = t.champion_id && (teams || []).find(x => x.id === t.champion_id);
    $("t-head").innerHTML = `<div class="t-hero" ${t.banner_url ? `style="background-image:linear-gradient(90deg,#0b0c0ef2,#0b0c0e99),url('${esc(t.banner_url)}')"` : ""}>
      ${t.logo_url ? `<img class="t-logo" src="${esc(t.logo_url)}" alt="">` : ""}
      <div><div class="eyebrow">${esc((t.format || "").replaceAll("_", " ").toUpperCase())} · ${esc((t.status || "upcoming").toUpperCase())}</div>
      <h1 class="t-title">${esc(t.name)}</h1>
      <div class="t-meta"><span>PRIZE POOL <b>Rp ${money(t.prize_pool)}</b></span>${t.start_date ? `<span>START <b>${new Date(t.start_date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</b></span>` : ""}<span>TEAMS <b>${(teams || []).length}${t.max_teams ? " / " + t.max_teams : ""}</b></span></div>
      <div class="share-bar"><button type="button" data-share="native">SHARE</button><a data-share="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${t.name} — bracket & skor live di ARES COMMUNITY\n${shareUrl}`)}">WHATSAPP</a><button type="button" data-share="copy">COPY LINK</button></div>${window.ARES.admin.on ? `<div class="admin-bar"><a href="admin.html#tournaments">Edit / Generate bracket ↗</a><a href="admin.html#teams:${t.id}">Kelola tim ↗</a><a href="admin.html#matches:${t.id}">Semua match ↗</a><a href="#" data-reset="${t.id}">Reset semua skor</a></div>` : ""}${champ ? `<div class="champion">🏆 CHAMPION · <b data-team="${champ.id}" style="cursor:pointer">${esc(champ.name)}</b></div>` : ""}</div></div>`;

    const A = window.ARES;
    A.annotate(ms || [], t.status);
    window.__ms = ms || [];
    window.__t = t;
    const ko = (ms || []).filter(m => m._ko), lg = (ms || []).filter(m => !m._ko);
    const useScorePanel = t.format === "round_robin" || t.format === "group_playoffs";
    renderLeague(t, lg, teams || []);
    renderScorePanel(t, ms || []);
    $("t-bracket-sec").hidden = !ko.length && t.format !== "single_elimination";
    $("t-bracket-h").innerHTML = (lg.length ? "PLAYOFFS" : "BRACKET") + "<span>.</span>";
    const rounds = {};
    ko.forEach(m => (rounds[m.round] ||= []).push(m));
    const keys = Object.keys(rounds).sort((a, b) => a - b), last = keys[keys.length - 1];
    $("t-live").textContent = (ms || []).some(m => m._st === "live") ? "● LIVE NOW" : "";
    $("bracket").className = "bracket" + (!useScorePanel && A.admin.on ? " adm" : "");
    $("bracket").innerHTML = keys.length ? keys.map(r => `<div class="b-round ${r === last ? "to-champ" : ""}"><div class="b-title">${esc(rounds[r][0].round_name || "Round " + r)} <small>BO${rounds[r][0]._bo}</small></div><div class="b-matches">${rounds[r].map(m => {
      const w = m.winner_id, canEdit = !useScorePanel && A.admin.on && m.team1_id && m.team2_id && !m.is_bye;
      return `<div class="b-item"><div class="b-match ${m._st === "live" ? "is-live" : ""}"><div class="b-head"><span>${m.is_bye ? "BYE" : "MATCH " + m._no}</span><span>${m.is_bye ? "" : "BO" + m._bo}</span></div>${slot(m.team1, m.score1, w && w === m.team1_id)}${slot(m.team2, m.score2, w && w === m.team2_id, m.is_bye)}${canEdit ? `<div class="b-edit" data-mid="${m.id}"><select name="sc">${A.scoreOpts(m)}</select><input type="datetime-local" name="when" value="${dtLocal(m.scheduled_at)}" title="Jadwal — sinkron ke Live Matches"><button type="button" data-msave>SAVE</button></div>` : ""}<div class="b-foot">${m._st === "live" ? '<i class="live-dot"></i>LIVE' : m._st.toUpperCase()}${m.scheduled_at ? " · " + new Date(m.scheduled_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : ""}</div></div></div>`;
    }).join("")}</div></div>`).join("") + champCol(rounds[last][0]) : '<div class="empty-state">Bracket belum dibuat oleh admin.</div>';

    $("t-info").innerHTML = `${t.description ? `<div class="eyebrow">ABOUT</div><p class="prose">${esc(t.description)}</p>` : ""}
      ${t.rules ? `<div class="eyebrow" style="margin-top:28px">RULES</div><p class="prose" style="white-space:pre-line">${esc(t.rules)}</p>` : ""}
      ${(teams || []).length ? `<div class="eyebrow" style="margin-top:28px">PARTICIPATING TEAMS</div><div class="team-grid">${teams.map(x => `<article class="team-card" data-team="${x.id}" style="cursor:pointer">${logo(x, "lg")}<div><h3>${esc(x.name)}</h3><p>${esc(x.tag || "")}</p></div></article>`).join("")}</div>` : ""}`;
  }
  load();
  setInterval(load, 30000);
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-reset]"); if (!b) return; e.preventDefault();
    if (!confirm("Reset SEMUA skor turnamen ini? Skor, pemenang, dan juara dihapus (bracket awal tetap).")) return;
    try { await window.ARES.resetScores(b.dataset.reset); load(); } catch (err) { alert(err.message || err); }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-share]"); if (!b || b.dataset.share === "wa") return;
    const title = document.title, txt = "Bracket & skor live — ARES COMMUNITY";
    if (b.dataset.share === "native" && navigator.share) { try { await navigator.share({ title, text: txt, url: shareUrl }); } catch {} return; }
    try { await navigator.clipboard.writeText(shareUrl); const o = b.textContent; b.textContent = "COPIED ✓"; setTimeout(() => b.textContent = o, 1800); } catch { prompt("Salin link:", shareUrl); }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("#saveall"); if (!b) return;
    const rows = [...document.querySelectorAll("#t-scorepanel [data-mid]")];
    b.disabled = true; b.textContent = `SAVING 0/${rows.length}…`;
    let i = 0, fail = [];
    for (const box of rows) {
      i++; b.textContent = `SAVING ${i}/${rows.length}…`;
      const m = (window.__ms || []).find(x => x.id === box.dataset.mid);
      const [s1, s2] = box.querySelector('[name=sc]').value.split("-").map(Number);
      const whenEl = box.querySelector('[name=when]');
      try { await window.ARES.saveMatchResult(m, s1, s2, whenEl ? fromLocal(whenEl.value) : undefined); } catch (err) { fail.push((m?._no ? "M" + m._no : "?") + ": " + (err.message || err)); }
    }
    if (fail.length) alert("Sebagian gagal tersimpan:\n" + fail.join("\n"));
    load();
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("#genplayoffs"); if (!b) return;
    const k = +document.getElementById("qcount").value;
    try { b.disabled = true; const r = await window.ARES.generatePlayoffs((window.__t || {}).id, k); if (r) load(); }
    catch (err) { alert(err.message || err); }
    finally { if (b.isConnected) b.disabled = false; }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-export]"); if (!b) return;
    const target = document.getElementById(b.dataset.export); if (!target || !window.html2canvas) return alert("Export belum siap, coba lagi.");
    const old = b.innerHTML; b.innerHTML = "RENDERING…"; b.disabled = true;
    try {
      const canvas = await html2canvas(target, { backgroundColor: "#0b0c0e", scale: 2, useCORS: true, allowTaint: true, ignoreElements: (x) => x.hasAttribute("data-export") });
      const a = document.createElement("a"); a.download = `${(window.__t?.name || "ares").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${b.dataset.export}.png`; a.href = canvas.toDataURL("image/png"); a.click();
    } catch (err) { alert("Gagal export: " + (err.message || err)); }
    finally { b.innerHTML = old; b.disabled = false; }
  });
  window.addEventListener("ares-admin", load);
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-msave]"); if (!b) return;
    const box = b.closest("[data-mid]"), m = (window.__ms || []).find(x => x.id === box.dataset.mid), q = (n) => box.querySelector(`[name=${n}]`)?.value;
    try { b.disabled = true; const [s1, s2] = q("sc").split("-").map(Number); await window.ARES.saveMatchResult(m, s1, s2, q("when") !== undefined ? fromLocal(q("when")) : undefined); load(); }
    catch (err) { alert(err.message || err); b.disabled = false; }
  });
  client.channel("ares-t-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, load)
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, load).subscribe();
})();
