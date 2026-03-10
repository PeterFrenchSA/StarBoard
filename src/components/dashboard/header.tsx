import { LogoutButton } from "@/components/dashboard/logout-button";

interface HeaderProps {
  title: string;
  subtitle: string;
}

export function DashboardHeader({ title, subtitle }: HeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-white/75 p-5 shadow-lift backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-[var(--font-display)] text-3xl font-black text-board-ink sparkle">{title}</h1>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      <LogoutButton />
    </header>
  );
}
