import { ChildDashboard } from "@/components/dashboard/child-dashboard";
import { requireServerSession } from "@/lib/auth/session";

export default async function ChildPage() {
  const session = await requireServerSession(["CHILD"]);
  return <ChildDashboard childName={session.displayName} />;
}
