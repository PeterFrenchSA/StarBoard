import { RecurrenceType, TaskType } from "@prisma/client";
import { z } from "zod";

export const createTaskSchema = z
  .object({
    assignedChildId: z.string().cuid(),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(240).optional(),
    points: z.coerce.number().int().min(1).max(500),
    taskType: z.nativeEnum(TaskType),
    recurrenceType: z.nativeEnum(RecurrenceType),
    weekdays: z.array(z.number().int().min(1).max(7)).default([]),
    requiresApproval: z.boolean().default(true)
  })
  .superRefine((value, ctx) => {
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
  });

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

export const createRewardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(240).optional(),
  cost: z.coerce.number().int().min(1).max(2000),
  iconEmoji: z.string().trim().min(1).max(4).default("🎁")
});

export const reviewRedemptionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(240).optional()
});
