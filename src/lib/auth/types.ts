export type SessionRole = "PARENT" | "CHILD";

export interface SessionPayload {
  userId: string;
  familyId: string;
  role: SessionRole;
  email: string;
  displayName: string;
}
