import { ProviderDashboard } from "@/components/dashboard/provider-dashboard";
import { requireServerSession } from "@/lib/auth/session";

export default async function ProviderPage() {
  const session = await requireServerSession(["SUPER_ADMIN"]);
  return <ProviderDashboard adminName={session.displayName} />;
}
