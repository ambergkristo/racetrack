function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function joinClasses(classes) {
  return classes.filter(Boolean).join(" ");
}

export function ConnectionStatus({
  connection = "idle",
  label = "Socket idle",
  detail = "",
  compact = false,
} = {}) {
  return `
    <div class="${joinClasses(["connection-status", `connection-${connection}`, compact ? "compact" : ""])}">
      <span class="connection-kicker">Realtime</span>
      <strong>${escapeHtml(label)}</strong>
      ${detail ? `<span class="connection-detail">${escapeHtml(detail)}</span>` : ""}
    </div>
  `;
}

export function FullscreenButton({ active = false } = {}) {
  return `
    <button
      class="action-btn fullscreen-btn"
      id="fullscreen-btn"
      type="button"
      aria-pressed="${active ? "true" : "false"}"
    >
      ${active ? "Exit Fullscreen" : "Fullscreen"}
    </button>
  `;
}

export function TelemetryHeader({
  eyebrow,
  title,
  subtitle,
  statusMarkup = "",
  actionMarkup = "",
  statsMarkup = "",
} = {}) {
  return `
    <header class="telemetry-header">
      <div class="telemetry-copy">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
        ${statsMarkup}
      </div>
      <div class="telemetry-meta">
        ${statusMarkup}
        ${actionMarkup}
      </div>
    </header>
  `;
}

export function Panel({
  title,
  body,
  tone = "safe",
  className = "",
  kicker = "",
  meta = "",
} = {}) {
  return `
    <section class="${joinClasses(["panel", `panel-${tone}`, className])}">
      <div class="panel-heading">
        <div>
          ${kicker ? `<p class="panel-kicker">${escapeHtml(kicker)}</p>` : ""}
          <h2>${escapeHtml(title)}</h2>
        </div>
        ${meta}
      </div>
      ${body}
    </section>
  `;
}

export function KeyGateModal({
  routeTitle,
  gateStatus,
  gateKey,
  gateError,
} = {}) {
  if (gateStatus === "success") {
    return "";
  }

  const verifyLabel = gateStatus === "verifying" ? "Verifying..." : "Verify and connect";
  const gateBadge =
    gateStatus === "error"
      ? '<span class="gate-status error">Verification failed</span>'
      : gateStatus === "verifying"
        ? '<span class="gate-status verifying">Verifying...</span>'
        : '<span class="gate-status idle">Awaiting key</span>';

  return `
    <div class="key-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="key-gate-title">
      <div class="key-gate-shell">
        <div class="key-gate-copy">
          <p class="gate-kicker">Staff authentication required</p>
          <h3 id="key-gate-title">Unlock ${escapeHtml(routeTitle)}</h3>
          <p class="panel-copy">This route must verify the route key before any Socket.IO connection is allowed.</p>
        </div>
        ${gateBadge}
        <label class="field">
          <span>Access key</span>
          <input
            id="staff-key"
            type="password"
            autocomplete="off"
            value="${escapeHtml(gateKey)}"
            ${gateStatus === "verifying" ? "disabled" : ""}
          />
        </label>
        <div class="controls">
          <button
            class="action-btn"
            id="verify-btn"
            type="button"
            ${gateStatus === "verifying" ? "disabled" : ""}
          >
            ${verifyLabel}
          </button>
        </div>
        <p class="error-text" id="gate-error">${escapeHtml(gateError)}</p>
      </div>
    </div>
  `;
}

export function AppShell({ route, header, content, modal = "" } = {}) {
  const routeClass = route.replace(/\//g, "") || "home";

  return `
    <div class="app-shell route-${routeClass}">
      <div class="backdrop-grid"></div>
      ${header}
      <main class="route-grid">
        ${content}
      </main>
      ${modal}
    </div>
  `;
}

export { escapeHtml };
