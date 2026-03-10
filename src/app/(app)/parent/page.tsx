import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { requireServerSession } from "@/lib/auth/session";

export default async function ParentPage() {
  const session = await requireServerSession(["PARENT"]);
  return <ParentDashboard parentName={session.displayName} />;
}
