import { z } from "zod";

export const createParentAccountSchema = z.object({
  parentName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(120)
});

export const createVoiceTokenSchema = z.object({
  label: z.string().trim().min(2).max(80)
});

export const updateVoiceTokenSchema = z.object({
  isActive: z.boolean()
});
