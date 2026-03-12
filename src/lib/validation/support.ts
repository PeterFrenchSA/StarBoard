import { SupportTicketPriority, SupportTicketStatus, SupportTicketType } from "@prisma/client";
import { z } from "zod";

export const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(8).max(2000),
  type: z.nativeEnum(SupportTicketType).default(SupportTicketType.SUPPORT),
  priority: z.nativeEnum(SupportTicketPriority).default(SupportTicketPriority.NORMAL),
  category: z.string().trim().max(80).optional()
});

export const createSupportTicketMessageSchema = z.object({
  body: z.string().trim().min(2).max(2000)
});

export const createProviderSupportTicketMessageSchema = createSupportTicketMessageSchema.extend({
  isInternal: z.boolean().default(false)
});

export const updateSupportTicketSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  assignedToId: z.string().cuid().nullable().optional()
});
