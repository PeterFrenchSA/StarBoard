import { z } from "zod";
import { CHILD_THEME_VALUES } from "@/lib/themes/child-themes";

export const completeTaskSchema = z.object({
  note: z.string().trim().max(240).optional()
});

export const requestRewardSchema = z.object({
  note: z.string().trim().max(240).optional()
});

export const updateChildThemeSchema = z.object({
  theme: z.enum(CHILD_THEME_VALUES)
});
