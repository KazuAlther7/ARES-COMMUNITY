// Bracket builders (pure, testable): single elimination, double elimination, league/group.
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
  // Jalanin otomatis kemenangan BYE lewat rute winner_to ({side,round,position,slot}) sampai mentok.
  // Dipakai pas generate bracket (single & double elim) maupun reset skor (re-isi BYE tanpa ubah struktur).
  function propagateByes(all) {
    const key = (side, r, p) => `${side || ""}:${r}-${p}`;
    const byKey = {}; all.forEach(m => byKey[key(m.bracket_side, m.round, m.position)] = m);
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach(m => {
        if (m.winner_id || !m.winner_to) return;
        const hasA = !!m.team1_id, hasB = !!m.team2_id;
        if (hasA && !hasB) m.winner_id = m.team1_id; else if (hasB && !hasA) m.winner_id = m.team2_id; else return;
        m.is_bye = true; m.status = "completed";
        const t = m.winner_to, target = byKey[key(t.side, t.round, t.position)];
        if (target) { target[t.slot === 1 ? "team1_id" : "team2_id"] = m.winner_id; changed = true; }
      });
    }
  }
  // teamIds: array in seed order. winner_to null di babak terakhir = juara turnamen.
  function buildBracket(teamIds) {
    const n = teamIds.length;
    if (n < 2) throw new Error("Minimal 2 tim");
    let size = 2; while (size < n) size *= 2;
    const total = Math.log2(size);
    const order = seedOrder(size);
    const rounds = [];
    for (let r = 1; r <= total; r++) {
      const cnt = size / Math.pow(2, r), arr = [];
      for (let p = 1; p <= cnt; p++) arr.push({
        round: r, position: p, round_name: roundName(r, total), bracket_side: null,
        team1_id: null, team2_id: null, score1: 0, score2: 0, best_of: bestOf(r, total), winner_id: null, status: "scheduled", is_bye: false,
        winner_to: r < total ? { side: null, round: r + 1, position: Math.ceil(p / 2), slot: p % 2 ? 1 : 2 } : null,
        loser_to: null
      });
      rounds.push(arr);
    }
    rounds[0].forEach((m, i) => { m.team1_id = teamIds[order[i * 2] - 1] || null; m.team2_id = teamIds[order[i * 2 + 1] - 1] || null; });
    const all = rounds.flat();
    propagateByes(all);
    return all;
  }
  // Double elimination standar (tanpa bracket reset di grand final — pemenang grand final langsung juara).
  // Minimal 4 tim. Ukuran bracket dibulatkan ke pangkat 2 terdekat (sisanya BYE di Winners Bracket ronde 1).
  function buildDoubleElim(teamIds) {
    const n = teamIds.length;
    if (n < 4) throw new Error("Minimal 4 tim untuk Double Elimination");
    let size = 2; while (size < n) size *= 2;
    const k = Math.log2(size);
    const order = seedOrder(size);
    const wb = [];
    for (let r = 1; r <= k; r++) {
      const cnt = size / Math.pow(2, r), arr = [];
      for (let p = 1; p <= cnt; p++) arr.push({
        round: r, position: p, round_name: "Winners · " + roundName(r, k), bracket_side: "winners",
        team1_id: null, team2_id: null, score1: 0, score2: 0, best_of: bestOf(r, k), winner_id: null, status: "scheduled", is_bye: false,
        winner_to: r < k ? { side: "winners", round: r + 1, position: Math.ceil(p / 2), slot: p % 2 ? 1 : 2 } : { side: "final", round: 1, position: 1, slot: 1 },
        loser_to: null
      });
      wb.push(arr);
    }
    wb[0].forEach((m, i) => { m.team1_id = teamIds[order[i * 2] - 1] || null; m.team2_id = teamIds[order[i * 2 + 1] - 1] || null; });

    const mkLB = (round, position) => ({
      round, position, round_name: "Losers · Round " + round, bracket_side: "losers",
      team1_id: null, team2_id: null, score1: 0, score2: 0, best_of: 1, winner_id: null, status: "scheduled", is_bye: false,
      winner_to: null, loser_to: null
    });

    const L = [];
    const l1cnt = size / 4;
    const arr1 = []; for (let p = 1; p <= l1cnt; p++) arr1.push(mkLB(1, p));
    L.push(arr1);
    wb[0].forEach((m, i) => { m.loser_to = { side: "losers", round: 1, position: Math.ceil((i + 1) / 2), slot: (i + 1) % 2 ? 1 : 2 }; });
    let lno = 2, survivors = l1cnt;
    for (let i = 2; i <= k; i++) {
      if (i > 2) { // ronde konsolidasi: samain jumlah tim sisa LB dgn jumlah tim kalah WB ronde ini
        const cnt = survivors / 2, arr = []; for (let p = 1; p <= cnt; p++) arr.push(mkLB(lno, p));
        L[L.length - 1].forEach((m, idx) => { m.winner_to = { side: "losers", round: lno, position: Math.ceil((idx + 1) / 2), slot: (idx + 1) % 2 ? 1 : 2 }; });
        L.push(arr); lno++; survivors = cnt;
      }
      const cnt = survivors, arr = []; for (let p = 1; p <= cnt; p++) arr.push(mkLB(lno, p));
      L[L.length - 1].forEach((m, idx) => { m.winner_to = { side: "losers", round: lno, position: idx + 1, slot: 1 }; });
      wb[i - 1].forEach((m, idx) => { m.loser_to = { side: "losers", round: lno, position: idx + 1, slot: 2 }; });
      L.push(arr); lno++; survivors = cnt;
    }
    L[L.length - 1].forEach(m => { m.winner_to = { side: "final", round: 1, position: 1, slot: 2 }; m.best_of = 3; }); // LB Final Bo3

    const gf = {
      round: 1, position: 1, round_name: "Grand Final", bracket_side: "final",
      team1_id: null, team2_id: null, score1: 0, score2: 0, best_of: 5, winner_id: null, status: "scheduled", is_bye: false,
      winner_to: null, loser_to: null
    };

    const all = [...wb.flat(), ...L.flat(), gf];
    propagateByes(all);
    return all;
  }
  // Nomor match, Bo, dan status turunan (ikut status turnamen). tstat: string atau fn(match).
  function annotate(ms, tstat) {
    const by = {};
    ms.forEach(m => (by[m.tournament_id] ||= []).push(m));
    Object.values(by).forEach(list => {
      const ko = list.filter(isKO).sort((a, b) => (a.bracket_side || "").localeCompare(b.bracket_side || "") || a.round - b.round || a.position - b.position);
      const lg = list.filter(m => !isKO(m)).sort((a, b) => a.round - b.round || (a.group_name || "").localeCompare(b.group_name || "") || a.position - b.position);
      let n = 0;
      const now = Date.now();
      [...lg, ...ko].forEach(m => {
        m._ko = isKO(m);
        m._bo = m.best_of || 1; // trust nilai yg di-generate (formula round/maxR gak berlaku generik buat double elim)
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
  const api = { buildBracket, buildDoubleElim, seedOrder, roundName, bestOf, scoreOptions, annotate, isKO, isDone, winsNeeded, standings, roundRobin, buildLeague, buildGroups, buildPlayoffs, propagateByes };
  if (typeof module !== "undefined") module.exports = api; else root.ARES_BRACKET = api;
})(typeof window !== "undefined" ? window : globalThis);
