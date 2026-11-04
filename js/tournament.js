(() => {
  const { client, esc, money, logo } = window.ARES;
  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id");
  if (!client || !id) { $("t-head").innerHTML = '<div class="empty-state">Turnamen tidak ditemukan atau Supabase belum terhubung.</div>'; $("bracket").innerHTML = ""; return; }

  const slot = (t, score, win, bye, ph) => `<div class="slot ${win ? "win" : ""} ${t ? "" : "tbd"}" ${t ? `data-team="${t.id}"` : ""}>${t ? logo(t) : '<span class="team-emblem">?</span>'}<span class="slot-name">${t ? esc(t.name) : (bye ? "BYE" : ph ? esc(ph) : "TBD")}</span><b>${t ? Number(score || 0) : ""}</b></div>`;

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
      const name = `<td class="tl tm" data-team="${r.team.id}">${logo(r.team)}<span>${esc(r.team.name)}</span>${champ ? ' <i class="ico ico-trophy"></i>' : ""}</td>`;
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
      const groups = {}; ko.forEach(m => (groups[m.bracket_side === "third" ? "third" : m.round] ||= []).push(m));
      boxes += Object.keys(groups).sort((a, b) => (a === "third") - (b === "third") || a - b).map(r => {
        const ms = groups[r].sort((a, b) => a.position - b.position);
        return spBox(ms[0].round_name || ("Round " + r), ms);
      }).join("");
    }
    el.innerHTML = `<div class="section-heading"><div><div class="eyebrow">ADMIN ONLY</div><h2>SET SCORES<span>.</span></h2></div>${boxes ? '<button type="button" class="btn-primary" id="saveall">SAVE ALL</button>' : ""}</div>${genBar}${boxes ? `<div class="sp-grid">${boxes}</div>` : '<p class="hint">Belum ada match playoff — generate dulu dari klasemen grup.</p>'}`;
    el.hidden = false;
  }
  // Satu kartu match bracket (dipakai single elim, double elim, dan grand final). useScorePanel: true = jangan tampilin edit inline.
  const bItem = (m, A, useScorePanel) => {
    const w = m.winner_id, canEdit = !useScorePanel && A.admin.on && m.team1_id && m.team2_id && !m.is_bye;
    return `<div class="b-item"><div class="b-match ${m._st === "live" ? "is-live" : ""}"><div class="b-head"><span>${m.is_bye ? "BYE" : "MATCH " + (m._no ?? "")}</span><span>${m.is_bye ? "" : "BO" + m._bo}</span></div>${slot(m.team1, m.score1, w && w === m.team1_id, false, m._ph1)}${slot(m.team2, m.score2, w && w === m.team2_id, m.is_bye, m._ph2)}${canEdit ? `<div class="b-edit" data-mid="${m.id}"><select name="sc">${A.scoreOpts(m)}</select><input type="datetime-local" name="when" value="${dtLocal(m.scheduled_at)}" title="Jadwal — sinkron ke Live Matches"><button type="button" data-msave>SAVE</button></div>` : ""}<div class="b-foot">${m._st === "live" ? '<i class="live-dot"></i>LIVE' : m._st.toUpperCase()}${m.scheduled_at ? " · " + new Date(m.scheduled_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : ""}</div></div></div>`;
  };
  // Double elimination: Winners Bracket + Losers Bracket ditampilkan sebagai dua baris terpisah, lalu Grand Final + Champion.
  function renderDoubleElim(t, ms, A) {
    const pin = ms.filter(m => m.bracket_side === "playin").sort((a, b) => a.position - b.position);
    const wb = ms.filter(m => m.bracket_side === "winners").sort((a, b) => a.round - b.round || a.position - b.position);
    const lb = ms.filter(m => m.bracket_side === "losers").sort((a, b) => a.round - b.round || a.position - b.position);
    const gf = ms.find(m => m.bracket_side === "final");
    if (!wb.length) return '<div class="empty-state">Bracket belum dibuat oleh admin.</div>';
    const rowHtml = (list, label) => {
      const rounds = {}; list.forEach(m => (rounds[m.round] ||= []).push(m));
      const keys = Object.keys(rounds).sort((a, b) => a - b);
      return `<div class="eyebrow" style="margin:0 0 10px">${label}</div><div class="bracket${A.admin.on ? " adm" : ""}">${keys.map(r => `<div class="b-round"><div class="b-title">${esc(rounds[r][0].round_name)} <small>BO${rounds[r][0]._bo}</small></div><div class="b-matches">${rounds[r].map(m => bItem(m, A, false)).join("")}</div></div>`).join("")}</div>`;
    };
    let html = "";
    if (pin.length) html += `<div class="de-row">${rowHtml(pin, "PLAY-IN")}</div>`;
    html += `<div class="de-row" ${pin.length ? 'style="margin-top:36px"' : ""}>${rowHtml(wb, "WINNERS BRACKET")}</div>`;
    if (lb.length) html += `<div class="de-row" style="margin-top:36px">${rowHtml(lb, "LOSERS BRACKET")}</div>`;
    if (gf) html += `<div class="de-row" style="margin-top:36px"><div class="eyebrow" style="margin:0 0 10px">GRAND FINAL</div><div class="bracket${A.admin.on ? " adm" : ""}"><div class="b-round"><div class="b-title">Grand Final <small>BO${gf._bo}</small></div><div class="b-matches">${bItem(gf, A, false)}</div></div>${champCol(gf)}</div></div>`;
    return html;
  }
  // Hybrid Elimination ala Playoff MPL: satu kanvas melebar ke samping. Upper Bracket di atas, Lower Bracket di bawahnya,
  // keduanya nyambung ke Grand Final → Champion. Konektor digambar JS (div garis) supaya tetap pas walau tinggi kartu beda-beda.
  const hyMatches = (ms) => {
    const pick = (side, round, pos) => ms.find(m => m.bracket_side === side && m.round === round && m.position === pos);
    const k = { m1: pick("playin", 1, 1), m2: pick("playin", 1, 2), m3: pick("winners", 1, 1), m4: pick("winners", 1, 2), m5: pick("losers", 1, 1), m6: pick("winners", 2, 1), m7: pick("losers", 2, 1), m8: ms.find(m => m.bracket_side === "final") };
    return Object.values(k).every(Boolean) && ms.length === 8 ? k : null;
  };
  function renderHybrid(k, A) {
    const cell = (key, cls, col, row, span) => `<div class="hy-cell ${cls || ""}" data-hy="${key}" style="grid-column:${col};grid-row:${row}${span ? "/span " + span : ""}">${bItem(k[key], A, false)}</div>`;
    const ttl = (txt, bo, col, row) => `<div class="b-title hy-title" style="grid-column:${col};grid-row:${row}">${txt}${bo ? ` <small>BO${bo}</small>` : ""}</div>`;
    return `<div class="hy${A.admin.on ? " adm" : ""}">`
      + ttl("PLAY-IN", k.m1._bo, 1, 1) + ttl("UPPER BRACKET", k.m3._bo, 2, 1) + ttl("UPPER FINAL", k.m6._bo, 3, 1) + ttl("GRAND FINAL", k.m8._bo, 4, 1) + ttl("CHAMPION", 0, 5, 1)
      + cell("m1", "", 1, 2) + cell("m2", "", 1, 3)
      + cell("m3", "", 2, 2) + cell("m4", "", 2, 3)
      + cell("m6", "mid", 3, "2/span 2")
      + ttl("LOWER BRACKET", k.m5._bo, 2, 4).replace('class="b-title hy-title"', 'class="b-title hy-title lower"') + ttl("LOWER FINAL", k.m7._bo, 3, 4).replace('class="b-title hy-title"', 'class="b-title hy-title lower"')
      + cell("m5", "", 2, 5) + cell("m7", "", 3, 5)
      + `<div class="hy-cell mid" data-hy="m8" style="grid-column:4;grid-row:2/span 4">${bItem(k.m8, A, false)}</div>`
      + `<div class="hy-cell mid" data-hy="champ" style="grid-column:5;grid-row:2/span 4">${champCol(k.m8).replace('class="b-round is-last champ-col"', 'class="champ-col"').replace(/<div class="b-title">CHAMPION<\/div>/, "")}</div>`
      + `</div>`;
  }
  function drawHybridLines() {
    const hy = document.querySelector("#bracket .hy"); if (!hy) return;
    hy.querySelectorAll(".hy-line").forEach(x => x.remove());
    const box = hy.getBoundingClientRect(), kz = (box.width / hy.offsetWidth) || 1, card = (key) => { const c = hy.querySelector(`[data-hy="${key}"] .b-match`); return c && c.getBoundingClientRect(); };
    const line = (x, y, w, h) => { const d = document.createElement("div"); d.className = "hy-line"; d.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.max(2, Math.round(w))}px;height:${Math.max(2, Math.round(h))}px`; hy.appendChild(d); };
    // from -> to : keluar dari tepi kanan kartu asal, siku di tengah celah, masuk ke tepi kiri kartu tujuan
    const link = (from, to) => {
      const a = card(from), b = card(to); if (!a || !b) return;
      const x1 = (a.right - box.left) / kz, y1 = (a.top + a.height / 2 - box.top) / kz, x2 = (b.left - box.left) / kz, y2 = (b.top + b.height / 2 - box.top) / kz, mx = (x1 + x2) / 2;
      line(x1, y1 - 1, mx - x1 + 1, 2);
      if (Math.abs(y2 - y1) > 1) line(mx - 1, Math.min(y1, y2) - 1, 2, Math.abs(y2 - y1) + 2);
      line(mx, y2 - 1, x2 - mx, 2);
    };
    [["m1", "m3"], ["m2", "m4"], ["m3", "m6"], ["m4", "m6"], ["m5", "m7"], ["m6", "m8"], ["m7", "m8"], ["m8", "champ"]].forEach(([f, t]) => link(f, t));
  }
  // Scroll mouse (roda vertikal) menggeser bracket ke samping; di ujung kiri/kanan halaman lanjut scroll biasa.
  const bw = $("t-bracket-wrap");
  if (bw) bw.addEventListener("wheel", (e) => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!dx || bw.scrollWidth <= bw.clientWidth) return;
    const max = bw.scrollWidth - bw.clientWidth;
    if ((dx < 0 && bw.scrollLeft <= 0) || (dx > 0 && bw.scrollLeft >= max - 1)) return;
    e.preventDefault(); bw.scrollLeft += dx;
  }, { passive: false });
  // Highlight jalur tim: klik tim di bracket → semua match tim itu menyala, sisanya redup. Klik lagi tim yg sama = buka roster. Klik area kosong = reset.
  let hlTeam = null;
  const applyHl = () => {
    const root = $("bracket"); if (!root) return;
    root.classList.toggle("hl-on", !!hlTeam);
    root.querySelectorAll(".b-match").forEach(c => { const on = !!hlTeam && !!c.querySelector(`.slot[data-team="${hlTeam}"]`); c.classList.toggle("hl", on); c.classList.toggle("dim", !!hlTeam && !on); });
    root.querySelectorAll(".slot").forEach(x => x.classList.toggle("hl-slot", !!hlTeam && x.dataset.team === hlTeam));
  };
  if (bw) bw.addEventListener("click", (e) => {
    const el = e.target.closest("[data-team]");
    if (!el && e.target.closest(".b-edit, button, select, input, a")) return;
    if (!el || !el.dataset.team) { if (hlTeam) { hlTeam = null; applyHl(); } return; }
    if (hlTeam === el.dataset.team) { hlTeam = null; applyHl(); return; } // lanjut ke handler roster
    e.stopPropagation(); e.preventDefault(); hlTeam = el.dataset.team; applyHl();
  }, true);
  window.addEventListener("resize", () => applyZoom());
  // Zoom bracket: AUTO (layar <=820px muat lebar layar), tombol − / + / FIT / klik persen = 100%. Pakai transform + sizer supaya scroll tetap benar.
  const zoomEl = $("t-zoom"), sizer = $("t-zsize"), zs = { mode: "auto", k: 1, cur: 1 };
  function applyZoom(force) {
    if (!zoomEl || !sizer || !bw) return;
    const W = zoomEl.scrollWidth, H = zoomEl.offsetHeight, avail = bw.clientWidth || W;
    let k = force != null ? force : zs.mode === "fit" || (zs.mode === "auto" && window.innerWidth <= 820) ? Math.min(1, avail / W) : zs.mode === "auto" ? 1 : zs.k;
    k = Math.max(.1, Math.min(1.5, k)); zs.cur = k;
    zoomEl.style.transformOrigin = "0 0"; zoomEl.style.transform = k === 1 ? "" : `scale(${k})`;
    sizer.style.width = Math.ceil(W * k) + "px"; sizer.style.height = Math.ceil(H * k) + "px";
    const pc = $("t-zpct"); if (pc) pc.textContent = Math.round(k * 100) + "%";
    drawHybridLines();
  }
  const zc = $("t-zoomctl");
  if (zc) zc.addEventListener("click", (e) => {
    const b = e.target.closest("[data-z]"); if (!b) return; const z = b.dataset.z;
    if (z === "fit") zs.mode = "fit"; else { zs.mode = "manual"; zs.k = z === "reset" ? 1 : zs.cur * (z === "in" ? 1.25 : .8); }
    applyZoom();
  });
  window.__zoomExport = () => { applyZoom(1); bw.classList.add("exporting"); return () => { bw.classList.remove("exporting"); applyZoom(); }; }; // export PNG selalu 100% & tidak terpotong
  if (window.ResizeObserver && zoomEl) new ResizeObserver(() => applyZoom()).observe(zoomEl);
  async function load() {
    const [{ data: t, error }, { data: ms }, { data: teams }] = await Promise.all([
      client.from("tournaments").select("*").eq("id", id).single(),
      client.from("matches").select("*, team1:teams!matches_team1_id_fkey(id,name,tag,logo_url), team2:teams!matches_team2_id_fkey(id,name,tag,logo_url)").eq("tournament_id", id).order("round").order("position"),
      client.from("teams").select("id,name,tag,logo_url").eq("tournament_id", id).order("created_at")
    ]);
    if (error || !t) { $("t-head").innerHTML = '<div class="empty-state">Turnamen tidak ditemukan.</div>'; return; }
    document.title = `${t.name} — ARES COMMUNITY`;
    const champ = t.champion_id && (teams || []).find(x => x.id === t.champion_id);
    const tm3 = (ms || []).find(m => m.bracket_side === "third" && m.winner_id), third3 = tm3 && (tm3.winner_id === tm3.team1_id ? tm3.team1 : tm3.team2);
    $("t-head").innerHTML = `<div class="t-hero" ${t.banner_url ? `style="background-image:linear-gradient(90deg,#0b0c0ef2,#0b0c0e99),url('${esc(t.banner_url)}')"` : ""}>
      ${t.logo_url ? `<img class="t-logo" src="${esc(t.logo_url)}" alt="">` : ""}
      <div><div class="eyebrow">${t.game ? esc(t.game.toUpperCase()) + " · " : ""}${esc((t.format || "").replaceAll("_", " ").toUpperCase())} · ${esc((t.status || "upcoming").toUpperCase())}</div>
      <h1 class="t-title">${esc(t.name)}</h1>
      <div class="t-meta"><span>PRIZE POOL <b>Rp ${money(t.prize_pool)}</b></span>${t.start_date ? `<span>START <b>${new Date(t.start_date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</b></span>` : ""}<span>TEAMS <b>${(teams || []).length}${t.max_teams ? " / " + t.max_teams : ""}</b></span></div>
      <div class="share-bar"><button type="button" data-share="native">SHARE</button><a data-share="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${t.name} — bracket & skor live di ARES COMMUNITY\n${shareUrl}`)}">WHATSAPP</a><button type="button" data-share="copy">COPY LINK</button></div>${window.ARES.admin.on ? `<div class="admin-bar"><a href="admin.html#tournaments">Edit / Generate bracket ↗</a><a href="admin.html#teams:${t.id}">Kelola tim ↗</a><a href="admin.html#matches:${t.id}">Semua match ↗</a><a href="#" data-reset="${t.id}">Reset semua skor</a></div>` : ""}${champ ? `<div class="champion"><i class="ico ico-trophy"></i> CHAMPION · <b data-team="${champ.id}" style="cursor:pointer">${esc(champ.name)}</b>${third3 ? ` &nbsp;·&nbsp; <i class="ico ico-trophy bronze"></i> JUARA 3 · <b data-team="${third3.id}" style="cursor:pointer">${esc(third3.name)}</b>` : ""}</div>` : ""}</div></div>`;

    const A = window.ARES;
    A.annotate(ms || [], t.status);
    window.__ms = ms || [];
    window.__t = t;
    const ko = (ms || []).filter(m => m._ko), lg = (ms || []).filter(m => !m._ko);
    const useScorePanel = t.format === "round_robin" || t.format === "group_playoffs";
    renderLeague(t, lg, teams || []);
    renderScorePanel(t, ms || []);
    const isDE = t.format === "double_elimination" || t.format === "hybrid_elimination";
    $("t-bracket-sec").hidden = !ko.length && !isDE && t.format !== "single_elimination";
    $("t-bracket-h").innerHTML = (lg.length ? "PLAYOFFS" : "BRACKET") + "<span>.</span>";
    $("t-live").textContent = (ms || []).some(m => m._st === "live") ? "● LIVE NOW" : "";
    if (isDE) {
      $("bracket").className = "de-wrap";
      const hk = t.format === "hybrid_elimination" ? hyMatches(ko) : null; // bracket Hybrid lama (struktur lain) tetap jatuh ke tampilan baris biasa
      $("bracket").innerHTML = hk ? renderHybrid(hk, A) : renderDoubleElim(t, ko, A);
      if (hk) { drawHybridLines(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawHybridLines); }
    } else {
      const rounds = {};
      ko.filter(m => m.bracket_side !== "third").forEach(m => (rounds[m.round] ||= []).push(m));
      const keys = Object.keys(rounds).sort((a, b) => a - b), last = keys[keys.length - 1];
      $("bracket").className = "bracket" + (!useScorePanel && A.admin.on ? " adm" : "");
      $("bracket").innerHTML = keys.length ? keys.map(r => `<div class="b-round ${r === last ? "to-champ" : ""}"><div class="b-title">${esc(rounds[r][0].round_name || "Round " + r)} <small>BO${rounds[r][0]._bo}</small></div><div class="b-matches">${rounds[r].map(m => bItem(m, A, useScorePanel)).join("")}</div></div>`).join("") + champCol(rounds[last][0]) : '<div class="empty-state">Bracket belum dibuat oleh admin.</div>';
    }

    // Perebutan Juara 3 (single elim / playoff grup): kartu terpisah di bawah bracket utama
    const thirdEl = $("t-third"), th = isDE ? null : ko.find(m => m.bracket_side === "third");
    if (thirdEl) { thirdEl.hidden = !th; thirdEl.innerHTML = th ? `<div class="eyebrow" style="margin:0 0 10px">PEREBUTAN JUARA 3 <small style="color:#777;margin-left:6px">BO${th._bo}</small></div><div class="third-card${A.admin.on && !useScorePanel ? " adm" : ""}">${bItem(th, A, useScorePanel)}</div>${th.winner_id ? `<div class="champion" style="margin-top:6px"><i class="ico ico-trophy bronze"></i> JUARA 3 · <b data-team="${th.winner_id}" style="cursor:pointer">${esc((th.winner_id === th.team1_id ? th.team1 : th.team2)?.name || "")}</b></div>` : ""}` : ""; }
    applyZoom();
    // Predictions (on/off dari setting turnamen)
    const pe = $("t-predict"); if (pe) { pe.hidden = !t.predictions_enabled; if (t.predictions_enabled) window.ARES.renderPredict($("t-predict-body"), t, teams || []); }
    applyHl();
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
    const zoomBack = b.dataset.export === "t-bracket-wrap" && window.__zoomExport ? window.__zoomExport() : null;
    const imgs = [...target.querySelectorAll("img")], restore = [];
    try {
      // Fetch tiap logo jadi data-URL dulu — <img> biasa (tanpa crossorigin) gak bisa dibaca langsung oleh canvas.
      await Promise.all(imgs.map(async (img) => {
        const src = img.src; if (!src || src.startsWith("data:")) return;
        try {
          const res = await fetch(src, { mode: "cors", cache: "force-cache" });
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
          restore.push([img, src]); img.src = dataUrl;
        } catch { /* gagal diambil — biarkan src asli, logo itu mungkin tetap tidak tampil di hasil export */ }
      }));
      const canvas = await html2canvas(target, { backgroundColor: "#0b0c0e", scale: 2, useCORS: true, allowTaint: false, ignoreElements: (x) => x.hasAttribute("data-export") });
      const a = document.createElement("a"); a.download = `${(window.__t?.name || "ares").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${b.dataset.export}.png`; a.href = canvas.toDataURL("image/png"); a.click();
    } catch (err) { alert("Gagal export: " + (err.message || err)); }
    finally { restore.forEach(([img, src]) => img.src = src); if (zoomBack) zoomBack(); b.innerHTML = old; b.disabled = false; }
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
