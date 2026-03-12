import { BillingInterval } from "@prisma/client";
import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  interval: z.nativeEnum(BillingInterval)
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
