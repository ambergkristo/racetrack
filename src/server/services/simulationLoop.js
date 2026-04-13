const { RACE_STATES } = require("../../domain/raceStateMachine");

function createSimulationLoop({
  raceStore,
  timerService,
  broadcastCanonicalState,
  persistCanonicalState,
  simulationTickIntervalMs,
}) {
  let simulationIntervalHandle = null;

  function stopSimulationLoop() {
    if (simulationIntervalHandle) {
      clearInterval(simulationIntervalHandle);
      simulationIntervalHandle = null;
    }
  }

  function runSimulationTick() {
    const result = raceStore.advanceSimulation();
    const snapshot = raceStore.getSnapshot();
    if (snapshot.state !== RACE_STATES.RUNNING && timerService.isRunning()) {
      timerService.stop();
    }
    if (!result.changed && !result.active) {
      stopSimulationLoop();
      return;
    }

    broadcastCanonicalState(result.hardCapReached ? "simulation_hard_cap" : "simulation_tick");
    if (result.shouldPersist) {
      persistCanonicalState();
    }

    if (!result.active) {
      stopSimulationLoop();
    }
  }

  function ensureSimulationLoop() {
    if (simulationIntervalHandle) {
      return;
    }

    simulationIntervalHandle = setInterval(runSimulationTick, simulationTickIntervalMs);
  }

  return {
    ensureSimulationLoop,
    stopSimulationLoop,
  };
}

module.exports = {
  createSimulationLoop,
};
