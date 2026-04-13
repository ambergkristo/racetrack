const PUBLIC_ROUTES = new Set([
  "/leader-board",
  "/next-race",
  "/race-countdown",
  "/race-flags",
]);

const SOCKET_TRANSPORTS = ["websocket"];
const FRONT_DESK_OR_RACE_CONTROL = ["/front-desk", "/race-control"];

function createStaffSets(staffRouteToKey) {
  return {
    staffRoutes: new Set(Object.keys(staffRouteToKey)),
    spaRoutes: new Set(["/", ...PUBLIC_ROUTES, ...Object.keys(staffRouteToKey)]),
  };
}

module.exports = {
  PUBLIC_ROUTES,
  SOCKET_TRANSPORTS,
  FRONT_DESK_OR_RACE_CONTROL,
  createStaffSets,
};
