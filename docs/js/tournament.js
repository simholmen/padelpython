// Mirrors src/tournament.py's Tournament class (sort_players, round building/result
// application), extended per product decisions for this doubles-only, court-capped
// live display: no 1v1 "extra match" (removed — doubles courts only), and round
// building is capped by court count with rotation-aware bench selection so the same
// players aren't repeatedly benched every round.

import { addWin, addWinnerScore, addLooserScore } from "./player.js";

// Finale reveal pacing, shared by renderFinaleStandings (views.js, which
// drives the actual CSS animation-delays) and startFinale (app.js, which
// times a second confetti burst to land with the podium) so both agree on
// the same moment without duplicating the formula. The bottom-up countdown
// list plays first; ROW_RISE_DURATION is how long a single row's entrance
// animation takes (must match .finale-standings-row's rowRise duration in
// styles.css), PODIUM_PAUSE is the deliberate beat of silence held after the
// list's last row lands before the podium rises in above it.
const ROW_RISE_DURATION = 0.65;
const PODIUM_PAUSE = 1.1;
const ROW_REVEAL_STEP_CAP = 0.22;
const ROW_REVEAL_TOTAL_BUDGET = 4.6;

// Per-row stagger between the countdown list's entrances -- shrinks for big
// fields (capped at ROW_REVEAL_STEP_CAP) so the whole list still lands
// within roughly ROW_REVEAL_TOTAL_BUDGET seconds no matter how many players
// are outside the podium.
export function listRevealStep(restCount) {
  return restCount > 1 ? Math.min(ROW_REVEAL_STEP_CAP, ROW_REVEAL_TOTAL_BUDGET / restCount) : 0;
}

// Seconds from when the finale screen renders until the podium's entrance
// animation should start -- i.e. how long the countdown list takes (last
// row's delay + its own rise duration) plus the held pause after it.
export function podiumStartSeconds(restCount) {
  const step = listRevealStep(restCount);
  const listDuration = restCount > 0 ? (restCount - 1) * step + ROW_RISE_DURATION : 0;
  return listDuration + PODIUM_PAUSE;
}

// tournament.py: sort_players() -- wins desc, then points desc.
export function sortPlayers(players) {
  players.sort((a, b) => b.wins - a.wins || b.points - a.points);
}

// Validates one match's entered scores (raw input strings, possibly ""),
// shared by views.js (to highlight bad inputs) and app.js (to block ending a
// round while any match is invalid). Both fields blank means "not scored
// yet" -- that's fine, not an error; applyResults already treats it as no
// result. Anything else has to be a whole number 0-50, both sides filled in,
// and not a tie (padel matches can't draw).
export function matchScoreError(score1Raw, score2Raw) {
  const s1 = String(score1Raw ?? "").trim();
  const s2 = String(score2Raw ?? "").trim();
  if (s1 === "" && s2 === "") return null;
  if (s1 === "" || s2 === "") return "incomplete";

  const n1 = Number(s1);
  const n2 = Number(s2);
  if (!Number.isInteger(n1) || !Number.isInteger(n2)) return "invalid";
  if (n1 < 0 || n1 > 50 || n2 < 0 || n2 > 50) return "range";
  if (n1 === n2) return "tie";
  return null;
}

// Gradient cost of one walkover, by standings rank at the moment it's handed
// out: rank 1 (current leader) pays 1.0, rank n (last place) pays 0.5, linearly
// in between. Selection always benches the lowest walkoverScore first (see
// pickBenched), so a last-place player needs ~2x as many actual walkovers as
// the leader to build up the same score -- weighted fairness without a hard
// top-half/bottom-half cliff.
function walkoverCost(rank, n) {
  if (n <= 1) return 1;
  return 1 - 0.5 * ((rank - 1) / (n - 1));
}

// Picks `count` players out of `pool` to bench: lowest walkoverScore first,
// ties broken randomly (the only randomness here -- otherwise fully
// deterministic). Mutates each pick's walkoverScore by its gradient cost.
function pickBenched(pool, count, rankById, n) {
  const ranked = pool
    .map((p) => ({ p, jitter: Math.random() }))
    .sort((a, b) => (a.p.walkoverScore - b.p.walkoverScore) || (a.jitter - b.jitter));
  const chosen = ranked.slice(0, count).map((x) => x.p);
  chosen.forEach((p) => {
    p.walkoverScore += walkoverCost(rankById.get(p.id), n);
  });
  return chosen;
}

