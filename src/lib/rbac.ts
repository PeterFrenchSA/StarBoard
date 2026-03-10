import type { SessionPayload, SessionRole } from "@/lib/auth/types";

export function assertRole(session: SessionPayload, allowed: SessionRole[]): void {
  if (!allowed.includes(session.role)) {
    throw new Error("Forbidden");
  }
}
