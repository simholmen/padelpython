// Central app state shape and factory. One plain object, held by app.js, mutated
// in place by action functions, persisted after every mutation.

export function createInitialState() {
  return {
    phase: "setup", // "setup" | "live" | "finale"
    theme: "dark", // "dark" | "light"
    tournamentName: "NITO Padel Turnering",

    players: [], // { id, name, wins, points, streak, change, satOutLastRound }
    newPlayerName: "",
    // Checkbox next to the add-player input: adds the next player with points
    // -1 instead of 0, so casual players sort to the bottom of round 1's
    // standings and tend to get grouped with each other -- see addPlayer in
    // app.js. Left checked/unchecked across adds so a batch of casual
    // players can be added in a row without re-checking it each time.
    newPlayerCasual: false,

    courtCount: 4,
    courtNames: ["Bane 1", "Bane 2", "Bane 3", "Bane 4"],
    // Setup-screen setting, persists across "new tournament" like courtCount
    // does -- whether the finale's lucky loser wheel-spin step runs at all.
    luckyLoserEnabled: true,
    // Setup-screen setting, also persists across "new tournament": when more
    // players sign up than fit on the courts at once, play them in sequential
    // waves within the same round instead of benching the excess with a
    // walkover -- see buildWaveRound in tournament.js.
    waveModeEnabled: false,

    round: 1,
    view: 0, // 0 kamper, 1 tabell, 2 spotlight -- the "runde ferdig" confirm step
    // is a separate overlay (confirmPending), not part of this cycle, so it can't
    // be reached by scrolling and can't be confused with actually having confirmed.
    confirmPending: false,
    matches: [], // { court, team1:[id,id], team2:[id,id], score1, score2, live }
    walkoverPlayerIds: [],
    // Score errors (see matchScoreError in tournament.js) are only ever
    // surfaced once ending the round has actually been attempted and
    // blocked -- not while typing, not just from leaving a field. Reset
    // whenever a new round/wave starts.
    showScoreErrors: false,
    // "Wrap it up" flow: pendingLastRound flags that confirming the round on
    // screen right now should build the special everyone-plays last round next
    // (see buildLastRound in tournament.js), instead of a normal round.
    // isLastRound flags that the round currently on screen IS that last round,
    // so confirming it goes straight to the finale instead of building another.
    pendingLastRound: false,
    isLastRound: false,
    // Wave mode's own round-scoped bookkeeping (see buildWaveRound):
    // pendingWaves holds the matches for waves still to come THIS round
    // (state.matches is always the current wave); waveNumber/waveTotal are
    // for display ("BØLGE 1 AV 2"); waveRemainderIds is the true walkover
    // remainder for the round, held back and only applied/shown once the
    // last wave is confirmed. All reset to their defaults (no waves) whenever
    // a genuinely new round or the last round is built.
    pendingWaves: [],
    waveNumber: 1,
    waveTotal: 1,
    waveRemainderIds: [],

    // Snapshots of round-scoped state (players, matches, walkover list, wave
    // bookkeeping) captured the moment each round's matches are first built --
    // see saveRoundSnapshot in app.js. Keyed by round number (as a string,
    // since it round-trips through JSON either way). Lets the admin table's
    // round dropdown revert the tournament back to exactly how a round
    // started, discarding everything played after it.
    roundSnapshots: {},

    showConfetti: false,
    confettiPieces: [],

    finaleStep: 0, // 0 combined standings+podium reveal, 1 wheel, 2 result
    luckyPoolIds: [],
    luckyWinnerId: null,
    wheelRotation: 0,
    spinning: false,

    selectedPlayerId: null, // player detail popup, not persisted across reloads
    confirmingReset: false, // logo-click "start over" confirm dialog, not persisted
    confirmingClearPlayers: false, // "remove all players" confirm dialog, not persisted
    showAdminTable: false, // admin table modal (all players, alphabetical, incl. walkoverScore), not persisted
    removalTargetId: null, // player id going through the admin table's remove-player picker, not persisted
    adminRoundFilter: "total", // admin table's round dropdown -- "total" or a round number string, not persisted
    confirmingRevertRound: null, // round number going through the "revert to this round" confirm, not persisted
    adminNewPlayerName: "", // admin table's "add player mid-tournament" field, not persisted
    addPlayerError: "", // duplicate-name error shown under the setup or admin add field, not persisted
  };
}
