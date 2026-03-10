import { z } from "zod";

export const registerParentSchema = z.object({
  familyName: z.string().trim().min(2).max(80),
  parentName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(120)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(120)
});

export const createChildSchema = z.object({
  childName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(120),
  avatarEmoji: z.string().trim().min(1).max(4).default("⭐")
});
