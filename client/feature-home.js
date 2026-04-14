// Generated from client/src. Run `npm run sync:client` after editing source modules.
  function homePanels() {
    return [
      summaryPanel(),
      panel(
        "Route Launch Board",
        `
          <div class="home-launch-shell">
            <div class="home-route-section">
              <div class="panel-heading">
                <h2>Staff Routes</h2>
              </div>
              <div class="route-card-grid compact-route-grid">
                ${["/front-desk", "/race-control", "/lap-line-tracker"].map((pathname) => routeCard(pathname)).join("")}
              </div>
            </div>
            <div class="home-route-section">
              <div class="panel-heading">
                <h2>Public Displays</h2>
              </div>
              <div class="route-card-grid compact-route-grid">
                ${["/leader-board", "/next-race", "/race-countdown", "/race-flags"].map((pathname) => routeCard(pathname)).join("")}
              </div>
            </div>
          </div>
        `,
        "warning",
        "home-launch-panel"
      ),
    ].join("");
  }
