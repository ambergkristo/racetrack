import { Panel, escapeHtml } from "../ui/index.mjs";

function formatMs(milliseconds) {
  if (!milliseconds) {
    return "--";
  }

  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function routeBadge(label, value) {
  return `
    <div class="metric-card">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderRosterRows(racers) {
  if (!racers.length) {
    return '<div class="empty-state">Waiting for the next socket snapshot to load the roster.</div>';
  }

  return racers
    .map(
      (racer) => `
        <div class="roster-row">
          <div>
            <strong>${escapeHtml(racer.name)}</strong>
            <span>Lane ${escapeHtml(racer.lane)}</span>
          </div>
          <span class="chip">Kart ${escapeHtml(racer.kart)}</span>
        </div>
      `
    )
    .join("");
}

function leaderboardTable(entries) {
  if (!entries.length) {
    return '<div class="empty-state">Leaderboard positions will appear as soon as the race feed starts broadcasting.</div>';
  }

  const rows = entries
    .map(
      (entry) => `
        <tr>
          <td>${entry.position}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${escapeHtml(entry.kart)}</td>
          <td>${entry.laps}</td>
          <td>${formatMs(entry.bestLapMs)}</td>
          <td>${formatMs(entry.lastLapMs)}</td>
          <td>${entry.position === 1 ? "LEAD" : `+${formatMs(entry.gapMs)}`}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="table-wrap">
      <table class="telemetry-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Driver</th>
            <th>Kart</th>
            <th>Laps</th>
            <th>Best</th>
            <th>Last</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderLeaderboardPanels({ raceState, leaderboard, timer }) {
  const leader = leaderboard.entries[0];
  const heroBody = `
    <div class="hero-stack">
      <div class="hero-value">${escapeHtml(timer.formatted)}</div>
      <p class="hero-copy">${escapeHtml(raceState.phaseLabel)}</p>
      <div class="metric-grid">
        ${routeBadge("Current Heat", raceState.currentRace.title)}
        ${routeBadge("Flag", raceState.flag.label)}
        ${routeBadge("Laps Complete", `${raceState.currentRace.lapsCompleted}/${raceState.currentRace.totalLaps}`)}
      </div>
    </div>
  `;
  const leaderBody = leader
    ? `
        <div class="leader-card">
          <span class="metric-label">P1</span>
          <strong>${escapeHtml(leader.name)}</strong>
          <span>${escapeHtml(leader.kart)} · ${leader.laps} laps</span>
          <p class="panel-copy">Best lap ${formatMs(leader.bestLapMs)} under ${escapeHtml(raceState.flag.label.toLowerCase())} conditions.</p>
        </div>
      `
    : '<div class="empty-state">Waiting for the first leaderboard update.</div>';

  return [
    Panel({
      title: "Live Race Window",
      kicker: "Leaderboard",
      tone: raceState.flag.tone,
      className: "span-8",
      body: heroBody,
    }),
    Panel({
      title: "Current Leader",
      kicker: "Telemetry",
      tone: "warning",
      className: "span-4",
      body: leaderBody,
    }),
    Panel({
      title: "Position Table",
      kicker: "Realtime order",
      tone: "safe",
      className: "span-12",
      body: leaderboardTable(leaderboard.entries),
    }),
  ].join("");
}

function renderNextRacePanels({ raceState, timer }) {
  return [
    Panel({
      title: "Queue Window",
      kicker: "Next race",
      tone: "warning",
      className: "span-7",
      body: `
        <div class="hero-stack">
          <div class="hero-value">${escapeHtml(raceState.nextRace.title)}</div>
          <p class="hero-copy">${escapeHtml(raceState.nextRace.queueStatus)}</p>
          <div class="metric-grid">
            ${routeBadge("Launch In", timer.formatted)}
            ${routeBadge("Ready Drivers", `${raceState.queue.readyCount}/${raceState.queue.totalCount}`)}
            ${routeBadge("Track State", raceState.flag.label)}
          </div>
        </div>
      `,
    }),
    Panel({
      title: "Pit Call",
      kicker: "Marshal note",
      tone: raceState.flag.tone,
      className: "span-5",
      body: `
        <div class="callout-box">
          <strong>${escapeHtml(raceState.queue.pitMessage)}</strong>
          <p class="panel-copy">${escapeHtml(raceState.nextRace.pitMessage)}</p>
        </div>
      `,
    }),
    Panel({
      title: "Queued Roster",
      kicker: "Drivers + karts",
      tone: "safe",
      className: "span-12",
      body: `<div class="roster-list">${renderRosterRows(raceState.nextRace.racers)}</div>`,
    }),
  ].join("");
}

function renderCountdownPanels({ raceState, timer }) {
  return [
    Panel({
      title: "Server Timer",
      kicker: "Countdown",
      tone: raceState.flag.tone,
      className: "span-8",
      body: `
        <div class="countdown-board">
          <div class="countdown-digits">${escapeHtml(timer.formatted)}</div>
          <p class="hero-copy">${escapeHtml(raceState.phaseLabel)}</p>
          <div class="progress-rail">
            <div class="progress-fill tone-${escapeHtml(raceState.flag.tone)}" style="width: ${timer.progressPercent}%"></div>
          </div>
        </div>
      `,
    }),
    Panel({
      title: "Transition Signals",
      kicker: "What happens next",
      tone: "warning",
      className: "span-4",
      body: `
        <div class="stack-list">
          <div class="info-row"><span>Current Heat</span><strong>${escapeHtml(raceState.currentRace.title)}</strong></div>
          <div class="info-row"><span>Next Heat</span><strong>${escapeHtml(raceState.nextRace.title)}</strong></div>
          <div class="info-row"><span>Current Flag</span><strong>${escapeHtml(raceState.flag.code)}</strong></div>
        </div>
      `,
    }),
    Panel({
      title: "Queue Readiness",
      kicker: "Launch baseline",
      tone: "safe",
      className: "span-12",
      body: `
        <div class="metric-grid wide">
          ${routeBadge("Ready", `${raceState.queue.readyCount}/${raceState.queue.totalCount}`)}
          ${routeBadge("Laps", `${raceState.currentRace.lapsCompleted}/${raceState.currentRace.totalLaps}`)}
          ${routeBadge("Venue", raceState.venue)}
          ${routeBadge("Phase", raceState.phase)}
        </div>
      `,
    }),
  ].join("");
}

function renderFlagPanels({ raceState, timer }) {
  return [
    Panel({
      title: "Track Flag",
      kicker: "Public board",
      tone: raceState.flag.tone,
      className: "span-12 flag-panel",
      body: `
        <div class="flag-board tone-${escapeHtml(raceState.flag.tone)} ${raceState.flag.code === "FINISHED" ? "finished-pattern" : ""}">
          <span class="flag-code">${escapeHtml(raceState.flag.code)}</span>
          <strong>${escapeHtml(raceState.flag.label)}</strong>
          <p>${escapeHtml(raceState.flag.detail)}</p>
          <span class="flag-timer">${escapeHtml(timer.formatted)}</span>
        </div>
      `,
    }),
    Panel({
      title: "Marshal Guidance",
      kicker: "Ops note",
      tone: "warning",
      className: "span-6",
      body: `
        <div class="stack-list">
          <div class="info-row"><span>Phase</span><strong>${escapeHtml(raceState.phase)}</strong></div>
          <div class="info-row"><span>Heat</span><strong>${escapeHtml(raceState.currentRace.title)}</strong></div>
          <div class="info-row"><span>Queue</span><strong>${escapeHtml(raceState.nextRace.queueStatus)}</strong></div>
        </div>
      `,
    }),
    Panel({
      title: "Next Action",
      kicker: "Pit lane",
      tone: "danger",
      className: "span-6",
      body: `
        <div class="callout-box">
          <strong>${escapeHtml(raceState.queue.pitMessage)}</strong>
          <p class="panel-copy">${escapeHtml(raceState.flag.detail)}</p>
        </div>
      `,
    }),
  ].join("");
}

export function renderPublicRoutePanels({ route, raceState, leaderboard, timer }) {
  if (route === "/leader-board") {
    return renderLeaderboardPanels({ raceState, leaderboard, timer });
  }

  if (route === "/next-race") {
    return renderNextRacePanels({ raceState, timer });
  }

  if (route === "/race-countdown") {
    return renderCountdownPanels({ raceState, timer });
  }

  return renderFlagPanels({ raceState, timer });
}
