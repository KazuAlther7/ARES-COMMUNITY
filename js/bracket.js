// Single-elimination bracket builder (pure, testable).
(function (root) {
  function seedOrder(size) {
    let s = [1];
    while (s.length < size) { const n = s.length * 2; s = s.flatMap(x => [x, n + 1 - x]); }
    return s;
  }
  function roundName(r, total) {
    const left = total - r; // 0 = final
    if (left === 0) return "Final";
    if (left === 1) return "Semi Final";
    if (left === 2) return "Quarter Final";
    return "Round of " + Math.pow(2, left + 1);
  }
  // teamIds: array in seed order. Returns match objects (no ids) with byes auto-advanced.
  function buildBracket(teamIds) {
    const n = teamIds.length;
    if (n < 2) throw new Error("Minimal 2 tim");
    let size = 2; while (size < n) size *= 2;
    const total = Math.log2(size);
    const order = seedOrder(size);
    const rounds = [];
    for (let r = 1; r <= total; r++) {
      const cnt = size / Math.pow(2, r), arr = [];
      for (let p = 1; p <= cnt; p++) arr.push({ round: r, position: p, round_name: roundName(r, total), team1_id: null, team2_id: null, score1: 0, score2: 0, best_of: bestOf(r, total), winner_id: null, status: "scheduled", is_bye: false });
      rounds.push(arr);
    }
    rounds[0].forEach((m, i) => {
      const a = order[i * 2], b = order[i * 2 + 1];
      m.team1_id = teamIds[a - 1] || null;
      m.team2_id = teamIds[b - 1] || null;
      if (m.team1_id && !m.team2_id) { m.is_bye = true; m.status = "completed"; m.winner_id = m.team1_id; }
    });
    for (let r = 0; r < total - 1; r++) rounds[r].forEach(m => {
      if (!m.winner_id) return;
      const nx = rounds[r + 1][Math.ceil(m.position / 2) - 1];
      nx[m.position % 2 ? "team1_id" : "team2_id"] = m.winner_id;
    });
    return rounds.flat();
  }
  // Aturan MLBB (knockout): Final Bo5, Semi Final Bo3, sisanya Bo1.
  function bestOf(round, maxR) { return round === maxR ? 5 : round === maxR - 1 ? 3 : 1; }
  const isKO = (m) => !m.stage || m.stage === "playoff";
  const winsNeeded = (bo) => Math.ceil(bo / 2);
  // Selesai: Bo ganjil = salah satu capai mayoritas; Bo genap (Bo2) = semua game dimainkan (seri boleh).
  const isDone = (a, b, bo) => bo % 2 ? (a >= winsNeeded(bo) || b >= winsNeeded(bo)) : (a + b >= bo);
  function scoreOptions(bo) {
    const w = winsNeeded(bo), o = [];
    for (let a = 0; a <= bo; a++) for (let b = 0; b <= bo; b++) {
      const ok = bo % 2 ? (a <= w && b <= w && !(a === w && b === w)) : (a + b <= bo);
      if (ok) o.push([a, b]);
    }
    return o.sort((x, y) => (x[0] + x[1]) - (y[0] + y[1]) || y[0] - x[0]);
  }
  // Nomor match, Bo, dan status turunan (ikut status turnamen). tstat: string atau fn(match).
  function annotate(ms, tstat) {
    const by = {};
    ms.forEach(m => (by[m.tournament_id] ||= []).push(m));
    Object.values(by).forEach(list => {
      const ko = list.filter(isKO).sort((a, b) => a.round - b.round || a.position - b.position);
      const lg = list.filter(m => !isKO(m)).sort((a, b) => a.round - b.round || (a.group_name || "").localeCompare(b.group_name || "") || a.position - b.position);
      const maxR = ko.length ? Math.max(...ko.map(m => m.round)) : 0; let n = 0;
      const now = Date.now();
      [...lg, ...ko].forEach(m => {
        m._ko = isKO(m); m._maxR = maxR;
        m._bo = m._ko ? bestOf(m.round, maxR) : (m.best_of || 1);
        m._no = m.is_bye ? null : ++n;
        const ts = typeof tstat === "function" ? tstat(m) : tstat;
        const timeLive = m.scheduled_at && new Date(m.scheduled_at).getTime() <= now; // sudah lewat jam jadwal
        m._st = (m.status === "completed" || m.winner_id) ? "completed" : (m.team1_id && m.team2_id && (ts === "live" || timeLive) ? "live" : "scheduled");
      });
    });
    return ms;
  }
  // Klasemen ala sepak bola: menang 3, seri 1, kalah 0. Urut: Pts → selisih gol (GD) → gol masuk (GF) → nama.
  // mode "mlbb" (ala MPL ID): tanpa sistem poin 3-1-0 — urut jumlah match menang (W) → Net Game Win (GD) → Game menang (GF) → nama.
  function standings(teams, matches, mode) {
    const t = {}; teams.forEach(x => t[x.id] = { team: x, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 });
    matches.filter(m => (m._st || m.status) === "completed" && t[m.team1_id] && t[m.team2_id]).forEach(m => {
      const a = t[m.team1_id], b = t[m.team2_id], s1 = +m.score1 || 0, s2 = +m.score2 || 0;
      a.P++; b.P++; a.GF += s1; a.GA += s2; b.GF += s2; b.GA += s1;
      if (s1 > s2) { a.W++; b.L++; a.Pts += 3; } else if (s2 > s1) { b.W++; a.L++; b.Pts += 3; } else { a.D++; b.D++; a.Pts++; b.Pts++; }
    });
    const rows = Object.values(t); rows.forEach(r => r.GD = r.GF - r.GA);
    return mode === "mlbb"
      ? rows.sort((x, y) => y.W - x.W || y.GD - x.GD || y.GF - x.GF || String(x.team.name || "").localeCompare(String(y.team.name || "")))
      : rows.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || String(x.team.name || "").localeCompare(String(y.team.name || "")));
  }
  // Round robin (circle method): array of rounds, tiap round = [[a,b],...]
  function roundRobin(ids) {
    const t = ids.slice(); if (t.length % 2) t.push(null);
    const n = t.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(pairs); t.splice(1, 0, t.pop());
    }
    return rounds;
  }
  function buildLeague(ids, bo, opt = {}) {
    const out = [];
    roundRobin(ids).forEach((pairs, r) => pairs.forEach(([a, b], i) => out.push({
      stage: opt.stage || "league", group_name: opt.group || null, round: r + 1, position: i + 1,
      round_name: `${opt.group ? opt.group + " · " : ""}Matchday ${r + 1}`,
      team1_id: a, team2_id: b, score1: 0, score2: 0, best_of: bo, winner_id: null, status: "scheduled", is_bye: false
    })));
    return out;
  }
  function buildGroups(ids, g, bo) {
    const groups = Array.from({ length: g }, () => []);
    ids.forEach((id, i) => { const row = Math.floor(i / g); groups[row % 2 ? g - 1 - (i % g) : i % g].push(id); }); // snake seeding
    return groups.flatMap((gi, k) => buildLeague(gi, bo, { stage: "group", group: "Group " + String.fromCharCode(65 + k) }));
  }
  const buildPlayoffs = (seedIds) => buildBracket(seedIds).map(m => ({ ...m, stage: "playoff", group_name: null }));
  const api = { buildBracket, seedOrder, roundName, bestOf, scoreOptions, annotate, isKO, isDone, winsNeeded, standings, roundRobin, buildLeague, buildGroups, buildPlayoffs };
  if (typeof module !== "undefined") module.exports = api; else root.ARES_BRACKET = api;
})(typeof window !== "undefined" ? window : globalThis);
