import { z } from "zod";

export const voiceAddPointsSchema = z.object({
  childId: z.string().cuid().optional(),
  childName: z.string().trim().min(2).max(80).optional(),
  amount: z.coerce.number().int().min(-500).max(500).refine((v) => v !== 0),
  note: z.string().trim().min(3).max(240)
}).refine((v) => Boolean(v.childId || v.childName), {
  message: "Provide childId or childName",
  path: ["childName"]
});

export const voiceCompleteTaskSchema = z.object({
  childId: z.string().cuid().optional(),
  childName: z.string().trim().min(2).max(80).optional(),
  taskId: z.string().cuid().optional(),
  taskTitle: z.string().trim().min(2).max(120).optional(),
  note: z.string().trim().max(240).optional()
}).refine((v) => Boolean(v.childId || v.childName), {
  message: "Provide childId or childName",
  path: ["childName"]
}).refine((v) => Boolean(v.taskId || v.taskTitle), {
  message: "Provide taskId or taskTitle",
  path: ["taskTitle"]
});
