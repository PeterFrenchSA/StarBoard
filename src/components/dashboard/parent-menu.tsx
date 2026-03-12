"use client";

import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/approvals", label: "Approvals" },
  { href: "/parent/billing", label: "Billing" },
  { href: "/parent/integrations", label: "Integrations" },
  { href: "/parent/support", label: "Support" },
  { href: "/parent/admin", label: "Admin" }
] as const;

export function ParentMenu() {
  const pathname = usePathname();

  return (
    <nav className="mb-3 overflow-x-auto rounded-2xl border border-white/40 bg-white/80 p-2 shadow-lift backdrop-blur">
      <ul className="flex min-w-max items-center gap-2">
        {menuItems.map((item) => {
          const active = pathname === item.href;

          return (
            <li key={item.href}>
              <a
                href={item.href}
                className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-board-mint text-white"
                    : "bg-white text-board-ink hover:bg-slate-100"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
