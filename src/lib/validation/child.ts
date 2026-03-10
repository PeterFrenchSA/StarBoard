import { z } from "zod";

export const completeTaskSchema = z.object({
  note: z.string().trim().max(240).optional()
});

export const requestRewardSchema = z.object({
  note: z.string().trim().max(240).optional()
});
