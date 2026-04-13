const { z } = require("zod");
const { RACE_MODES } = require("../../domain/raceStateMachine");

const requestIdSchema = z.string().trim().min(1).max(120);

const createSessionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  requestId: requestIdSchema.optional(),
});

const updateSessionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    requestId: requestIdSchema.optional(),
  })
  .strict();

const createRacerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  carNumber: z.string().max(20).optional().nullable(),
  requestId: requestIdSchema.optional(),
});

const updateRacerSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    carNumber: z.string().max(20).optional().nullable(),
    requestId: requestIdSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "requestId"), {
    message: "At least one racer field is required.",
  });

const selectSessionSchema = z.object({
  sessionId: z.string().min(1),
  requestId: requestIdSchema.optional(),
});

const raceModeSchema = z.object({
  mode: z.enum(Object.values(RACE_MODES)),
  requestId: requestIdSchema.optional(),
});

const lapCrossingSchema = z.object({
  racerId: z.string().min(1),
  timestampMs: z.number().int().nonnegative().optional(),
  requestId: requestIdSchema.optional(),
});

const simulateRaceSchema = z.object({
  requestId: requestIdSchema.optional(),
});

const sessionCarAssignmentSchema = z.object({
  racerId: z.string().min(1),
  carNumber: z.string().min(1).max(20),
});

const updateSessionCarAssignmentsSchema = z
  .object({
    assignments: z.array(sessionCarAssignmentSchema).min(1),
    requestId: requestIdSchema.optional(),
  })
  .strict();

const resetSessionCarAssignmentsSchema = z
  .object({
    requestId: requestIdSchema.optional(),
  })
  .strict();

module.exports = {
  createSessionSchema,
  updateSessionSchema,
  createRacerSchema,
  updateRacerSchema,
  updateSessionCarAssignmentsSchema,
  resetSessionCarAssignmentsSchema,
  selectSessionSchema,
  raceModeSchema,
  lapCrossingSchema,
  simulateRaceSchema,
};
