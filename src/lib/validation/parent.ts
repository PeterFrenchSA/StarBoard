import { RecurrenceType, TaskType } from "@prisma/client";
import { z } from "zod";

const optionalDateTimeSchema = z.preprocess(
  (value) => (value === null || value === "" || typeof value === "undefined" ? undefined : value),
  z.coerce.date().optional()
);

const optionalTimerDurationSchema = z.preprocess(
  (value) => (value === null || value === "" || typeof value === "undefined" ? undefined : value),
  z.coerce.number().int().min(1).max(240).optional()
);

const taskInputCommonSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(240).optional(),
  points: z.coerce.number().int().min(1).max(500),
  taskType: z.nativeEnum(TaskType),
  recurrenceType: z.nativeEnum(RecurrenceType),
  weekdays: z.array(z.number().int().min(1).max(7)).default([]),
  deadlineAt: optionalDateTimeSchema,
  timerDurationMinutes: optionalTimerDurationSchema,
  requiresApproval: z.boolean().default(true)
});

function validateTaskRecurrence(
  value: {
    taskType: TaskType;
    recurrenceType: RecurrenceType;
    weekdays: number[];
  },
  ctx: z.RefinementCtx
) {
  if (value.taskType === "ONE_OFF" && value.recurrenceType !== "NONE") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "One-off tasks must use NONE recurrence",
      path: ["recurrenceType"]
    });
  }

  if (value.taskType === "RECURRING" && value.recurrenceType === "NONE") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Recurring tasks require recurrence",
      path: ["recurrenceType"]
    });
  }

  if (value.recurrenceType === "WEEKDAYS" && value.weekdays.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one weekday",
      path: ["weekdays"]
    });
  }
}

function validateTaskTiming(
  value: { deadlineAt?: Date; timerDurationMinutes?: number },
  ctx: z.RefinementCtx,
  options?: { requireFutureDeadline?: boolean }
) {
  if (value.deadlineAt && Number.isNaN(value.deadlineAt.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Deadline is invalid",
      path: ["deadlineAt"]
    });
  }

  if (options?.requireFutureDeadline && value.deadlineAt && value.deadlineAt.getTime() < Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Deadline must be in the future",
      path: ["deadlineAt"]
    });
  }

  if (value.timerDurationMinutes && value.timerDurationMinutes < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Timer must be at least 1 minute",
      path: ["timerDurationMinutes"]
    });
  }
}

export const createTaskSchema = taskInputCommonSchema
  .extend({
    assignedChildId: z.string().cuid().optional(),
    assignedChildIds: z.array(z.string().cuid()).max(16).optional()
  })
  .superRefine((value, ctx) => {
    validateTaskRecurrence(value, ctx);
    validateTaskTiming(value, ctx, { requireFutureDeadline: true });

    const uniqueChildIds = new Set([
      ...(value.assignedChildId ? [value.assignedChildId] : []),
      ...(value.assignedChildIds ?? [])
    ]);

    if (uniqueChildIds.size === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one child",
        path: ["assignedChildId"]
      });
    }

    if (value.taskType === "ONE_OFF" && uniqueChildIds.size !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One-off tasks can only be assigned to one child",
        path: ["assignedChildIds"]
      });
    }
  });

export const updateTaskSchema = taskInputCommonSchema
  .extend({
    assignedChildId: z.string().cuid(),
    isActive: z.boolean().default(true)
  })
  .superRefine((value, ctx) => {
    validateTaskRecurrence(value, ctx);
    validateTaskTiming(value, ctx);
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const reviewTaskCompletionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(240).optional()
});

export const adjustPointsSchema = z.object({
  childId: z.string().cuid(),
  amount: z.coerce.number().int().min(-500).max(500).refine((v) => v !== 0, {
    message: "Amount cannot be zero"
  }),
  note: z.string().trim().min(3).max(240)
});

const rewardInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(240).optional(),
  cost: z.coerce.number().int().min(1).max(2000),
  iconEmoji: z.string().trim().min(1).max(16).default("🎁")
});

export const createRewardSchema = rewardInputSchema;

export const updateRewardSchema = rewardInputSchema.extend({
  isActive: z.boolean().default(true)
});

export const reviewRedemptionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(240).optional()
});
