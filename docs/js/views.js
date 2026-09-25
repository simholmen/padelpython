// Renders HTML strings from the current state, mirroring the design
// prototype's renderVals() -> single reactive re-render pattern. app.js sets
// #screen-root and #modal-root independently (see renderScreen/renderPlayerModal
// below) so opening the player popup never rebuilds the screen underneath it.

import { isDevMode } from "./env.js";
import { matchScoreError, listRevealStep, podiumStartSeconds, MAX_WAVES } from "./tournament.js";

const SCORE_ERROR_MESSAGES = {
  incomplete: "Fyll inn poeng for begge lag",
  invalid: "Ugyldig poengsum",
  range: "Poeng må være 0–50",
  tie: "Uavgjort er ikke mulig",
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name) {
  return escapeHtml((name || "").slice(0, 2).toUpperCase());
}

function playersById(state) {
  return new Map(state.players.map((p) => [p.id, p]));
}

function playerClickAttr(id) {
  return id ? `data-action="show-player" data-player-id="${id}"` : "";
}

// Escalating visual intensity the longer the streak runs: 2 is the baseline
// accent-colored badge, 3/4/5+ step up through hotter colors and heavier borders.
function streakTierClass(streak) {
  if (streak >= 5) return " streak-tier-5";
  if (streak === 4) return " streak-tier-4";
  if (streak === 3) return " streak-tier-3";
  return "";
}

function streakBadge(player) {
  if (!player || !(player.streak > 1)) return "";
  return `<span class="streak-badge${streakTierClass(player.streak)}">🔥 ${player.streak}</span>`;
}

// Same >1 threshold as streakBadge: no avatar border until the streak is
// actually badge-worthy, then it escalates through the same hot tiers.
function avatarStreakClass(player) {
  if (!player || !(player.streak > 1)) return "";
  return ` avatar-streak${streakTierClass(player.streak)}`;
}

// Theme toggle and the admin table entry point, grouped in one fixed
// bottom-left corner across all three phases (the container carries the
// fixed positioning so the two buttons sit side by side with a gap, instead
// of each guessing the other's width to avoid overlapping).
function bottomLeftControls(state) {
  const themeLabel = state.theme === "light" ? "MØRK MODUS" : "LYS MODUS";
  return `
  <div class="bottom-left-controls">
    <button class="theme-toggle" data-action="toggle-theme">${themeLabel}</button>
    <button class="admin-toggle" data-action="show-admin">ADMIN</button>
  </div>`;
}

// Exported so app.js's celebrate() can patch this one layer directly into
// the live DOM instead of going through a full persistAndRender() -- see
// the comment there for why a full re-render would break in-flight CSS
// animations elsewhere on screen (the finale's countdown-list/podium reveal).
export function confettiLayer(state) {
  if (!state.showConfetti) return "";
  const pieces = state.confettiPieces
    .map(
      (c) => `<div class="confetti-piece" style="left:${c.left};width:${c.size}px;height:${c.size}px;background:${c.color};border-radius:${c.radius};animation-duration:${c.duration}s;animation-delay:${c.delay}s;"></div>`
    )
    .join("");
  return `<div class="confetti-layer">${pieces}</div>`;
}

