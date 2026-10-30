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
  // Aturan MLBB: Final Bo5, Semi Final Bo3, sisanya Bo1.
  function bestOf(round, maxR) { return round === maxR ? 5 : round === maxR - 1 ? 3 : 1; }
  function scoreOptions(bo) {
    const w = Math.ceil(bo / 2), o = [];
    for (let a = 0; a <= w; a++) for (let b = 0; b <= w; b++) if (!(a === w && b === w)) o.push([a, b]);
    return o.sort((x, y) => (x[0] + x[1]) - (y[0] + y[1]) || y[0] - x[0]);
  }
  // Nomor match, Bo, dan status turunan (ikut status turnamen). tstat: string atau fn(match).
  function annotate(ms, tstat) {
    const by = {};
    ms.forEach(m => (by[m.tournament_id] ||= []).push(m));
    Object.values(by).forEach(list => {
      list.sort((a, b) => a.round - b.round || a.position - b.position);
      const maxR = Math.max(...list.map(m => m.round)); let n = 0;
      list.forEach(m => {
        m._bo = bestOf(m.round, maxR); m._maxR = maxR; m._no = m.is_bye ? null : ++n;
        const ts = typeof tstat === "function" ? tstat(m) : tstat;
        m._st = (m.status === "completed" || m.winner_id) ? "completed" : (ts === "live" && m.team1_id && m.team2_id ? "live" : "scheduled");
      });
    });
    return ms;
  }
  const api = { buildBracket, seedOrder, roundName, bestOf, scoreOptions, annotate };
  if (typeof module !== "undefined") module.exports = api; else root.ARES_BRACKET = api;
})(typeof window !== "undefined" ? window : globalThis);
