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
      for (let p = 1; p <= cnt; p++) arr.push({ round: r, position: p, round_name: roundName(r, total), team1_id: null, team2_id: null, score1: 0, score2: 0, winner_id: null, status: "scheduled", is_bye: false });
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
  const api = { buildBracket, seedOrder, roundName };
  if (typeof module !== "undefined") module.exports = api; else root.ARES_BRACKET = api;
})(typeof window !== "undefined" ? window : globalThis);