// Builds one round's matches from the current standings order, capped at
// min(floor(n/4), courtCount) matches. Players who sat out the previous round
// are protected from sitting out again (hard rule) and always play, as long as
// there's room; who fills/loses the remaining slots among players who played
// last round is decided by walkoverScore (lowest first -- see pickBenched), not
// by rank order. If courts drop so sharply that even benching everyone who
// played last round isn't enough, satOutLast players are pulled back in too
// (same lowest-score-first rule) as an unavoidable fallback.
export function buildRound(players, courtCount, courtNames) {
  sortPlayers(players);

  const n = players.length;
  const maxGroups = Math.floor(n / 4);
  const capacityGroups = Math.min(maxGroups, courtCount);
  const capacity = capacityGroups * 4;
  const benchNeeded = n - capacity;

  const rankById = new Map(players.map((p, i) => [p.id, i + 1]));
  const satOutLast = players.filter((p) => p.satOutLastRound);
  const playedLast = players.filter((p) => !p.satOutLastRound);

  let benched;
  if (benchNeeded <= playedLast.length) {
    benched = pickBenched(playedLast, benchNeeded, rankById, n);
  } else {
    const extra = benchNeeded - playedLast.length;
    benched = [...playedLast, ...pickBenched(satOutLast, extra, rankById, n)];
  }

  // Re-derive playing/benched from the sorted `players` array (not the pools
  // above) so match team pairing still follows standings order, exactly like
  // app.py.
  const benchedIds = new Set(benched.map((p) => p.id));
  const playing = players.filter((p) => !benchedIds.has(p.id));

  const matches = [];
  for (let i = 0; i < playing.length; i += 4) {
    const [p1, p2, p3, p4] = playing.slice(i, i + 4);
    matches.push({
      court: courtNames[i / 4] || "Bane " + (i / 4 + 1),
      team1: [p1.id, p3.id],
      team2: [p2.id, p4.id],
      score1: "",
      score2: "",
      live: true,
    });
  }

  playing.forEach((p) => { p.satOutLastRound = false; });
  benched.forEach((p) => { p.satOutLastRound = true; });

  return { matches, walkoverPlayerIds: benched.map((p) => p.id) };
}

// Wave mode: instead of benching everyone who doesn't fit on the courts at
// once, splits the round into sequential waves -- each using the full court
// capacity -- so within one round number, everyone down to the unavoidable
// n % 4 remainder gets an actual match and real points instead of a
// walkover. The waving players skip the walkoverScore/no-repeat-benching
// system entirely (nobody's actually sitting out among them, just playing
// later in the same round); only the true remainder goes through that same
// fairness selection as a normal round, against whatever's left over (0-3
// people), so who (if anyone) misses out still rotates fairly over time.
export function buildWaveRound(players, courtCount, courtNames) {
  sortPlayers(players);

  const n = players.length;
  const groups = Math.floor(n / 4);
  const remainderCount = n - groups * 4;

  const rankById = new Map(players.map((p, i) => [p.id, i + 1]));
  const playing = players.slice(0, groups * 4);
  const remainderPool = players.slice(groups * 4);

  const satOutLast = remainderPool.filter((p) => p.satOutLastRound);
  const playedLast = remainderPool.filter((p) => !p.satOutLastRound);
  let walkover;
  if (remainderCount <= playedLast.length) {
    walkover = pickBenched(playedLast, remainderCount, rankById, n);
  } else {
    const extra = remainderCount - playedLast.length;
    walkover = [...playedLast, ...pickBenched(satOutLast, extra, rankById, n)];
  }
  const walkoverIds = new Set(walkover.map((p) => p.id));

  playing.forEach((p) => { p.satOutLastRound = false; });
  remainderPool.forEach((p) => { p.satOutLastRound = walkoverIds.has(p.id); });

  const allMatches = [];
  for (let i = 0; i < playing.length; i += 4) {
    const [p1, p2, p3, p4] = playing.slice(i, i + 4);
    allMatches.push({ p1, p2, p3, p4 });
  }

  const waves = [];
  for (let i = 0; i < allMatches.length; i += courtCount) {
    const waveMatches = allMatches.slice(i, i + courtCount).map((m, ci) => ({
      court: courtNames[ci] || "Bane " + (ci + 1),
      team1: [m.p1.id, m.p3.id],
      team2: [m.p2.id, m.p4.id],
      score1: "",
      score2: "",
      live: true,
    }));
    waves.push(waveMatches);
  }
  if (waves.length === 0) waves.push([]);

  return { waves, walkoverPlayerIds: walkover.map((p) => p.id) };
}

