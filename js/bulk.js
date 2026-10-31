// Bulk add tim dari spreadsheet (Google Form responses). Rows = tim. Kolom dicocokkan otomatis, bisa diatur manual.
(function (root) {
  const SKIP = /timestamp|cap waktu|email|e-mail|whatsapp|\bwa\b|\bhp\b|phone|telp|telepon|kontak|contact|discord|server|instagram|alamat|kota|sekolah|kampus|setuju|bukti|bayar|username|\bid\b/;
  const FIELDS = [["team", "Nama tim"], ["tag", "Tag (opsional)"], ["logo", "Logo (link)"], ["captain", "Kapten"], ["capRole", "Role kapten"], ["roster", "Roster (1 kolom)"]]
    .concat(Array.from({ length: 7 }, (_, i) => [["n" + i, i < 5 ? `Pemain ${i + 1} · nickname` : `Cadangan ${i - 4} · nickname`], ["r" + i, i < 5 ? `Pemain ${i + 1} · role` : `Cadangan ${i - 4} · role`]]).flat());

  function parseDelimited(text) {
    text = text.replace(/^\uFEFF/, "");
    const first = text.split(/\r?\n/)[0] || "", cnt = (d) => first.split(d).length - 1;
    const delim = [["\t", cnt("\t")], [";", cnt(";")], [",", cnt(",")]].sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; rows.push(row); row = []; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  }

  function normRole(s) {
    s = String(s || "").toLowerCase(); if (!s.trim()) return null;
    if (/jung|\bjg\b|assassin|hutan/.test(s)) return "Jungler";
    if (/roam|support|\bsup\b|tank/.test(s)) return "Roamer";
    if (/gold|marksman|\bmm\b|\badc\b/.test(s)) return "Gold";
    if (/\bmid|mage/.test(s)) return "Mid";
    if (/exp|offlane|off lane|fighter/.test(s)) return "EXP";
    return null;
  }

  function driveUrl(s) {
    s = String(s || "").trim().split(/[,\s]+/)[0]; if (!s) return null;
    const m = s.match(/(?:[?&]id=|\/d\/|\/file\/d\/)([\w-]{20,})/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
    return /^https?:\/\//i.test(s) ? s : null;
  }

  function autoMap(headers) {
    const m = {}; FIELDS.forEach(([k]) => m[k] = -1);
    const low = headers.map(x => String(x || "").toLowerCase().trim()), used = new Set();
    const take = (k, i) => { m[k] = i; used.add(i); };
    low.forEach((x, i) => { if (m.logo < 0 && /logo|lambang|emblem|foto tim|gambar/.test(x)) take("logo", i); });
    low.forEach((x, i) => { if (!used.has(i) && m.tag < 0 && /\btag\b|singkatan|inisial|abbrev/.test(x)) take("tag", i); });
    low.forEach((x, i) => { if (!used.has(i) && m.roster < 0 && /roster|susunan|daftar pemain|line.?up/.test(x)) take("roster", i); });
    low.forEach((x, i) => { if (!used.has(i) && m.team < 0 && /nama\s*(tim|team|squad)|team\s*name|^(tim|team|squad)$/.test(x)) take("team", i); });
    if (m.team < 0) low.forEach((x, i) => { if (!used.has(i) && m.team < 0 && /\b(tim|team|squad)\b/.test(x) && !/kapten|captain|ketua|pemain|player/.test(x) && !SKIP.test(x)) take("team", i); });
    low.forEach((x, i) => {
      if (used.has(i)) return;
      const isCap = /kapten|captain|ketua|leader/.test(x), isRole = /role|posisi|lane|peran/.test(x);
      if (SKIP.test(x) && !isRole) return;
      if (isRole && /server/.test(x)) return;
      const isSub = /\b(cadangan|substitute|substitusi|sub|reserve|bench|cad)\b/.test(x), num = (x.match(/(\d+)/) || [])[1];
      let slot = -1;
      if (isSub) slot = 4 + (num ? +num : 1); else if (num) slot = +num - 1;
      if (slot >= 0 && slot <= 6 && (isRole || isCap || /nick|ign|nama|pemain|player|anggota|member|in.?game|name/.test(x))) {
        const k = (isRole ? "r" : "n") + slot;
        if (m[k] < 0) { take(k, i); if (isCap && !isRole && m.captain < 0) m.captain = i; if (isCap && isRole && m.capRole < 0) m.capRole = i; }
        return;
      }
      if (isCap) { if (isRole) { if (m.capRole < 0) take("capRole", i); } else if (m.captain < 0) take("captain", i); }
    });
    return m;
  }

  function parseRoster(cell, warns) {
    const segs = String(cell || "").split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);
    const parts = segs.length === 1 && segs[0].includes(",") ? segs[0].split(",").map(s => s.trim()).filter(Boolean) : segs;
    return parts.map((s, i) => {
      s = s.replace(/^\s*\d+\s*[.)\-:]\s*/, "");
      const rm = s.match(/jungler?|\bjg\b|roam\w*|support|tank|gold\s*lane|gold|\bmid\w*|exp\s*lane|exp|offlane/i);
      const role = rm ? normRole(rm[0]) : null;
      let nick = (rm ? s.replace(rm[0], "") : s).replace(/[()\[\]|:–—-]+/g, " ").replace(/\s{2,}/g, " ").trim();
      const sub = /cadangan|substitute|\bsub\b/i.test(s); nick = nick.replace(/cadangan|substitute|\bsub\b/ig, "").trim();
      if (!role) warns.push(`role tidak terbaca (${nick || s})`);
      return { nickname: nick || s, role, is_sub: sub || i >= 5, is_captain: false };
    }).filter(p => p.nickname);
  }

  const autoTag = (n) => { const w = n.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/); return (w.length > 1 ? w.map(x => x[0]).join("") : n.replace(/[^\p{L}\p{N}]/gu, "")).slice(0, 4).toUpperCase(); };

  function buildTeams(rows, map) {
    const g = (r, k) => map[k] >= 0 ? String(r[map[k]] ?? "").trim() : "";
    return rows.slice(1).map((r, idx) => {
      const name = g(r, "team"); if (!name) return null;
      const warns = []; let players = [];
      for (let i = 0; i < 7; i++) {
        const nick = g(r, "n" + i); if (!nick) continue;
        const rr = g(r, "r" + i), role = normRole(rr);
        if (rr && !role) warns.push(`role "${rr}" tidak dikenali (${nick})`); else if (!rr) warns.push(`role kosong (${nick})`);
        players.push({ nickname: nick, role, is_sub: i >= 5, is_captain: false });
      }
      if (!players.length && map.roster >= 0) players = parseRoster(g(r, "roster"), warns);
      const cap = g(r, "captain");
      if (cap) {
        const lc = cap.toLowerCase();
        let p = players.find(x => x.nickname.toLowerCase() === lc) || players.find(x => !x.is_sub && (x.nickname.toLowerCase().includes(lc) || lc.includes(x.nickname.toLowerCase())));
        if (p) p.is_captain = true;
        else if (players.filter(x => !x.is_sub).length < 5) players.unshift({ nickname: cap, role: normRole(g(r, "capRole")), is_sub: false, is_captain: true });
        else warns.push(`kapten "${cap}" tidak cocok dengan pemain`);
      }
      let main = players.filter(x => !x.is_sub), subs = players.filter(x => x.is_sub);
      if (main.length > 5) { subs = main.slice(5).map(x => ({ ...x, is_sub: true })).concat(subs); main = main.slice(0, 5); }
      if (subs.length > 2) { warns.push("cadangan > 2, sisanya dibuang"); subs = subs.slice(0, 2); }
      if (main.length < 5) warns.push(`pemain utama baru ${main.length}/5`);
      players = main.concat(subs).map((p, i) => ({ ...p, sort_order: i }));
      return { row: idx, no: idx + 1, name, tag: (g(r, "tag") || autoTag(name)).slice(0, 6).toUpperCase(), logo_url: driveUrl(g(r, "logo")), captain: cap, players, warns };
    }).filter(Boolean);
  }

  const api = { parseDelimited, autoMap, buildTeams, normRole, driveUrl, parseRoster, FIELDS };
  if (typeof module !== "undefined") { module.exports = api; return; }

  // ---------------- UI ----------------
  root.ARES_BULK = {
    ...api,
    open(panel, ctx) {
      const esc = ctx.esc, S = { text: "", rows: [], map: null, teams: [], checked: new Set() };
      const existingNames = new Set(ctx.existing.map(t => (t.name || "").trim().toLowerCase()));
      const roleTxt = (p) => `${esc(p.nickname)}${p.is_captain ? " ★" : ""} <i>${p.role || "?"}</i>`;
      function view() {
        const hdr = S.rows[0] || [];
        const opts = (sel) => `<option value="-1">— tidak ada —</option>` + hdr.map((h, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${esc(String(h).slice(0, 48) || "(kolom " + (i + 1) + ")")}</option>`).join("");
        const remain = ctx.tournament.max_teams ? ctx.tournament.max_teams - ctx.existing.length : null;
        panel.innerHTML = `<div class="a-card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><h3>BULK ADD → ${esc(ctx.tournament.name)}</h3><button class="btn-ghost" id="bk-back">← KEMBALI</button></div>
          <small style="color:#888;display:block;margin-bottom:12px">Satu baris = satu tim (data Google Form). Tim sekarang: ${ctx.existing.length}${ctx.tournament.max_teams ? " / " + ctx.tournament.max_teams : ""}.</small>
          <div class="eyebrow">1 · SUMBER DATA</div>
          <label>Tempel dari Google Sheets (blok semua baris termasuk header, Ctrl+C lalu Ctrl+V)<textarea id="bk-text" rows="5" placeholder="Timestamp&#9;Nama Tim&#9;Logo&#9;Kapten&#9;Pemain 1 ...">${esc(S.text)}</textarea></label>
          <div class="row2"><label>atau file CSV (File → Download → .csv)<input id="bk-file" type="file" accept=".csv,.tsv,.txt"></label>
          <label>atau link Google Sheet (harus “siapa saja dengan link”)<input id="bk-url" placeholder="https://docs.google.com/spreadsheets/d/..."></label></div>
          <button class="btn-primary" id="bk-read">BACA DATA</button> <button class="btn-ghost" id="bk-fetch" type="button">AMBIL DARI LINK</button>
          ${S.rows.length ? `<div class="eyebrow" style="margin-top:24px">2 · KOLOM TERDETEKSI <small style="color:#777">(ubah bila salah)</small></div>
          <details ${S.map.team < 0 ? "open" : ""}><summary style="cursor:pointer;color:var(--gold);font-size:11px;letter-spacing:1px;margin:8px 0">PENGATURAN KOLOM</summary><div class="bk-map">${FIELDS.map(([k, l]) => `<label>${l}<select data-map="${k}">${opts(S.map[k])}</select></label>`).join("")}</div></details>
          <div class="eyebrow" style="margin-top:20px">3 · PREVIEW · ${S.teams.length} TIM</div>
          ${S.map.team < 0 ? '<div class="empty-state">Kolom “Nama tim” belum terdeteksi — pilih di Pengaturan Kolom.</div>' : `<div style="overflow-x:auto"><table class="bulk-table"><tr><th></th><th>NO</th><th>LOGO</th><th>TIM</th><th>KAPTEN</th><th>ROSTER</th><th>CATATAN</th></tr>${S.teams.map(t => { const dup = existingNames.has(t.name.toLowerCase()); return `<tr class="${dup ? "dim" : ""}"><td><input type="checkbox" data-row="${t.row}" ${S.checked.has(t.row) ? "checked" : ""}></td><td>${t.no}</td><td>${t.logo_url ? `<img src="${esc(t.logo_url)}" onerror="this.replaceWith(document.createTextNode('✕'))" alt="">` : "—"}</td><td><b>${esc(t.name)}</b><small>${esc(t.tag)}</small></td><td>${esc(t.captain || "—")}</td><td>${t.players.map(p => `<span class="chip ${p.is_sub ? "sub" : ""}">${roleTxt(p)}</span>`).join("") || "—"}</td><td class="warn">${dup ? "SUDAH ADA · " : ""}${t.warns.map(esc).join("<br>")}</td></tr>`; }).join("")}</table></div>
          <small style="color:#888;display:block;margin:10px 0">Logo dari Google Drive hanya tampil publik bila file/folder dibagikan “siapa saja dengan link”. Logo yang gagal (✕) bisa diupload manual lewat Edit tim.</small>
          <button class="btn-primary" id="bk-import">IMPORT ${S.checked.size} TIM</button>${remain !== null ? ` <small style="color:#888">sisa slot: ${remain}</small>` : ""}`}` : ""}</div>`;
        bind();
      }
      function load(text) {
        S.text = text; S.rows = parseDelimited(text);
        if (S.rows.length < 2) { ctx.toast("Data kosong / hanya header.", true); S.rows = []; return view(); }
        S.map = autoMap(S.rows[0]); recompute(true);
      }
      function recompute(resetChecks) {
        S.teams = buildTeams(S.rows, S.map);
        if (resetChecks) S.checked = new Set(S.teams.filter(t => !existingNames.has(t.name.toLowerCase())).map(t => t.row));
        view();
      }
      function bind() {
        const $ = (s) => panel.querySelector(s);
        $("#bk-back").onclick = () => ctx.done();
        $("#bk-read").onclick = () => load($("#bk-text").value);
        $("#bk-file").onchange = async (e) => { const f = e.target.files[0]; if (f) load(await f.text()); };
        $("#bk-fetch").onclick = async () => {
          const u = $("#bk-url").value.trim(), id = (u.match(/\/d\/([\w-]+)/) || [])[1], gid = (u.match(/gid=(\d+)/) || [])[1];
          if (!id) return ctx.toast("Link Google Sheet tidak valid.", true);
          try { const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? "&gid=" + gid : ""}`); if (!r.ok) throw new Error(r.status); load(await r.text()); }
          catch (e) { ctx.toast("Gagal ambil dari link (sheet belum publik / diblokir). Pakai tempel atau file CSV.", true); }
        };
        panel.querySelectorAll("[data-map]").forEach(s => s.onchange = () => { S.map[s.dataset.map] = +s.value; recompute(true); });
        panel.querySelectorAll("[data-row]").forEach(c => c.onchange = () => { c.checked ? S.checked.add(+c.dataset.row) : S.checked.delete(+c.dataset.row); const b = panel.querySelector("#bk-import"); if (b) b.textContent = `IMPORT ${S.checked.size} TIM`; });
        const imp = $("#bk-import"); if (imp) imp.onclick = () => doImport(imp);
      }
      async function doImport(btn) {
        const sel = S.teams.filter(t => S.checked.has(t.row));
        try {
          if (!sel.length) throw new Error("Pilih minimal 1 tim.");
          const max = ctx.tournament.max_teams;
          if (max && ctx.existing.length + sel.length > max) throw new Error(`Melebihi kapasitas turnamen (${max}). Sekarang ${ctx.existing.length}, akan menambah ${sel.length}.`);
          btn.disabled = true; btn.textContent = "IMPORTING…";
          const { data: ins, error } = await ctx.sb.from("teams").insert(sel.map(t => ({ name: t.name, tag: t.tag, logo_url: t.logo_url, tournament_id: ctx.tournament.id }))).select("id");
          if (error) throw error;
          const pl = []; sel.forEach((t, i) => t.players.forEach(p => pl.push({ team_id: ins[i].id, nickname: p.nickname, role: p.role, is_sub: p.is_sub, is_captain: p.is_captain, sort_order: p.sort_order })));
          if (pl.length) { const { error: e2 } = await ctx.sb.from("players").insert(pl); if (e2) { await ctx.sb.from("teams").delete().in("id", ins.map(x => x.id)); throw e2; } }
          ctx.toast(`${sel.length} tim & ${pl.length} pemain berhasil diimport`); ctx.done();
        } catch (e) { ctx.toast(ctx.fmtErr(e), true); btn.disabled = false; btn.textContent = `IMPORT ${S.checked.size} TIM`; }
      }
      view();
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