function renderSetup(state) {
  const playerRows = state.players
    .map((p, i) => {
      const casual = p.points < 0;
      return `
      <div class="player-row">
        <input class="player-name-input" data-bind="player-name" data-idx="${i}" value="${escapeHtml(p.name)}" aria-label="Navn på spiller ${i + 1}">
        <button class="casual-badge${casual ? " casual-active" : ""}" data-action="toggle-casual" data-idx="${i}" aria-pressed="${casual}" title="Uformell -- starter runde 1 med -1 poeng">−1</button>
        <button class="player-remove" data-action="remove-player" data-idx="${i}" aria-label="Fjern ${escapeHtml(p.name)}">×</button>
      </div>`;
    })
    .join("");

  const courtInputs = state.courtNames
    .map(
      (name, i) => `<input class="court-input" data-bind="court-name" data-idx="${i}" value="${escapeHtml(name)}">`
    )
    .join("");

  const n = state.players.length;
  const totalGroups = Math.floor(n / 4);
  const maxMatches = state.waveModeEnabled ? state.courtCount * MAX_WAVES : state.courtCount;
  const groupsReady = Math.min(totalGroups, maxMatches);
  const waveCount = state.waveModeEnabled ? Math.ceil(groupsReady / Math.max(state.courtCount, 1)) : 1;
  const canStart = n >= 4;

  return `
  <div class="screen screen-setup">
    ${bottomLeftControls(state)}
    <div class="setup-header">
      <img class="setup-logo logo-reset" src="assets/nito-logo.png" alt="NITO" data-action="logo-reset" title="Start en ny turnering">
      <div class="setup-title">${escapeHtml(state.tournamentName)}</div>
    </div>
    <div class="setup-subtitle">OPPSETT AV TURNERING</div>

    <div class="setup-panels">
      <div class="panel players-panel">
        <div class="panel-title">SPILLERE (${n})</div>
        <div class="player-input-row">
          <input class="player-input" data-bind="new-player-name" placeholder="Spiller-navn" value="${escapeHtml(state.newPlayerName)}">
          <button class="btn-add" data-action="add-player">LEGG TIL</button>
        </div>
        ${state.addPlayerError ? `<div class="add-player-error">${escapeHtml(state.addPlayerError)}</div>` : ""}
        <label class="casual-checkbox-row" title="Legger til spilleren med -1 poeng, slik at uformelle spillere havner nederst i runde 1 og gjerne møter hverandre">
          <input type="checkbox" data-bind="new-player-casual" ${state.newPlayerCasual ? "checked" : ""}>
          UFORMELL (STARTER MED −1 POENG)
        </label>
        ${isDevMode() ? `
        <div class="dev-tools">
          <span class="dev-badge">DEV</span>
          <button class="btn-dev" data-action="add-test-players">LEGG TIL 26 TESTSPILLERE</button>
        </div>` : ""}
        <div class="player-list">${playerRows}</div>
        <button class="btn-clear-players" data-action="clear-players" ${n ? "" : "disabled"}>FJERN ALLE SPILLERE</button>
      </div>

      <div class="panel courts-panel">
        <div class="panel-title">BANER</div>
        <div class="court-stepper">
          <button class="stepper-btn" data-action="dec-court">−</button>
          <div class="stepper-value">${state.courtCount}</div>
          <button class="stepper-btn" data-action="inc-court">+</button>
        </div>
        <div class="court-list">${courtInputs}</div>
      </div>
    </div>

    <div class="setup-settings">
      <div class="panel-title">INNSTILLINGER</div>
      <label class="setting-toggle-row">
        <input type="checkbox" data-bind="lucky-loser-enabled" ${state.luckyLoserEnabled ? "checked" : ""}>
        LUCKY LOSER-TREKNING PÅ SLUTTEN
      </label>
      <label class="setting-toggle-row" title="Når det er flere spillere enn det er plass til på banene samtidig, spilles runden i to bølger etter hverandre. Er det fortsatt for mange, får de overtallige walkover">
        <input type="checkbox" data-bind="wave-mode-enabled" ${state.waveModeEnabled ? "checked" : ""}>
        SPILL I TO BØLGER
      </label>
    </div>

    <div class="setup-footer">
      <div class="match-preview-label">${groupsReady} KAMPER KLAR FOR RUNDE 1${waveCount > 1 ? ` (${waveCount} BØLGER)` : ""}</div>
      <button class="btn-start" data-action="start-tournament" ${canStart ? "" : "disabled"}>START TURNERING</button>
    </div>
  </div>`;
}

// Shared by renderMatchCard and app.js's direct per-keystroke DOM patch (see
// refreshMatchStatusBadge there) -- score inputs never get rebuilt while
// typing (that caused lag/jumping/reversed digits, and re-rendering on
// focusout could steal focus mid-transition between two inputs), so the
// badge is patched in place via this same markup instead of a full re-render.
export function matchStatusBadgeHtml(m) {
  // A valid (error === null) score pair means both sides are filled in --
  // matchScoreError only returns null for a genuinely finished result or for
  // two still-blank fields, and those two cases are told apart by whether
  // score1 actually has anything in it.
  const error = matchScoreError(m.score1, m.score2);
  const isFinished = error === null && String(m.score1).trim() !== "";
  return isFinished
    ? `<div class="finished-indicator"><div class="finished-dot"></div><div class="finished-label">FERDIG</div></div>`
    : m.live
      ? `<div class="live-indicator"><div class="live-dot"></div><div class="live-label">LIVE</div></div>`
      : "";
}

function renderMatchCard(m, byId, showErrors) {
  const [t1a, t1b] = m.team1.map((id) => byId.get(id));
  const [t2a, t2b] = m.team2.map((id) => byId.get(id));
  const error = matchScoreError(m.score1, m.score2);
  const flagError = showErrors && error; // only nag once ending the round was actually tried
  return `
  <div class="match-card${flagError ? " match-card-error" : ""}" data-match-idx="${m.__idx}">
    <div class="match-card-top">
      <div class="court-name">${escapeHtml(m.court)}</div>
      ${matchStatusBadgeHtml(m)}
    </div>
    <div class="match-card-divider"></div>
    <div class="match-card-body">
      <div class="team team-left">
        <div class="player-chip" ${playerClickAttr(t1a.id)}><div class="player-name-text">${escapeHtml(t1a.name)}${streakBadge(t1a)}</div><div class="player-avatar">${initials(t1a.name)}</div></div>
        <div class="player-chip" ${playerClickAttr(t1b.id)}><div class="player-name-text">${escapeHtml(t1b.name)}${streakBadge(t1b)}</div><div class="player-avatar">${initials(t1b.name)}</div></div>
      </div>
      <div class="score-block">
        <div class="score-inputs">
          <input class="score-input${flagError ? " score-input-error" : ""}" type="number" min="0" max="50" step="1" data-bind="score1" data-match-id="${m.__idx}" value="${m.score1}">
          <span class="score-dash">–</span>
          <input class="score-input${flagError ? " score-input-error" : ""}" type="number" min="0" max="50" step="1" data-bind="score2" data-match-id="${m.__idx}" value="${m.score2}">
        </div>
        <div class="score-label">POENG</div>
        ${flagError ? `<div class="score-error">${SCORE_ERROR_MESSAGES[error]}</div>` : ""}
      </div>
      <div class="team team-right">
        <div class="player-chip" ${playerClickAttr(t2a.id)}><div class="player-avatar">${initials(t2a.name)}</div><div class="player-name-text">${escapeHtml(t2a.name)}${streakBadge(t2a)}</div></div>
        <div class="player-chip" ${playerClickAttr(t2b.id)}><div class="player-avatar">${initials(t2b.name)}</div><div class="player-name-text">${escapeHtml(t2b.name)}${streakBadge(t2b)}</div></div>
      </div>
    </div>
  </div>`;
}

