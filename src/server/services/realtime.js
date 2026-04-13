const {
  buildRaceSnapshotViewModel,
  normalizeLockedSnapshotContext,
} = require("../../ui/raceTruth");
const {
  SOCKET_EVENTS,
  leaderboardUpdateSchema,
  raceSnapshotSchema,
  raceTickSchema,
} = require("../../socket/contract");
const { RACE_STATES } = require("../../domain/raceStateMachine");

function createRealtimeService({
  io,
  logger,
  raceStore,
  raceDurationSeconds,
  persistenceAdapter,
  getLockedSnapshotContext,
}) {
  function buildRaceSnapshotPayload() {
    return raceSnapshotSchema.parse({
      serverTime: new Date().toISOString(),
      ...buildRaceSnapshotViewModel(raceStore.getSnapshot(), getLockedSnapshotContext()),
    });
  }

  function buildLeaderboardPayload() {
    const snapshot = raceStore.getSnapshot();
    return leaderboardUpdateSchema.parse({
      serverTime: new Date().toISOString(),
      state: snapshot.state,
      flag: snapshot.flag,
      lapEntryAllowed: snapshot.lapEntryAllowed,
      activeSessionId: snapshot.activeSessionId,
      finishOrderActive: Boolean(snapshot.finishOrderActive),
      leaderboard: snapshot.leaderboard,
    });
  }

  function buildRaceTickPayload() {
    const snapshot = raceStore.getSnapshot();
    return raceTickSchema.parse({
      serverTime: new Date().toISOString(),
      state: snapshot.state,
      flag: snapshot.flag,
      lapEntryAllowed: snapshot.lapEntryAllowed,
      raceDurationSeconds,
      remainingSeconds: snapshot.remainingSeconds,
      endsAt: snapshot.endsAt,
      simulation: snapshot.simulation,
    });
  }

  function emitCanonicalState(
    target,
    { reason, socketId = null, route = null, includeTick = false }
  ) {
    const snapshot = buildRaceSnapshotPayload();
    const leaderboard = buildLeaderboardPayload();
    target.emit(SOCKET_EVENTS.RACE_SNAPSHOT, snapshot);
    target.emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, leaderboard);
    if (
      includeTick &&
      (snapshot.state === RACE_STATES.RUNNING || snapshot.state === RACE_STATES.FINISHED)
    ) {
      target.emit(SOCKET_EVENTS.RACE_TICK, buildRaceTickPayload());
    }
    logger.info("socket.resync_emitted", {
      delivery: socketId ? "socket" : "broadcast",
      reason,
      socketId,
      route,
      state: snapshot.state,
      activeSessionId: snapshot.activeSessionId,
      leaderboardSize: leaderboard.leaderboard.length,
    });
  }

  function broadcastCanonicalState(reason) {
    emitCanonicalState(io, { reason });
  }

  function persistCanonicalState() {
    const lockedSnapshotContext = normalizeLockedSnapshotContext(getLockedSnapshotContext());
    persistenceAdapter.save({
      state: raceStore.exportState(),
      lockedSnapshotContext:
        lockedSnapshotContext.lockedSession || lockedSnapshotContext.finalResults
          ? lockedSnapshotContext
          : null,
    });
  }

  return {
    buildRaceSnapshotPayload,
    buildLeaderboardPayload,
    buildRaceTickPayload,
    emitCanonicalState,
    broadcastCanonicalState,
    persistCanonicalState,
  };
}

module.exports = {
  createRealtimeService,
};