// The organizer's "wrap it up" button: same court-count capacity as a normal
// round (never more matches than there are actual courts) and the same
// group-of-4-by-rank pairing, but skips the walkoverScore fairness/
// no-repeat-benching rotation entirely -- there's no future round left to be
// fair about, so whoever's ranked lowest right now just sits out, plain and
// simple, same as everyone else beyond capacity.
export function buildLastRound(players, courtCount, courtNames) {
  sortPlayers(players);

  const n = players.length;
  const maxGroups = Math.floor(n / 4);
  const capacityGroups = Math.min(maxGroups, courtCount);
  const capacity = capacityGroups * 4;

  const playing = players.slice(0, capacity);
  const benched = players.slice(capacity);

  const matches = [];
  for (let i = 0; i < playing.length; i += 4) {
    const [p1, p2, p3, p4] = playing.slice(i, i + 4);
    matches.push({
      court: courtNames[i / 4] || "Bane " + (i / 4 + 1),
      team1: [p1.id, p3.id],
      team2: [p2.id, p4.id],
      score1: "",
      score2: "",
      live: true,
    });
  }

  return { matches, walkoverPlayerIds: benched.map((p) => p.id) };
}

// Applies one round's entered scores to the players, mirroring app.py's
// start_round POST handler: winner deltas and loser deltas are BOTH computed from
// the losing team's score. A tie (or unscored match) is treated as no result yet
// and skipped. Walkover players get a free win, no point change (app.py's
// remainder==1 case, now applied to every benched player). Also appends a match
// history entry per player, for the player detail popup.
export function applyResults(players, matches, walkoverPlayerIds, round) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const prevOrder = players.map((p) => p.id);

  const recordHistory = (teamIds, opponentIds, myScore, opponentScore, result) => {
    teamIds.forEach((id) => {
      const p = byId.get(id);
      if (!p) return;
      const teammateId = teamIds.find((tid) => tid !== id);
      const teammate = teammateId ? byId.get(teammateId) : null;
      const opponents = opponentIds.map((oid) => byId.get(oid)).filter(Boolean).map((o) => o.name);
      if (!p.history) p.history = [];
      p.history.push({
        round,
        type: "match",
        teammate: teammate ? teammate.name : null,
        opponents,
        myScore,
        opponentScore,
        result,
      });
    });
  };

  matches.forEach((m) => {
    const score1 = Number(m.score1) || 0;
    const score2 = Number(m.score2) || 0;
    if (score1 === score2) return; // no result yet

    const team1Won = score1 > score2;
    const winners = team1Won ? m.team1 : m.team2;
    const losers = team1Won ? m.team2 : m.team1;
    const winnerScore = team1Won ? score1 : score2;
    const loserScore = team1Won ? score2 : score1;

    recordHistory(winners, losers, winnerScore, loserScore, "win");
    recordHistory(losers, winners, loserScore, winnerScore, "loss");

    winners.forEach((id) => {
      const p = byId.get(id);
      if (!p) return;
      addWin(p);
      addWinnerScore(p, loserScore);
      p.streak = (p.streak || 0) + 1;
    });
    losers.forEach((id) => {
      const p = byId.get(id);
      if (!p) return;
      addLooserScore(p, loserScore);
      p.streak = 0;
    });
  });

  walkoverPlayerIds.forEach((id) => {
    const p = byId.get(id);
    if (!p) return;
    addWin(p);
    if (!p.history) p.history = [];
    p.history.push({ round, type: "walkover", result: "walkover" });
  });

  sortPlayers(players);
  players.forEach((p, i) => {
    p.change = prevOrder.indexOf(p.id) - i;
  });
}
