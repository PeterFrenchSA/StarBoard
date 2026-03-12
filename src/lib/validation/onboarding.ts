import { RecurrenceType, TaskType } from "@prisma/client";
import { z } from "zod";

export const onboardingChildSchema = z.object({
  childName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(120),
  avatarEmoji: z.string().trim().min(1).max(8).default("⭐")
});

export const onboardingTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(240).optional(),
    points: z.coerce.number().int().min(1).max(500),
    requiresApproval: z.boolean().default(true),
    taskType: z.nativeEnum(TaskType).default(TaskType.RECURRING),
    recurrenceType: z.nativeEnum(RecurrenceType).default(RecurrenceType.DAILY),
    weekdays: z.array(z.number().int().min(1).max(7)).default([]),
    assignedChildEmail: z.string().trim().email().max(180)
  })
  .superRefine((value, ctx) => {
    if (value.taskType === TaskType.ONE_OFF && value.recurrenceType !== RecurrenceType.NONE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One-off task recurrence must be NONE",
        path: ["recurrenceType"]
      });
    }

    if (value.taskType === TaskType.RECURRING && value.recurrenceType === RecurrenceType.NONE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Recurring tasks need a recurrence type",
        path: ["recurrenceType"]
      });
    }

    if (value.recurrenceType === RecurrenceType.WEEKDAYS && value.weekdays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose weekdays for WEEKDAYS recurrence",
        path: ["weekdays"]
      });
    }
  });

export const onboardingRewardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(240).optional(),
  cost: z.coerce.number().int().min(1).max(2000),
  iconEmoji: z.string().trim().min(1).max(16).default("🎁")
});

export const completeOnboardingSchema = z.object({
  familyName: z.string().trim().min(2).max(80),
  themePreset: z.enum(["sun", "mint", "sky", "coral"]).default("sun"),
  children: z.array(onboardingChildSchema).max(8).default([]),
  tasks: z.array(onboardingTaskSchema).max(30).default([]),
  rewards: z.array(onboardingRewardSchema).max(20).default([])
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
