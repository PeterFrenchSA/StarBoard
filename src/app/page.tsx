import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect(session.role === "PARENT" ? "/parent" : "/child");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-white/40 bg-white/85 p-8 shadow-lift backdrop-blur">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-board-mint">
          Family Rewards App
        </p>
        <h1 className="mb-3 font-[var(--font-display)] text-4xl font-black text-board-ink">
          StarBoard
        </h1>
        <p className="mb-6 max-w-2xl text-sm text-slate-600">
          A child-friendly family star chart for chores, goals, streaks, points, and rewards.
          Parents manage the board. Children track their progress.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-2xl bg-board-mint px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-500"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="rounded-2xl bg-board-sun px-5 py-3 text-sm font-semibold text-board-ink transition hover:bg-yellow-400"
          >
            Create Family Workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
