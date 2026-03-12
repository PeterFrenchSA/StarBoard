import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { ParentSetupWizard } from "@/components/dashboard/parent-setup-wizard";
import { getParentAccessState } from "@/lib/parent-access";

export default async function ParentPage() {
  const { session, parent } = await getParentAccessState();

  if (!parent?.onboardingCompletedAt) {
    return (
      <ParentSetupWizard
        parentName={session.displayName}
        initialFamilyName={parent?.family.name ?? "My Family"}
      />
    );
  }

  return <ParentDashboard parentName={session.displayName} mode="main" />;
}