// Wave mode shows the whole round at once: wave 1's matches first, then a
// full-width "BØLGE 2" divider and wave 2's matches (see buildNewRound in
// app.js). The page scrolls when that doesn't fit; the walkover row is
// sticky to the bottom of the viewport so it's always visible.
function renderMatchups(state, byId) {
  const cards = state.matches
    .map((m, i) => {
      const prevWave = i > 0 ? state.matches[i - 1].wave : undefined;
      const divider = m.wave > 1 && m.wave !== prevWave
        ? `<div class="wave-divider"><span>BØLGE ${m.wave}</span></div>`
        : "";
      return divider + renderMatchCard({ ...m, __idx: i }, byId, state.showScoreErrors);
    })
    .join("");

  let walkoverRow = "";
  if (state.walkoverPlayerIds.length) {
    const chips = state.walkoverPlayerIds
      .map((id) => {
        const p = byId.get(id);
        return `<div class="walkover-chip" ${playerClickAttr(id)}>${escapeHtml(p.name)}${streakBadge(p)}</div>`;
      })
      .join("");
    walkoverRow = `
    <div class="walkover-row">
      <div class="walkover-label">WALKOVER DENNE RUNDEN:</div>
      ${chips}
    </div>`;
  }

  return `<div class="live-view matchups">
    <div class="matchups-grid">${cards}</div>
    ${walkoverRow}
  </div>`;
}

function podiumSlot(rankNum, player, sizeClass) {
  if (!player) player = { name: "", wins: 0, points: 0 };
  return `
  <div class="podium-slot ${sizeClass}" ${playerClickAttr(player.id)}>
    ${rankNum === 1 ? `<div class="podium-crown" aria-hidden="true">👑</div>` : ""}
    <div class="podium-avatar${avatarStreakClass(player)}">${initials(player.name)}</div>
    <div class="podium-rank">${rankNum}</div>
    <div class="podium-name">${escapeHtml(player.name)}${streakBadge(player)}</div>
    <div class="podium-stats">${player.wins} SEIRE · ${player.points} PTS</div>
  </div>`;
}

function renderLeaderboard(state) {
  const players = state.players;
  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  const podium = `
  <div class="podium">
    ${podiumSlot(2, top3[1], "podium-2")}
    ${podiumSlot(1, top3[0], "podium-1")}
    ${podiumSlot(3, top3[2], "podium-3")}
  </div>`;

  const rows = rest
    .map((p, i) => {
      const rank = i + 4;
      const arrow = p.change > 0 ? "▲" : p.change < 0 ? "▼" : "–";
      const arrowClass = p.change > 0 ? "up" : p.change < 0 ? "down" : "flat";
      const streak = p.streak >= 2
        ? `<div class="lb-streak${streakTierClass(p.streak)}">🔥 ${p.streak}</div>`
        : `<div class="lb-streak lb-streak-empty"></div>`;
      return `
      <div class="leaderboard-row" ${playerClickAttr(p.id)}>
        <div class="lb-rank">${rank}</div>
        <div class="lb-change ${arrowClass}">${arrow}</div>
        <div class="lb-name">${escapeHtml(p.name)}</div>
        ${streak}
        <div class="lb-stats">${p.wins}S · ${p.points}P</div>
      </div>`;
    })
    .join("");

  const rowCount = Math.ceil(rest.length / 2) || 1;
  return `<div class="live-view leaderboard">
    ${podium}
    <div class="leaderboard-list" style="grid-template-rows: repeat(${rowCount}, auto);">${rows}</div>
  </div>`;
}

// The three spotlight awards. Every pick walks state.players in standings
// order and only takes over on a strictly better value, so ties always go to
// whoever is higher in the table. Each returns null when there's nothing to
// award yet (e.g. round 1, before any results), which renders an empty card.

// Longest current winning streak (walkovers don't touch streaks -- see applyResults).
function pickStreakLeader(players) {
  let best = null;
  players.forEach((p) => { if (p.streak > 0 && (!best || p.streak > best.streak)) best = p; });
  return best;
}

// The biggest winning margin from the last completed round, read from each
// player's match history (both teammates carry the same entry, so the first
// one found in standings order stands in for the team).
function pickBestMarginTeam(players, round) {
  let best = null;
  players.forEach((p) => {
    (p.history || []).forEach((h) => {
      if (h.round !== round || h.type !== "match" || h.result !== "win") return;
      const margin = h.myScore - h.opponentScore;
      if (!best || margin > best.margin) best = { player: p, teammateName: h.teammate, h, margin };
    });
  });
  if (!best) return null;
  const teammate = players.find((p) => p.name === best.teammateName) || null;
  return { ...best, teammate };
}

// Most places climbed in the table when the last round was registered.
function pickBiggestClimber(players) {
  let best = null;
  players.forEach((p) => { if (p.change > 0 && (!best || p.change > best.change)) best = p; });
  return best;
}

