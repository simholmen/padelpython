// Mirrors src/player.py's Player class. Plain data + pure functions (not a class)
// so player objects round-trip through JSON/localStorage without losing behavior.

let nextId = 1;

export function createPlayer(name) {
  return {
    id: "p" + (nextId++) + "-" + Date.now().toString(36),
    name,
    wins: 0,
    points: 0,
    streak: 0,
    change: 0,
    satOutLastRound: false,
    walkoverScore: 0, // gradient-weighted walkover credit -- see buildRound in tournament.js
    history: [], // { round, type: "match"|"walkover", teammate, opponents, myScore, opponentScore, result }
    pendingRemoval: false, // "remove from next round" (admin table) -- see confirmRoundEnd in app.js
  };
}

// player.py: add_win()
export function addWin(player) {
  player.wins += 1;
}

// player.py: add_winnerscore(score) -- score is the LOSING team's score
export function addWinnerScore(player, loserScore) {
  player.points += 21 - loserScore;
}

// player.py: add_looserscore(score) -- score is the LOSING team's own score
export function addLooserScore(player, loserScore) {
  player.points -= 21 - loserScore;
}
