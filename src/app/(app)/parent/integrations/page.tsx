import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { requireCompletedParentOnboarding } from "@/lib/parent-access";

export default async function ParentIntegrationsPage() {
  const { session } = await requireCompletedParentOnboarding();
  return <ParentDashboard parentName={session.displayName} mode="integrations" />;
}
