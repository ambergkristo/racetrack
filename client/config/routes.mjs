export const ROUTES = {
  "/": {
    title: "Beachside Racetrack",
    subtitle: "Single-host race telemetry dashboard",
    staff: false,
    public: false,
    accent: "safe",
    body: "Open a route directly to inspect staff gating or public MVP telemetry.",
  },
  "/front-desk": {
    title: "Front Desk",
    subtitle: "Staff route skeleton",
    staff: true,
    public: false,
    accent: "safe",
    body: "Session setup, racer intake, and admin workflow will live here.",
  },
  "/race-control": {
    title: "Race Control",
    subtitle: "Staff route skeleton",
    staff: true,
    public: false,
    accent: "warning",
    body: "Start, mode control, finish, and lock actions will be wired here.",
  },
  "/lap-line-tracker": {
    title: "Lap Line Tracker",
    subtitle: "Staff route skeleton",
    staff: true,
    public: false,
    accent: "danger",
    body: "Large lap-entry controls will be mounted here once race flow is active.",
  },
  "/leader-board": {
    title: "Leader Board",
    subtitle: "Live race order, laps, and pace deltas",
    staff: false,
    public: true,
    accent: "safe",
    body: "Realtime leaderboard rows, best laps, and live timing status.",
  },
  "/next-race": {
    title: "Next Race",
    subtitle: "Queue, roster, and pit readiness",
    staff: false,
    public: true,
    accent: "warning",
    body: "Upcoming roster, kart assignments, and pit call readiness.",
  },
  "/race-countdown": {
    title: "Race Countdown",
    subtitle: "Server-authoritative launch and finish timing",
    staff: false,
    public: true,
    accent: "danger",
    body: "Countdown clock, session status, and transition readiness.",
  },
  "/race-flags": {
    title: "Race Flags",
    subtitle: "Track condition board for public displays",
    staff: false,
    public: true,
    accent: "warning",
    body: "Fullscreen-safe flag state visuals and marshal guidance.",
  },
};

export function resolveRoute(pathname) {
  return ROUTES[pathname] ? pathname : "/";
}
