// Generated from client/src. Run `npm run sync:client` after editing source modules.
  function leaderboardTable(
    entries,
    {
      limit = entries.length,
      wrapClass = "",
      tableClass = "",
    } = {}
  ) {
    if (isInitialPublicLoad()) {
      return loadingSkeleton(5);
    }

    if (entries.length === 0) {
      return emptyState(
        "Leaderboard waiting for the first lap",
        "As soon as lap crossings arrive, positions and best laps will populate here."
      );
    }

    const leaderBestLapMs =
      entries.find((entry) => Number.isFinite(entry.bestLapTimeMs))?.bestLapTimeMs ?? null;
    const visibleEntries = entries.slice(0, limit);
    const columns = ["Pos", "Car", "Racer", "Best Lap", "Live Lap", "Laps"];

    return dataTable(
      columns,
      visibleEntries.map(
        (entry) => {
          const finishMeta = Number.isFinite(entry.finishPlace)
            ? ` · ${formatOrdinal(entry.finishPlace)} over the line`
            : "";
          return `
          <tr class="${entry.position === 1 ? "leader-row" : ""}${Number.isFinite(entry.finishPlace) ? " finish-row" : ""}">
            <td><span class="position-badge">${escapeHtml(String(entry.position))}</span></td>
            <td><span class="car-badge">${escapeHtml(entry.carNumber || "--")}</span></td>
            <td>
              <div class="driver-cell">
                <strong>${escapeHtml(entry.name)}</strong>
                <span>${escapeHtml(`${formatDeltaToLeader(entry, leaderBestLapMs)}${finishMeta}`)}</span>
              </div>
            </td>
            <td class="timing-cell ${entry.bestLapTimeMs === leaderBestLapMs ? "is-best" : ""}">${escapeHtml(formatLap(entry.bestLapTimeMs))}</td>
            <td class="timing-cell">${escapeHtml(formatLap(entry.currentLapTimeMs))}</td>
            <td class="timing-cell">${entry.lapCount}</td>
          </tr>
        `;
        }
      ),
      { wrapClass, tableClass }
    );
  }

  function leaderboardTimingBoard(
    entries,
    {
      limit = entries.length,
      wrapClass = "",
    } = {}
  ) {
    if (isInitialPublicLoad()) {
      return loadingSkeleton(5);
    }

    if (entries.length === 0) {
      return emptyState(
        "Leaderboard waiting for the first lap",
        "As soon as lap crossings arrive, positions and best laps will populate here."
      );
    }

    const leaderBestLapMs =
      entries.find((entry) => Number.isFinite(entry.bestLapTimeMs))?.bestLapTimeMs ?? null;
    const visibleEntries = entries.slice(0, limit);

    return `
      <div class="leaderboard-board ${wrapClass}">
        ${visibleEntries
          .map((entry, index) => {
            const rowToneClass =
              entry.position === 1 ? " is-leader" : index % 2 === 1 ? " is-alt" : "";
            const finishMeta = Number.isFinite(entry.finishPlace)
              ? ` · ${formatOrdinal(entry.finishPlace)} over the line`
              : "";
            const deltaLabel = `${formatDeltaToLeader(entry, leaderBestLapMs)}${finishMeta}`;
            return `
              <article class="leaderboard-board-row${rowToneClass}${Number.isFinite(entry.finishPlace) ? " is-finished" : ""}">
                <div class="leaderboard-pos-stack">
                  <span class="leaderboard-pos-label">Pos</span>
                  <strong class="leaderboard-pos-value">${escapeHtml(String(entry.position))}</strong>
                </div>
                <div class="leaderboard-car-stack">
                  <span class="leaderboard-car-badge">${escapeHtml(entry.carNumber || "--")}</span>
                </div>
                <div class="leaderboard-driver-stack">
                  <strong class="leaderboard-driver-name">${escapeHtml(entry.name)}</strong>
                  <span class="leaderboard-driver-meta">${escapeHtml(deltaLabel)}</span>
                </div>
                <div class="leaderboard-time-stack">
                  <span class="leaderboard-time-label">Best</span>
                  <strong class="leaderboard-time-value${entry.bestLapTimeMs === leaderBestLapMs ? " is-best" : ""}">${escapeHtml(
                    formatLap(entry.bestLapTimeMs)
                  )}</strong>
                </div>
                <div class="leaderboard-time-stack leaderboard-live-stack">
                  <span class="leaderboard-time-label">Live</span>
                  <strong class="leaderboard-time-value">${escapeHtml(
                    formatLap(entry.currentLapTimeMs)
                  )}</strong>
                </div>
                <div class="leaderboard-lap-stack">
                  <span class="leaderboard-time-label">Laps</span>
                  <strong class="leaderboard-lap-value">${escapeHtml(String(entry.lapCount))}</strong>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }
  function publicStatusPanel() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    const activeSession = getDisplaySession();
    const connectionMeta = getConnectionMeta();
    const syncBanner =
      state.connection === "reconnecting" || state.awaitingLiveResync || state.connection === "error"
        ? inlineAlert({
            tone:
              state.connection === "error"
                ? "danger"
                : state.awaitingLiveResync
                  ? "warning"
                  : "warning",
            title: connectionMeta.label,
            detail: connectionMeta.detail,
          })
        : "";
    const fullscreenBanner = state.fullscreenError
      ? inlineAlert({
          tone: "danger",
          title: "Fullscreen needs manual recovery",
          detail: state.fullscreenError,
        })
      : "";
    const confidenceMarkup = `
      <div class="confidence-row">
        <span class="chip">Last sync ${escapeHtml(formatTimestamp(state.lastSyncAt))}</span>
        <span class="chip">${routeConfig.public ? "No polling" : "Socket only"}</span>
        <span class="chip">${escapeHtml(state.socketConnectedOnce ? "Resync ready" : "First sync pending")}</span>
      </div>
    `;

    return panel(
      "Live State",
      `
        <div class="public-state-shell">
          <div class="public-state-copy">
            <p class="section-kicker">Presentation mode</p>
            <strong class="overview-title">${escapeHtml(flagMeta.label)}</strong>
            <span class="public-state-detail">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
          </div>
          <div class="kpi-grid">
            ${kpiPill("Phase", STATE_META[snapshot.state]?.label || snapshot.state, STATE_META[snapshot.state]?.tone || "safe")}
            ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
            ${kpiPill("Sync", state.awaitingLiveResync ? "PENDING" : "LIVE", state.awaitingLiveResync ? "warning" : "safe")}
            ${kpiPill("Rows", String(snapshot.leaderboard.length), snapshot.leaderboard.length ? "safe" : "warning")}
          </div>
        </div>
        ${syncBanner}
        ${fullscreenBanner}
        ${confidenceMarkup}
        <p class="hint">${escapeHtml(flagMeta.detail)}</p>
      `,
      flagMeta.tone,
      `panel-wide${finishedClass(snapshot)}`
    );
  }

  function activeRosterTable(session) {
    if (isInitialPublicLoad()) {
      return loadingSkeleton(4);
    }

    if (!session || session.racers.length === 0) {
      return emptyState(
        "No racers staged",
        "When a session is staged, the current roster will appear here."
      );
    }

    return dataTable(
      ["Racer", "Car", "Laps", "Best"],
      session.racers.map(
        (racer) => `
          <tr>
            <td>${escapeHtml(racer.name)}</td>
            <td>${escapeHtml(racer.carNumber || "--")}</td>
            <td>${racer.lapCount}</td>
            <td>${escapeHtml(formatLap(racer.bestLapTimeMs))}</td>
          </tr>
        `
      ),
      { compact: true }
    );
  }

  function leaderBoardPanels() {
    const activeSession = hasHeldResults() && state.raceSnapshot.lockedSession
      ? state.raceSnapshot.lockedSession
      : getDisplaySession();
    const displayEntries = getDisplayLeaderboardEntries();
    const leader = displayEntries[0] || null;
    const flagMeta = getFlagMeta();
    const countdownLabel = formatTime(state.raceSnapshot.remainingSeconds);
    const leaderBestLap = leader ? formatLap(leader.bestLapTimeMs) : "--";
    const leaderCurrentLap = leader ? formatLap(leader.currentLapTimeMs) : "--";
    const leaderSecondary = leader
      ? Number.isFinite(leader.finishPlace)
        ? `Best ${leaderBestLap} · ${formatOrdinal(leader.finishPlace)} over the line`
        : `Best ${leaderBestLap} · Live ${leaderCurrentLap}`
      : "Best -- · Live --";
    return [
      panel(
        "Timing Tower",
        `
          <div class="leaderboard-top-strip">
            <div class="glance-metric-grid">
              ${kpiPill("State", STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state, flagMeta.tone)}
              ${kpiPill("Flag", flagMeta.label, flagMeta.tone)}
              ${kpiPill("Countdown", countdownLabel, "danger")}
            </div>
            <div class="leaderboard-leader-meta${finishedClass()}">
              <p class="section-kicker">Leader</p>
              <strong class="leaderboard-leader-name">${escapeHtml(leader ? leader.name : "Waiting for first lap")}</strong>
              <span class="leaderboard-leader-session">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
              <span class="leaderboard-leader-laps">${escapeHtml(leaderSecondary)}</span>
              <span class="leaderboard-state-detail">${escapeHtml(flagMeta.detail)}</span>
            </div>
          </div>
          <div class="leaderboard-table-shell">
            ${leaderboardTimingBoard(displayEntries, {
              wrapClass: "leaderboard-scroll",
              finishOrderActive: state.raceSnapshot.finishOrderActive,
            })}
          </div>
        `,
        flagMeta.tone,
        `panel-wide public-display-panel leaderboard-panel${finishedClass()}`
      ),
    ].join("");
  }

  function nextRacePanels() {
    const activeSession = state.raceSnapshot.activeSession;
    const simulation = getSimulationMeta();
    const simulationPhaseMeta = getSimulationPhaseMeta(simulation);
    const endedSession =
      (state.raceSnapshot.state !== "RUNNING" && state.raceSnapshot.lockedSession)
        ? state.raceSnapshot.lockedSession
        : null;
    const endSessionActive = Boolean(endedSession);
    const pitReturnTelemetryActive = endSessionActive || simulation.phase === "PIT_RETURN";
    const nextSession = state.raceSnapshot.nextSession || getQueuedSessions()[0] || null;
    const featuredSession = endSessionActive ? endedSession : nextSession;
    const flagMeta = getFlagMeta();
    const runningRace = state.raceSnapshot.state === "RUNNING";
    const topThreeEntries = (runningRace || pitReturnTelemetryActive || state.raceSnapshot.finishOrderActive)
      ? getDisplayLeaderboardEntries().slice(0, 3)
      : [];
    const topThreeMarkup = (runningRace || pitReturnTelemetryActive || state.raceSnapshot.finishOrderActive)
      ? topThreeEntries.length > 0
        ? `
          <div class="next-race-top-three-grid">
            ${topThreeEntries
              .map((entry, index) => {
                const timingValue = Number.isFinite(entry?.bestLapTimeMs)
                  ? formatLap(entry.bestLapTimeMs)
                  : "Lap pending";
                return `
                  <article class="next-race-top-three-card place-${index + 1}">
                    <span class="next-race-top-place">${escapeHtml(formatOrdinal(index + 1))}</span>
                    <strong>${escapeHtml(entry.name || `Car ${entry.carNumber || "--"}`)}</strong>
                    <span class="next-race-top-time">${escapeHtml(timingValue)}</span>
                  </article>
                `;
              })
              .join("")}
          </div>
        `
        : `
          <div class="next-race-top-three-empty">
            <strong>Current race Top 3 is waiting on live laps.</strong>
            <span>As soon as crossing data arrives, the lead trio appears here automatically.</span>
          </div>
        `
      : `
        <div class="next-race-top-three-idle">
          <strong>Current race Top 3 appears once the race is running.</strong>
        </div>
      `;
    const statusDetail = endSessionActive
      ? "Safety Official ended this session. Drivers should proceed to the paddock."
      : simulation.phase === "PIT_RETURN"
        ? simulationPhaseMeta.detail
      : STATE_META[state.raceSnapshot.state]?.detail || "Waiting for the next session to be staged.";
    const featuredCopy = endSessionActive
      ? "This finished lineup should proceed to the paddock."
      : nextSession
        ? "Next lineup waiting to take the track."
        : "Front desk has not staged the next lineup yet.";
    const featuredTone = endSessionActive ? "danger" : "safe";

    return [
      panel(
        "Race Board",
        `
          <div class="next-race-status-strip">
            <div class="next-race-status-copy">
              <p class="section-kicker">Race board</p>
              <strong class="next-race-status-title">${escapeHtml(flagMeta.label)}</strong>
              <span class="public-state-detail">${escapeHtml(statusDetail)}</span>
            </div>
            <div class="glance-metric-grid">
              ${kpiPill("Board", endSessionActive ? "Paddock" : "Next lineup", endSessionActive ? "danger" : "safe")}
              ${kpiPill("Session", featuredSession ? featuredSession.name : "Waiting", featuredSession ? featuredTone : "warning")}
              ${kpiPill(endSessionActive ? "Drivers Returning" : "Drivers Queued", String(featuredSession ? featuredSession.racers.length : 0), featuredSession ? "safe" : "warning")}
              ${kpiPill("Track State", flagMeta.label, flagMeta.tone)}
            </div>
          </div>
          <div class="session-board-grid${finishedClass()}">
            <div class="session-board tone-${escapeHtml(featuredTone)} ${endSessionActive ? "session-board-pit" : ""}">
              <p class="section-kicker">${escapeHtml(endSessionActive ? "Proceed to paddock" : "Next session lineup")}</p>
              <strong>${escapeHtml(featuredSession ? featuredSession.name : endSessionActive ? "Finished session unavailable" : "No queued session")}</strong>
              <span>${escapeHtml(featuredCopy)}</span>
              ${
                endSessionActive
                  ? `<div class="next-race-pit-callout"><strong>Proceed to the paddock</strong><span>Call this finished lineup forward before the next safe start.</span></div>`
                  : ""
              }
              ${rosterStrip(featuredSession, {
                emptyTitle: endSessionActive ? "Finished session roster unavailable" : "Next lineup not ready",
                emptyDetail: endSessionActive
                  ? "The finished session roster stays here until the next race starts safely."
                  : "Front desk has not staged the next lineup yet.",
                gridClass: "next-race-roster-grid",
              })}
            </div>
          </div>
          <section class="next-race-top-three-shell">
            <div class="next-race-top-three-head">
              <div>
                <p class="section-kicker">Current race Top 3</p>
                <strong class="next-race-top-three-title">${escapeHtml(
                  runningRace ? "Live names and pace" : pitReturnTelemetryActive ? "Final order during pit return" : "Stand by for live race order"
                )}</strong>
              </div>
            </div>
            ${topThreeMarkup}
          </section>
        `,
        "warning",
        `panel-wide public-display-panel next-race-panel${finishedClass()}`
      ),
    ].join("");
  }

  function countdownPanels() {
    const activeSession = getDisplaySession();
    const queued = getQueuedSessions()[0] || null;
    const flagMeta = getFlagMeta();
    return [
      panel(
        "Race Countdown",
        `
          <div class="countdown-focus-shell">
            <div class="public-glance-copy">
              <p class="section-kicker">Primary question</p>
              <strong class="public-question">${escapeHtml(publicRouteQuestion())}</strong>
              <span class="public-state-detail">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
            </div>
            <div class="countdown-shell tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
              <div class="countdown-board tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
                <p class="section-kicker">Official timer</p>
                <div class="countdown-digits">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</div>
                <p class="hero-copy">${escapeHtml(STATE_META[state.raceSnapshot.state]?.detail || "")}</p>
              </div>
              <div class="countdown-side">
                <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(flagMeta.label)}</span>
                <strong>${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong>
                <span>${escapeHtml(flagMeta.detail)}</span>
                ${rosterStrip(activeSession, {
                  emptyTitle: "No roster on screen",
                  emptyDetail: "Stage a session to show the active lineup.",
                  limit: 3,
                })}
                <div class="stack-list">
                  <div class="info-row"><span>State</span><strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong></div>
                  <div class="info-row"><span>Next</span><strong>${escapeHtml(queued ? queued.name : "Waiting")}</strong></div>
                </div>
              </div>
            </div>
          </div>
        `,
        flagMeta.tone,
        `panel-wide public-display-panel countdown-panel${finishedClass()}`
      ),
    ].join("");
  }

  function flagPanels() {
    const flagMeta = getFlagMeta();
    const displaySession = getDisplaySession();
    const flagVisualClass =
      state.raceSnapshot.flag === "SAFE"
        ? "is-safe"
        : state.raceSnapshot.flag === "HAZARD_SLOW"
          ? "is-hazard-slow"
          : state.raceSnapshot.flag === "HAZARD_STOP"
            ? "is-hazard-stop"
            : state.raceSnapshot.flag === "CHECKERED"
              ? "is-checkered"
              : "is-locked";
    return [
      panel(
        "Track State Board",
        `
          <div class="flag-shell flag-shell-minimal">
            <div class="flag-board tone-${escapeHtml(flagMeta.tone)} ${flagVisualClass}${finishedClass()}">
              <p class="section-kicker">Current flag</p>
              <span class="flag-code">${escapeHtml(flagMeta.label.toUpperCase())}</span>
              <strong class="flag-display-label">${escapeHtml(flagMeta.label)}</strong>
              <p>${escapeHtml(publicStateMeaning())}</p>
              <span class="flag-session">${escapeHtml(displaySession ? displaySession.name : "No active session")}</span>
              <span class="flag-timer">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</span>
            </div>
          </div>
        `,
        flagMeta.tone,
        "panel-wide public-display-panel flag-panel"
      ),
    ].join("");
  }