function spotlightCard(label, bodyHtml) {
  return `
  <div class="spotlight-card">
    <div class="spotlight-label">${label}</div>
    ${bodyHtml || `<div class="spotlight-empty">Ingen ennå</div>`}
  </div>`;
}

function spotlightPlayer(p) {
  return `
  <div class="spotlight-clickable" ${playerClickAttr(p.id)}>
    <div class="spotlight-avatar">${initials(p.name)}</div>
    <div class="spotlight-name">${escapeHtml(p.name)}</div>
  </div>`;
}

function spotlightStat(value, label) {
  return `<div class="stat-block"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function renderSpotlight(state) {
  const players = state.players;
  const lastRound = state.round - 1;

  const streak = pickStreakLeader(players);
  const margin = pickBestMarginTeam(players, lastRound);
  const climber = pickBiggestClimber(players);

  const streakBody = streak
    ? `${spotlightPlayer(streak)}${spotlightStat(`🔥 ${streak.streak}`, "SEIRE PÅ RAD")}`
    : "";

  const marginBody = margin
    ? `
    <div class="spotlight-team">
      ${[margin.player, margin.teammate].filter(Boolean).map((p) => `
      <div class="spotlight-clickable" ${playerClickAttr(p.id)}>
        <div class="spotlight-avatar spotlight-avatar-sm">${initials(p.name)}</div>
      </div>`).join("")}
    </div>
    <div class="spotlight-name">${escapeHtml(margin.player.name)}${margin.teammate ? ` &amp; ${escapeHtml(margin.teammate.name)}` : ""}</div>
    ${spotlightStat(`+${margin.margin}`, `VANT ${margin.h.myScore}–${margin.h.opponentScore} I RUNDE ${lastRound}`)}`
    : "";

  const climberBody = climber
    ? `${spotlightPlayer(climber)}${spotlightStat(`▲ ${climber.change}`, climber.change === 1 ? "PLASS OPP" : "PLASSER OPP")}`
    : "";

  return `<div class="live-view spotlight">
    <div class="spotlight-grid">
      ${spotlightCard("LENGSTE WINSTREAK", streakBody)}
      ${spotlightCard("STØRSTE SEIER", marginBody)}
      ${spotlightCard("STØRSTE KLATRER", climberBody)}
    </div>
  </div>`;
}

// Not part of the 3-view cycle -- only reachable via Enter (requestRoundEnd)
// or the "SISTE RUNDE" button (requestLastRound), never by scrolling/arrow
// keys. Confirms before anything is actually applied. Copy changes depending
// on what confirming will actually do: end the tournament (isLastRound, the
// round on screen right now was the special last round), advance to the next
// queued wave (wave mode, still mid-round), kick off the last round next
// (pendingLastRound), or just a normal round.
function renderConfirm(state) {
  const hasMoreWaves = state.pendingWaves && state.pendingWaves.length > 0;
  const label = state.isLastRound
    ? "SISTE RUNDE"
    : hasMoreWaves
      ? `BØLGE ${state.waveNumber} AV ${state.waveTotal} FERDIG`
      : `RUNDE ${state.round} FERDIG`;
  const title = state.isLastRound
    ? "REGISTRERE<br>SLUTTRESULTATER?"
    : hasMoreWaves
      ? `REGISTRERE &amp; START<br>BØLGE ${state.waveNumber + 1}?`
      : state.pendingLastRound
        ? "REGISTRERE &amp; START<br>SISTE RUNDE?"
        : "REGISTRERE<br>RESULTATER?";
  const confirmLabel = state.isLastRound ? "BEKREFT &amp; AVSLUTT" : "BEKREFT &amp; REGISTRER";
  return `<div class="live-view confirm">
    <button class="confirm-back" data-action="cancel-round" aria-label="Tilbake">←</button>
    <div class="pending-label">${label}</div>
    <div class="pending-title">${title}</div>
    <div class="pending-hint">ENTER = BEKREFT &nbsp;·&nbsp; ← = TILBAKE</div>
    <button class="btn-confirm-round" data-action="confirm-round">${confirmLabel}</button>
  </div>`;
}

function renderLive(state) {
  const byId = playersById(state);
  const labels = ["KAMPER", "TABELL", "SPOTLIGHT"];
  let content;
  if (state.confirmPending) content = renderConfirm(state);
  else if (state.view === 0) content = renderMatchups(state, byId);
  else if (state.view === 1) content = renderLeaderboard(state);
  else content = renderSpotlight(state);

  const dots = [0, 1, 2]
    .map((i) => `<div class="dot ${!state.confirmPending && i === state.view ? "dot-active" : ""}"></div>`)
    .join("");

  const viewLabel = state.confirmPending ? "BEKREFT REGISTRERING" : labels[state.view];
  const roundLabel = state.isLastRound
    ? "SISTE RUNDE"
    : state.waveTotal > 1
      ? `RUNDE ${state.round} · BØLGE ${state.waveNumber}/${state.waveTotal}`
      : "RUNDE " + state.round;
  const endHint = state.waveTotal > 1 && state.waveNumber < state.waveTotal ? "AVSLUTT BØLGE" : "AVSLUTT RUNDE";
  const bottomHint = state.confirmPending
    ? "ENTER = BEKREFT &nbsp;·&nbsp; ← = TILBAKE"
    : `← → BYTT VISNING &nbsp;·&nbsp; ENTER = ${endHint}`;

  return `
  <div class="screen screen-live">
    ${bottomLeftControls(state)}
    <header class="live-header">
      <div class="live-header-left">
        <img class="live-logo logo-reset" src="assets/nito-logo.png" alt="NITO" data-action="logo-reset" title="Start en ny turnering">
        <div class="live-titles">
          <div class="live-name">${escapeHtml(state.tournamentName)}</div>
          <div class="live-format">Av Simen Emil Wiig Holmen · ${state.courtCount} BANER</div>
        </div>
      </div>
      <div class="live-header-right">
        <div class="pill-round">${roundLabel}</div>
        <div class="pill-view">${viewLabel}</div>
        <button class="btn-last-round" data-action="request-last-round" ${state.confirmPending || state.isLastRound ? "disabled" : ""}>SISTE RUNDE</button>
        <button class="btn-end" data-action="start-finale">AVSLUTT TURNERING</button>
      </div>
    </header>
    <div class="live-content">${content}</div>
    <div class="bottom-bar">
      <div class="view-nav">
        <button class="view-arrow" data-action="cycle-view" data-dir="-1" aria-label="Forrige visning" ${state.confirmPending ? "disabled" : ""}>‹</button>
        <div class="view-dots">${dots}</div>
        <button class="view-arrow" data-action="cycle-view" data-dir="1" aria-label="Neste visning" ${state.confirmPending ? "disabled" : ""}>›</button>
      </div>
      <div class="bottom-hint">${bottomHint}</div>
    </div>
    ${confettiLayer(state)}
  </div>`;
}

// The finale's big reveal, combined into one continuous step: the countdown
// list (rank 4 and below) plays first, bottom-up -- last place appears
// first, working up to 4th, same beat as an awards-show countdown -- then,
// after a held beat of silence, the top-3 podium rises in ABOVE the list for
// the big finish. Everything here is pure CSS (animation-delay per row/slot,
// computed once from the player count via listRevealStep/podiumStartSeconds
// in tournament.js): no JS timers drive the visuals. app.js's startFinale
// times a second confetti burst off the same podiumStartSeconds value so it
// lands with the podium instead of the list.
//
// When the lucky loser draw is switched off, this IS the last step -- no
// wheel/result steps follow -- so it gets its own reset button here instead
// of relying on the step the wheel would otherwise lead to.
function renderFinaleStandings(state) {
  const rest = state.players.slice(3);
  const top3 = state.players.slice(0, 3);
  const n = rest.length;
  const step = listRevealStep(n);
  const podiumStart = podiumStartSeconds(n).toFixed(2);
  const isFinalStep = !state.luckyLoserEnabled;

  const rows = rest
    .map((p, i) => {
      const rank = i + 4;
      const revealDelay = ((n - 1 - i) * step).toFixed(2);
      const isCutoff = i === 0; // rank 4 -- the "just missed the podium" row
      return `
      <div class="finale-standings-row${isCutoff ? " fs-cutoff" : ""}" ${playerClickAttr(p.id)} style="animation-delay:${revealDelay}s;">
        <div class="fs-rank">${rank}</div>
        <div class="fs-name">${escapeHtml(p.name)}${streakBadge(p)}</div>
        <div class="fs-stats">${p.wins}S · ${p.points}P</div>
      </div>`;
    })
    .join("");

  return `<div class="finale-step finale-standings">
    <div class="finale-standings-title">SLUTTRESULTAT</div>
    <div class="finale-podium-row finale-podium-overlay" style="--podium-start:${podiumStart}s;">
      ${podiumSlot(2, top3[1], "podium-2 podium-large")}
      ${podiumSlot(1, top3[0], "podium-1 podium-large")}
      ${podiumSlot(3, top3[2], "podium-3 podium-large")}
    </div>
    <div class="finale-standings-list">${rows}</div>
    ${isFinalStep ? `<button class="btn-reset finale-reset-inline" data-action="reset-tournament">NY TURNERING</button>` : ""}
  </div>`;
}

function renderFinaleWheel(state) {
  const byId = playersById(state);
  const pool = state.luckyPoolIds.map((id) => byId.get(id));
  const chips = pool.map((p) => `<div class="wheel-pool-chip" ${playerClickAttr(p.id)}>${escapeHtml(p.name)}</div>`).join("");
  const n = pool.length || 1;
  const deg = 360 / n;
  const stops = pool.map((_, i) => {
    const cls = i % 2 === 0 ? "var(--accent)" : "var(--surface)";
    return `${cls} ${i * deg}deg ${(i + 1) * deg}deg`;
  });
  const gradient = `conic-gradient(${stops.join(",")})`;

  // Radial labels rotated to each segment's center angle; text color matches
  // that segment's own on-accent/text contrast so it reads on both alternating
  // background colors, in both themes.
  const labelRadius = 130;
  const labels = pool
    .map((p, i) => {
      const angle = i * deg + deg / 2;
      const textColor = i % 2 === 0 ? "var(--on-accent)" : "var(--text)";
      return `<div class="wheel-label" style="transform:rotate(${angle}deg) translateY(-${labelRadius}px);color:${textColor};">${escapeHtml(p.name)}</div>`;
    })
    .join("");

  return `<div class="finale-step finale-wheel">
    <div class="wheel-title">LUCKY LOSER-TREKNING</div>
    <div class="wheel-wrap">
      <div class="wheel-pointer"></div>
      <div class="wheel-circle" style="background:${gradient};transform:rotate(${state.wheelRotation}deg);">
        <div class="wheel-labels">${labels}</div>
      </div>
      <div class="wheel-hub"></div>
    </div>
    <div class="wheel-pool">${chips}</div>
  </div>`;
}

function renderFinaleResult(state) {
  const byId = playersById(state);
  const winner = state.luckyWinnerId ? byId.get(state.luckyWinnerId) : null;
  return `<div class="finale-step finale-result">
    <div class="result-label">LUCKY LOSER</div>
    <div class="result-name" ${winner ? playerClickAttr(winner.id) : ""}>${winner ? escapeHtml(winner.name) : ""}</div>
    <div class="result-actions">
      <button class="btn-reset btn-spin-again" data-action="spin-again">SPINN IGJEN</button>
      <button class="btn-reset" data-action="reset-tournament">NY TURNERING</button>
    </div>
  </div>`;
}

function renderFinale(state) {
  let content;
  if (state.finaleStep === 0) content = renderFinaleStandings(state);
  else if (state.finaleStep === 1) content = renderFinaleWheel(state);
  else content = renderFinaleResult(state);

  const isFinalStep = state.finaleStep === 2 || (state.finaleStep === 0 && !state.luckyLoserEnabled);
  const hint = isFinalStep ? "" : "TRYKK ENTER FOR Å FORTSETTE";

  return `
  <div class="screen screen-finale">
    ${bottomLeftControls(state)}
    <div class="finale-header">
      <img class="finale-logo logo-reset" src="assets/nito-logo.png" alt="NITO" data-action="logo-reset" title="Start en ny turnering">
      <div class="finale-subtitle">TURNERINGEN ER OVER</div>
    </div>
    ${content}
    <div class="finale-hint">${hint}</div>
    ${confettiLayer(state)}
  </div>`;
}

function renderHistoryRow(h, playerName) {
  if (h.type === "walkover") {
    return `
    <div class="history-row history-walkover">
      <div class="history-round">RUNDE ${h.round}</div>
      <div class="history-walkover-text">Walkover denne runden</div>
    </div>`;
  }
  const won = h.result === "win";
  const teammateName = h.teammate ? escapeHtml(h.teammate) : "";
  const opponents = h.opponents || [];
  return `
  <div class="history-row ${won ? "history-win" : "history-loss"}">
    <div class="history-round">RUNDE ${h.round}</div>
    <div class="history-body">
      <div class="history-team history-team-left">
        <div class="history-player-name">${escapeHtml(playerName)}</div>
        ${teammateName ? `<div class="history-player-name">${teammateName}</div>` : ""}
      </div>
      <div class="history-score">${h.myScore}&ndash;${h.opponentScore}</div>
      <div class="history-team history-team-right">
        ${opponents.map((o) => `<div class="history-player-name">${escapeHtml(o)}</div>`).join("")}
      </div>
    </div>
  </div>`;
}

function renderPlayerModal(state) {
  if (!state.selectedPlayerId) return "";
  const player = state.players.find((p) => p.id === state.selectedPlayerId);
  if (!player) return "";

  const position = state.players.findIndex((p) => p.id === player.id) + 1;
  const history = player.history || [];
  const historyHtml = history.length
    ? history.slice().reverse().map((h) => renderHistoryRow(h, player.name)).join("")
    : `<div class="history-empty">Ingen kamper spilt ennå</div>`;

  return `
  <div class="modal-backdrop" data-action="close-player"></div>
  <div class="player-modal">
    <button class="modal-close" data-action="close-player" aria-label="Lukk">×</button>
    <div class="modal-avatar${avatarStreakClass(player)}">${initials(player.name)}</div>
    <div class="modal-name">${escapeHtml(player.name)}</div>
    <div class="modal-position">${position}. PLASS</div>
    <div class="modal-stats">
      <div class="stat-block"><div class="stat-value">${player.wins}</div><div class="stat-label">SEIRE</div></div>
      <div class="stat-block"><div class="stat-value">${player.points}</div><div class="stat-label">POENG</div></div>
    </div>
    <div class="modal-history">
      <div class="modal-history-title">KAMPHISTORIKK</div>
      ${historyHtml}
    </div>
  </div>`;
}

// Logo-click "start over" confirm dialog -- an always-available escape hatch
// (e.g. after refreshing into a stuck state), guarded by a confirm step since
// unlike the finale's "NY TURNERING" button this can be clicked mid-tournament.
function renderResetConfirm() {
  return `
  <div class="modal-backdrop" data-action="cancel-logo-reset"></div>
  <div class="player-modal reset-confirm">
    <div class="modal-name">Start en ny turnering?</div>
    <div class="reset-confirm-text">Dette nullstiller gjeldende turnering &ndash; alle spillere, kamper og resultater går tapt.</div>
    <div class="reset-confirm-actions">
      <button class="btn-reset-cancel" data-action="cancel-logo-reset">AVBRYT</button>
      <button class="btn-reset-confirm" data-action="confirm-logo-reset">JA, START PÅ NYTT</button>
    </div>
  </div>`;
}

// "Remove all players" confirm dialog -- guards the setup screen's
// FJERN ALLE SPILLERE button so a stray click doesn't wipe a typed-in list.
// Only clears state.players; court settings etc. are untouched.
function renderClearPlayersConfirm() {
  return `
  <div class="modal-backdrop" data-action="cancel-clear-players"></div>
  <div class="player-modal reset-confirm">
    <div class="modal-name">Fjerne alle spillere?</div>
    <div class="reset-confirm-text">Dette fjerner alle spillerne fra listen. Bane-innstillinger beholdes.</div>
    <div class="reset-confirm-actions">
      <button class="btn-reset-cancel" data-action="cancel-clear-players">AVBRYT</button>
      <button class="btn-reset-confirm" data-action="confirm-clear-players">JA, FJERN ALLE</button>
    </div>
  </div>`;
}

// The round dropdown atop the admin table: "TOTALT" (current/live standings,
// editable) plus one option per round a snapshot exists for (see
// saveRoundSnapshot in app.js) -- however many rounds have actually been
// built so far, regardless of the current round number.
function adminRoundSelect(state) {
  const rounds = Object.keys(state.roundSnapshots).map(Number).sort((a, b) => a - b);
  const filter = state.adminRoundFilter || "total";
  const options = rounds
    .map((r) => `<option value="${r}" ${filter === String(r) ? "selected" : ""}>RUNDE ${r}</option>`)
    .join("");
  return `
  <select class="admin-round-select" data-bind="admin-round-filter" aria-label="Vis runde">
    <option value="total" ${filter === "total" ? "selected" : ""}>TOTALT</option>
    ${options}
  </select>`;
}

// Read-only view of a past round's snapshot: standings exactly as they were
// the moment that round's matches were built, plus the button to revert the
// whole tournament back to it. No name/stat editing or remove button here --
// this is archived data, not the live players.
function renderAdminRoundSnapshot(state, round, snap) {
  const rows = snap.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "no", { sensitivity: "base" }))
    .map(
      (p) => `
      <tr>
        <td class="admin-table-name">${escapeHtml(p.name)}</td>
        <td>${p.wins}</td>
        <td>${p.points}</td>
        <td>${p.walkoverScore.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
  <div class="modal-backdrop" data-action="close-admin"></div>
  <div class="player-modal admin-modal">
    <button class="modal-close" data-action="close-admin" aria-label="Lukk">×</button>
    <div class="modal-name">ADMIN</div>
    ${adminRoundSelect(state)}
    <div class="modal-position">Stilling ved start av runde ${round} &middot; ${snap.players.length} SPILLERE</div>
    <table class="admin-table admin-table-readonly">
      <thead><tr><th>Navn</th><th>Seire</th><th>Poeng</th><th>Walkover</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <button class="btn-revert-round" data-action="request-revert-round" data-round="${round}">REVERTER TIL RUNDE ${round}</button>
  </div>`;
}

// Admin table: every player, alphabetical (Norwegian collation so æøå sort
// correctly), with wins/points plus the walkoverScore that's otherwise never
// shown anywhere in the live UI -- see walkoverCost/pickBenched in
// tournament.js for what that number actually means. The round dropdown
// switches this to a read-only look at an earlier round (renderAdminRoundSnapshot).
function renderAdminTable(state) {
  const filter = state.adminRoundFilter || "total";
  if (filter !== "total") {
    const round = Number(filter);
    const snap = state.roundSnapshots[round];
    if (snap) return renderAdminRoundSnapshot(state, round, snap);
    // stale selection (snapshot pruned by an earlier revert) -- fall through to the total view below
  }

  const rows = state.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "no", { sensitivity: "base" }))
    .map(
      (p) => `
      <tr>
        <td class="admin-table-name">
          <input class="admin-name-input" data-bind="admin-player-name" data-player-id="${p.id}" value="${escapeHtml(p.name)}" aria-label="Navn">
          ${p.pendingRemoval ? `<span class="pending-removal-badge">FJERNES</span>` : ""}
        </td>
        <td><input class="admin-stat-input" type="number" step="1" data-bind="admin-player-wins" data-player-id="${p.id}" value="${p.wins}" aria-label="Seire"></td>
        <td><input class="admin-stat-input" type="number" step="1" data-bind="admin-player-points" data-player-id="${p.id}" value="${p.points}" aria-label="Poeng"></td>
        <td>${p.walkoverScore.toFixed(2)}</td>
        <td><button class="admin-remove-btn" data-action="request-remove-player" data-player-id="${p.id}">FJERN</button></td>
      </tr>`
    )
    .join("");

  return `
  <div class="modal-backdrop" data-action="close-admin"></div>
  <div class="player-modal admin-modal">
    <button class="modal-close" data-action="close-admin" aria-label="Lukk">×</button>
    <div class="modal-name">ADMIN</div>
    ${adminRoundSelect(state)}
    <div class="modal-position">${state.players.length} SPILLERE</div>
    ${state.players.length
      ? `<table class="admin-table">
          <thead>
            <tr><th>Navn</th><th>Seire</th><th>Poeng</th><th>Walkover</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
      : `<div class="history-empty">Ingen spillere ennå</div>`}
    ${state.phase === "live" ? `
    <div class="admin-add-player">
      <input class="admin-add-input" data-bind="admin-new-player-name" value="${escapeHtml(state.adminNewPlayerName || "")}" placeholder="Navn på ny spiller" aria-label="Ny spiller">
      <button class="admin-add-btn" data-action="add-player-admin">LEGG TIL</button>
    </div>
    ${state.addPlayerError ? `<div class="add-player-error">${escapeHtml(state.addPlayerError)}</div>` : ""}
    <div class="admin-add-hint">Nye spillere blir med fra neste runde.</div>` : ""}
  </div>`;
}

// Remove-player picker, opened from a row's FJERN button. Pre-tournament (or
// once the finale's started) there's no round in progress to disrupt, so it's
// a plain yes/no confirm; live, it offers the 3 removal modes described in
// app.js's removePlayerNow/removePlayerNextRound/removePlayerWalkoverSwap --
// the walkover-swap option only makes sense (and is only shown) when the
// player is actually in one of the currently displayed matches AND someone
// is actually on walkover this round to step into their spot.
function renderRemovePlayerConfirm(state) {
  const player = state.players.find((p) => p.id === state.removalTargetId);
  if (!player) return renderAdminTable(state); // stale id (already removed) -- fall back

  const isLive = state.phase === "live";
  const inCurrentMatch = isLive && state.matches.some((m) => m.team1.includes(player.id) || m.team2.includes(player.id));
  const hasWalkoverSub = inCurrentMatch && state.walkoverPlayerIds.length > 0;

  if (!isLive) {
    return `
    <div class="modal-backdrop" data-action="cancel-remove-player"></div>
    <div class="player-modal reset-confirm">
      <div class="modal-name">Fjerne ${escapeHtml(player.name)}?</div>
      <div class="reset-confirm-text">Spilleren fjernes fra turneringen.</div>
      <div class="reset-confirm-actions">
        <button class="btn-reset-cancel" data-action="cancel-remove-player">AVBRYT</button>
        <button class="btn-reset-confirm" data-action="remove-player-now" data-player-id="${player.id}">JA, FJERN</button>
      </div>
    </div>`;
  }

  return `
  <div class="modal-backdrop" data-action="cancel-remove-player"></div>
  <div class="player-modal remove-player-modal">
    <div class="modal-name">Fjerne ${escapeHtml(player.name)}?</div>
    <div class="remove-player-options">
      <button class="remove-option" data-action="remove-player-now" data-player-id="${player.id}">
        <div class="remove-option-title">FJERN NÅ</div>
        <div class="remove-option-desc">${inCurrentMatch
          ? `Kampen ${escapeHtml(player.name)} spiller i nå avbrytes, og hele runden settes opp på nytt med nye lag.`
          : `Fjernes umiddelbart fra turneringen.`}</div>
      </button>
      <button class="remove-option" data-action="remove-player-next-round" data-player-id="${player.id}">
        <div class="remove-option-title">FJERN FRA NESTE RUNDE</div>
        <div class="remove-option-desc">${escapeHtml(player.name)} fullfører denne runden som normalt, og er borte når neste runde settes opp.</div>
      </button>
      ${hasWalkoverSub ? `
      <button class="remove-option" data-action="remove-player-walkover-swap" data-player-id="${player.id}">
        <div class="remove-option-title">FJERN NÅ &ndash; SETT INN WALKOVER-SPILLER</div>
        <div class="remove-option-desc">En spiller som står over denne runden tar plassen til ${escapeHtml(player.name)}, og kampen fortsetter som normalt. Resten av runden er uendret.</div>
      </button>` : ""}
    </div>
    <button class="btn-reset-cancel" data-action="cancel-remove-player">AVBRYT</button>
  </div>`;
}

// Screen and modal are rendered independently (see app.js's screenEl/modalEl) so
// that opening/closing a popup never touches the screen's own DOM -- otherwise
// rebuilding it would replay the .live-view/.finale-standings-row fadeSlide
// entrance animations, which looks like the background "jumping".
export function renderScreen(state) {
  document.documentElement.setAttribute("data-theme", state.theme);
  if (state.phase === "setup") return renderSetup(state);
  if (state.phase === "live") return renderLive(state);
  return renderFinale(state);
}

// "Revert to round N" confirm -- guards the admin table's round-snapshot
// view (renderAdminRoundSnapshot) the same way logo-reset/clear-players
// guard theirs, since committing discards every round after N for good.
function renderRevertRoundConfirm(state) {
  const round = state.confirmingRevertRound;
  return `
  <div class="modal-backdrop" data-action="cancel-revert-round"></div>
  <div class="player-modal reset-confirm">
    <div class="modal-name">Reverter til runde ${round}?</div>
    <div class="reset-confirm-text">Kamper og resultater fra runde ${round + 1} og senere slettes permanent. Runde ${round} settes opp på nytt med de opprinnelige lagene og stillingen fra da.</div>
    <div class="reset-confirm-actions">
      <button class="btn-reset-cancel" data-action="cancel-revert-round">AVBRYT</button>
      <button class="btn-reset-confirm" data-action="confirm-revert-round" data-round="${round}">JA, REVERTER</button>
    </div>
  </div>`;
}

export function renderModalContent(state) {
  if (state.confirmingReset) return renderResetConfirm();
  if (state.confirmingClearPlayers) return renderClearPlayersConfirm();
  if (state.confirmingRevertRound !== null) return renderRevertRoundConfirm(state);
  if (state.removalTargetId) return renderRemovePlayerConfirm(state);
  if (state.showAdminTable) return renderAdminTable(state);
  return renderPlayerModal(state);
}
