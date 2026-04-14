// Generated from client/src. Run `npm run sync:client` after editing source modules.
  function raceControlPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const displayEntries = getDisplayLeaderboardEntries(snapshot);
    const accessReason = staffAccessReason();
    const flagMeta = getFlagMeta(snapshot);
    const checkeredActive = snapshot.state === "FINISHED";
    const lockedActive = snapshot.state === "LOCKED";
    const startReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      activeSession ? "" : "Stage a session first.",
      snapshot.state === "STAGING" ? "" : "Only from staging."
    );
    const finishReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      snapshot.state === "RUNNING" ? "" : "Only while running."
    );
    const lockReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      snapshot.state === "FINISHED" ? "" : "Only after finish."
    );
    const modeReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      snapshot.state === "RUNNING" ? "" : "Modes only during running."
    );
    const modeVisible = snapshot.state === "RUNNING";
    const authorityNote = flagMeta.detail;

    const modeButtons = RACE_CONTROL_MODES.map((mode) => {
      const active = snapshot.mode === mode;
      return buttonMarkup({
        label: MODE_META[mode].label,
        variant: "ghost",
        active,
        disabled: Boolean(modeReason),
        attrs: `data-action="set-mode" data-mode="${mode}"`,
      });
    }).join("");

    return panel(
      "Race Control Console",
      `
        <div class="race-control-console">
          <div class="race-control-top-grid">
            <div class="race-control-state-summary tone-${flagMeta.tone} ${checkeredActive ? "checkered-stage" : ""} ${lockedActive ? "locked-stage" : ""}">
              <div class="race-control-state-copy">
                <p class="section-kicker">Current authority</p>
                <div class="race-control-state-line">
                  <strong class="command-stage-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
                  <span class="race-control-session-name">${escapeHtml(activeSession ? activeSession.name : "No session staged")}</span>
                </div>
                <span class="race-control-state-note">${escapeHtml(authorityNote)}</span>
              </div>
              <div class="race-control-actions">
                <div class="race-command race-command-start ${startReason ? "is-blocked" : "is-live"}">
                  ${buttonMarkup({ id: "race-start-btn", label: "Start Race", disabled: Boolean(startReason) })}
                  <p class="command-hint">${escapeHtml(startReason || "Begin the live race.")}</p>
                </div>
                <div class="race-command race-command-finish ${finishReason ? "is-blocked" : "is-live"}">
                  ${buttonMarkup({ id: "race-finish-btn", label: "Finish Race", variant: "warning", disabled: Boolean(finishReason) })}
                  <p class="command-hint">${escapeHtml(finishReason || "Call checkered and keep post-finish laps open.")}</p>
                </div>
                <div class="race-command race-command-lock ${lockReason ? "is-blocked" : "is-live"}">
                  ${buttonMarkup({ id: "race-lock-btn", label: "End + Lock", variant: "danger", disabled: Boolean(lockReason) })}
                  <p class="command-hint">${escapeHtml(lockReason || "Close scoring and lock the result.")}</p>
                </div>
              </div>
            </div>
            <div class="race-control-sidecar">
              ${raceControlConsoleStatusBody()}
              <div class="race-control-mode-shell">
                <div class="race-control-mode-block">
                  <p class="section-kicker">Flag mode</p>
                  <strong class="summary-value">${escapeHtml(MODE_META[snapshot.mode]?.label || snapshot.mode)}</strong>
                </div>
                ${
                  modeVisible
                    ? `
                      <div class="mode-grid">${modeButtons}</div>
                    `
                    : `
                      <div class="mode-standby">
                        <strong>Mode controls hidden</strong>
                        <span>${escapeHtml(modeReason)}</span>
                      </div>
                    `
                }
              </div>
            </div>
          </div>
          <div class="race-control-live-order-card">
            ${leaderboardTable(displayEntries, {
              wrapClass: "race-order-scroll",
              finishOrderActive: snapshot.finishOrderActive,
            })}
          </div>
        </div>
      `,
      "warning",
      "staff-main-panel race-control-panel"
    );
  }
  function bindRaceControlEvents() {
    const startBtn = document.getElementById("race-start-btn");
    const finishBtn = document.getElementById("race-finish-btn");
    const lockBtn = document.getElementById("race-lock-btn");

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/start", {
              method: "POST",
              body: {},
            }),
          "Race started."
        );
      });
    }

    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/finish", {
              method: "POST",
              body: {},
            }),
          "Race finished."
        );
      });
    }

    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/lock", {
              method: "POST",
              body: {},
            }),
          "Session locked."
        );
      });
    }

    document.querySelectorAll("[data-action='set-mode']").forEach((node) => {
      node.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/mode", {
              method: "POST",
              body: { mode: node.dataset.mode },
            }),
          `${MODE_META[node.dataset.mode]?.label || node.dataset.mode} applied.`
        );
      });
    });
  }
