export type SessionRole = "PARENT" | "CHILD" | "SUPER_ADMIN";

export interface SessionPayload {
  userId: string;
  familyId: string;
  role: SessionRole;
  email: string;
  displayName: string;
}
