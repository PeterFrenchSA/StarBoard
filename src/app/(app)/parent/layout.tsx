import type { ReactNode } from "react";
import { ParentMenu } from "@/components/dashboard/parent-menu";
import { getParentAccessState } from "@/lib/parent-access";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { parent } = await getParentAccessState();

  if (!parent.onboardingCompletedAt) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <ParentMenu />
      </div>
      {children}
    </>
  );
}
