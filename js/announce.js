/* Pengumuman WhatsApp: jadwal & hasil. Murni teks, tanpa DB. */
(function () {
  const TZ = "Asia/Jakarta";
  const parts = (iso) => {
    if (!iso) return null;
    const d = new Date(iso); if (isNaN(d)) return null;
    const f = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const o = {}; f.formatToParts(d).forEach(p => { o[p.type] = p.value; });
    return { key: `${o.year}-${o.month}-${o.day} ${o.hour}.${o.minute}`, date: `${o.weekday}, ${o.day} ${o.month} ${o.year}`, time: `${o.hour}.${o.minute} WIB` };
  };
  const sep = (n) => { const e = "=".repeat(Math.max(3, 8 - String(n).length)); return `*${e} ${n} ${e}*`; };
  const BAR = "*================*";
  const STATUS = { scheduled: "UPCOMING", live: "LIVE", completed: "COMPLETED" };
  const uniq = (a) => [...new Set(a.filter(Boolean))];

  // matches: sudah di-annotate (_no,_st,_bo,round_name). info: { teamId: {captain, contact} }
  // opt: { mode: "schedule"|"result", title, closing, merge, stage }
  function build(matches, info, opt) {
    const o = Object.assign({ mode: "schedule", title: "TOURNAMENT", closing: "", merge: false }, opt || {});
    const isRes = o.mode === "result";
    const list = matches.filter(m => !m.is_bye && m.team1_id && m.team2_id && (isRes ? m._st === "completed" : m._st !== "completed"))
      .filter(m => !o.stage || m.round_name === o.stage)
      .sort((a, b) => (a.scheduled_at || "￿").localeCompare(b.scheduled_at || "￿") || a._no - b._no);
    if (!list.length) return [];
    const groups = [];
    if (o.merge) groups.push(list);
    else { const map = new Map(); list.forEach(m => { const k = parts(m.scheduled_at)?.key || "TBA"; if (!map.has(k)) map.set(k, []); map.get(k).push(m); }); map.forEach(v => groups.push(v)); }
    const closing = o.closing != null && o.closing !== "" ? o.closing : (isRes ? "GG to all teams!" : "Good luck to all teams!");
    return groups.map(g => {
      const p0 = parts(g[0].scheduled_at), bos = uniq(g.map(m => "BO" + m._bo));
      const mixedTime = new Set(g.map(m => parts(m.scheduled_at)?.key || "TBA")).size > 1;
      const dates = uniq(g.map(m => parts(m.scheduled_at)?.date));
      const status = uniq(g.map(m => STATUS[m._st] || "UPCOMING")).join(" / ");
      const L = [];
      L.push(`⚔️ *${o.title}* ⚔️`, `📢 *OFFICIAL MATCH ${isRes ? "RESULT" : "INFORMATION"}*`, "", BAR);
      L.push(`*Stage:* ${uniq(g.map(m => m.round_name)).join(" / ")}`);
      L.push(`*Date:* ${dates.length ? dates.join(" / ") : "TBA"}`);
      if (!isRes || p0) L.push(`*Time:* ${mixedTime ? "Lihat tiap match" : (p0 ? p0.time : "TBA")}`);
      L.push(`*Match Format:* ${bos.join(" / ")}`, `*Status:* ${status}`, BAR, `*_${isRes ? "Result" : "List Match"}:_*`);
      g.forEach(m => {
        const n1 = m.team1?.name || "TBD", n2 = m.team2?.name || "TBD";
        L.push(sep(m._no), `> *Match ID:* M${m._no}`, `> *Match:* ${n1} vs ${n2}`);
        if (mixedTime) { const p = parts(m.scheduled_at); L.push(`> *Time:* ${p ? p.date + ", " + p.time : "TBA"}`); }
        if (isRes) {
          L.push(`> *Score:* ${m.score1 ?? 0} - ${m.score2 ?? 0}`);
          const w = m.winner_id === m.team1_id ? n1 : m.winner_id === m.team2_id ? n2 : "-";
          L.push(`> *Winner:* ${w}`);
        } else {
          L.push("*_Contact:_*");
          [[m.team1_id, n1], [m.team2_id, n2]].forEach(([id, n]) => { const i = info[id] || {}; L.push(`> *${n}:*`, `> Captain: ${i.captain || "-"}`, `> Contact: ${i.contact || "-"}`); });
        }
      });
      L.push(BAR, closing);
      return { text: L.join("\n"), count: g.length, label: (g[0].scheduled_at ? parts(g[0].scheduled_at).time : "TBA") + " · " + g.length + " match" };
    });
  }
  window.ARES_ANN = { build, parts };
})();
