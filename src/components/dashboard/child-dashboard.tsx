"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Flame, Gift, Medal, PlayCircle, Rocket, Star, Target, TimerReset } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { fetchJson } from "@/lib/fetch-json";
import { CHILD_THEME_OPTIONS, type ChildThemeValue, getChildTheme, normalizeChildTheme } from "@/lib/themes/child-themes";

type ChildOverview = {
  child: {
    id: string;
    displayName: string;
    childProfile: { avatarEmoji: string; colorTheme: string; currentStreak: number; longestStreak: number } | null;
  };
  points: number;
  badges: Array<{ id: string; label: string; earned: boolean }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    points: number;
    requiresApproval: boolean;
    deadlineAt: string | null;
    deadlinePassed: boolean;
    timerDurationMinutes: number | null;
    timerActive: boolean;
    timerExpired: boolean;
    timerStartedAt: string | null;
    timerEndsAt: string | null;
    availableToday: boolean;
    completedToday: boolean;
    completed: boolean;
    completedMessage: string | null;
  }>;
  rewards: Array<{
    id: string;
    title: string;
    description: string | null;
    cost: number;
    iconEmoji: string;
    affordable: boolean;
    progress: number;
  }>;
  completions: Array<{
    id: string;
    completedAt: string;
    status: string;
    task: { title: string };
  }>;
  pointsHistory: Array<{
    id: string;
    amount: number;
    note: string;
    createdAt: string;
    actor: { displayName: string } | null;
  }>;
  activity: Array<{
    id: string;
    message: string;
    createdAt: string;
  }>;
};

interface ChildDashboardProps {
  childName: string;
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildThemeStyle(theme: ReturnType<typeof getChildTheme>): CSSProperties {
  return {
    "--child-theme-heading": theme.headingColor,
    "--child-theme-border": theme.borderColor,
    "--child-theme-primary": theme.primaryButton,
    "--child-theme-primary-hover": theme.primaryButtonHover,
    "--child-theme-secondary": theme.secondaryButton,
    "--child-theme-secondary-hover": theme.secondaryButtonHover,
    "--child-theme-accent": theme.backgroundAccent,
    "--child-theme-glow": theme.glowColor
  } as CSSProperties;
}

export function ChildDashboard({ childName }: ChildDashboardProps) {
  const [data, setData] = useState<ChildOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pointsDelta, setPointsDelta] = useState(0);
  const previousPointsRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadOverview = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const overview = await fetchJson<ChildOverview>("/api/child/overview");
      if (previousPointsRef.current !== null && previousPointsRef.current !== overview.points) {
        setPointsDelta(overview.points - previousPointsRef.current);
      }
      previousPointsRef.current = overview.points;
      setData(overview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview(true);
  }, [loadOverview]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = setTimeout(() => setSuccess(null), 2600);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!pointsDelta) {
      return;
    }

    const timer = setTimeout(() => setPointsDelta(0), 1800);
    return () => clearTimeout(timer);
  }, [pointsDelta]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleAction(action: () => Promise<void>, successMessage?: string) {
    setSaving(true);
    setError(null);

    try {
      await action();
      await loadOverview(false);
      if (successMessage) {
        setSuccess(successMessage);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  const completedTasks = useMemo(
    () =>
      (data?.completions ?? []).filter(
        (completion) => completion.status !== "REJECTED" && completion.status !== "PENDING_APPROVAL"
      ),
    [data]
  );

  const nextReward = useMemo(
    () =>
      (data?.rewards ?? [])
        .filter((reward) => reward.cost > (data?.points ?? 0))
        .sort((a, b) => a.cost - b.cost)[0] ?? null,
    [data]
  );

  const nextRewardProgress = useMemo(() => {
    if (!data) {
      return 0;
    }

    if (!nextReward) {
      return 100;
    }

    return Math.max(0, Math.min(100, Math.round((data.points / nextReward.cost) * 100)));
  }, [data, nextReward]);

  const activeTheme = getChildTheme(data?.child.childProfile?.colorTheme);
  const activeThemeValue = normalizeChildTheme(data?.child.childProfile?.colorTheme);
  const themedStyle = buildThemeStyle(activeTheme);
  const themedBackground = `radial-gradient(circle at 15% 8%, ${activeTheme.backgroundAccent}, transparent 42%), linear-gradient(180deg, ${activeTheme.backgroundStart}, ${activeTheme.backgroundEnd})`;

  async function handleThemeChange(nextTheme: ChildThemeValue) {
    if (nextTheme === activeThemeValue) {
      return;
    }

    await handleAction(async () => {
      await fetchJson("/api/child/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme })
      });
    }, `Theme changed to ${CHILD_THEME_OPTIONS.find((theme) => theme.value === nextTheme)?.label ?? nextTheme}`);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardHeader title="My StarBoard" subtitle={`Hey ${childName}, loading...`} />
        <Card>
          <p className="animate-pulse text-sm text-slate-600">Loading your stars...</p>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardHeader title="My StarBoard" subtitle={`Hey ${childName}`} />
        <Card>
          <p className="text-sm text-red-600">{error ?? "Could not load dashboard"}</p>
          <Button className="mt-3" onClick={() => void loadOverview()}>
            Retry
          </Button>
        </Card>
      </main>
    );
  }

  const rewardsReadyCount = data.rewards.filter((reward) => reward.affordable).length;
  const earnedBadgesCount = data.badges.filter((badge) => badge.earned).length;

  return (
    <main
      className="cosmic-shell mx-auto max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6"
      style={{
        ...themedStyle,
        background: themedBackground
      }}
    >
      <header className="cosmic-topbar mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl font-black text-white sm:text-4xl">
            {activeTheme.accentEmoji} {data.child.childProfile?.avatarEmoji ?? "⭐"} My StarBoard
          </h1>
          <p className="text-sm font-semibold text-blue-100">
            Hi {data.child.displayName}. Pick a mission, tap done, win stars.
          </p>
        </div>
        <LogoutButton />
      </header>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm justify-end">
        {success ? <Toast message={success} /> : null}
      </div>
      {error ? <Toast message={error} variant="error" className="mb-4" /> : null}

      <section className="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="cosmic-card p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="cosmic-subcard flex flex-col items-center justify-between p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">Cosmic Cadet ID</p>
              <div
                className="mt-2 flex h-40 w-full items-center justify-center rounded-2xl border border-white/35 text-7xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
                style={{
                  background: `radial-gradient(circle at 22% 14%, ${activeTheme.backgroundAccent}, transparent 48%), linear-gradient(150deg, rgba(21,28,80,0.96), rgba(6,11,43,0.98))`
                }}
              >
                {data.child.childProfile?.avatarEmoji ?? "⭐"}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-black uppercase tracking-[0.14em] text-slate-100">Choose Your Theme</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {CHILD_THEME_OPTIONS.map((themeOption) => {
                  const isActive = themeOption.value === activeThemeValue;
                  return (
                    <button
                      key={themeOption.value}
                      type="button"
                      disabled={saving}
                      onClick={() => void handleThemeChange(themeOption.value)}
                      className={`cosmic-theme-option ${isActive ? "is-active" : ""}`}
                      style={{
                        background: `radial-gradient(circle at 20% 16%, ${themeOption.backgroundAccent}, transparent 44%), linear-gradient(160deg, ${themeOption.backgroundStart}, ${themeOption.backgroundEnd})`
                      }}
                    >
                      <span className="text-3xl">{themeOption.accentEmoji}</span>
                      <span className="mt-1 block text-sm font-black text-slate-900">{themeOption.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="cosmic-mini-stat">
              <Target className="mx-auto mb-1 h-5 w-5 text-fuchsia-200" />
              <p className="text-3xl font-black text-white">{data.tasks.length}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">Missions</p>
            </div>
            <div className="cosmic-mini-stat">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-200" />
              <p className="text-3xl font-black text-white">{completedTasks.length}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">Done</p>
            </div>
            <div className="cosmic-mini-stat">
              <Gift className="mx-auto mb-1 h-5 w-5 text-amber-200" />
              <p className="text-3xl font-black text-white">{rewardsReadyCount}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">Ready</p>
            </div>
          </div>
        </Card>

        <Card className="cosmic-card flex flex-col items-center justify-center p-4 sm:p-5">
          <div
            className="cosmic-galaxy-ring mb-3"
            style={{
              boxShadow: `0 0 28px ${activeTheme.glowColor}`
            }}
          >
            <div className="cosmic-galaxy-core">{nextRewardProgress}%</div>
          </div>
          <p className="text-3xl font-black text-white">
            {nextReward ? nextRewardProgress : 100}%
          </p>
          <p className="text-center text-xl font-black text-cyan-100">
            {nextReward ? "Next Reward" : "All Rewards Unlocked"}
          </p>
          <p className="text-center text-base font-semibold text-blue-200">
            {nextReward ? `${nextReward.iconEmoji} ${nextReward.title}` : "All Rewards Ready"}
          </p>
        </Card>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="cosmic-stat-card">
          <Star className="h-8 w-8 text-amber-200" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Stars</p>
            <p className="text-5xl font-black text-white">{data.points}</p>
          </div>
          {pointsDelta ? (
            <span className={`cosmic-pill ${pointsDelta > 0 ? "is-positive" : "is-negative"}`}>
              {pointsDelta > 0 ? `+${pointsDelta}` : pointsDelta}
            </span>
          ) : null}
        </Card>
        <Card className="cosmic-stat-card">
          <Flame className="h-8 w-8 text-orange-200" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Streak</p>
            <p className="text-5xl font-black text-white">{data.child.childProfile?.currentStreak ?? 0}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-200">Keep it alive</p>
          </div>
        </Card>
        <Card className="cosmic-stat-card">
          <Rocket className="h-8 w-8 text-sky-200" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Best</p>
            <p className="text-5xl font-black text-white">{data.child.childProfile?.longestStreak ?? 0}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-200">Personal record</p>
          </div>
        </Card>
        <Card className="cosmic-stat-card">
          <Medal className="h-8 w-8 text-violet-200" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Badges</p>
            <p className="text-5xl font-black text-white">
              {earnedBadgesCount}/{data.badges.length}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-200">Collected</p>
          </div>
        </Card>
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        {data.badges.map((badge) => (
          <Card
            key={badge.id}
            className={`cosmic-subcard p-4 ${badge.earned ? "" : "opacity-65"}`}
            style={badge.earned ? { borderColor: activeTheme.borderColor } : undefined}
          >
            <p className="text-2xl font-black text-white">
              {badge.earned ? activeTheme.badgeEmoji : "🔒"} {badge.label}
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">
              {badge.earned ? "Unlocked" : "Locked"}
            </p>
          </Card>
        ))}
      </section>

      <section className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card className="cosmic-card p-4 sm:p-5">
          <h2 className="cosmic-section-title">
            {activeTheme.taskEmoji} Field Assignments
          </h2>
          <div className="space-y-3">
            {data.tasks.length === 0 ? (
              <p className="text-sm font-semibold text-blue-200">No missions yet.</p>
            ) : (
              data.tasks.map((task) => {
                const timerRequired = Boolean(task.timerDurationMinutes);
                const timerEndsAt = task.timerEndsAt ? new Date(task.timerEndsAt).getTime() : null;
                const timerRemainingSeconds = timerEndsAt ? Math.floor((timerEndsAt - nowTick) / 1000) : 0;
                const hasActiveTimer = task.timerActive && timerRemainingSeconds > 0;
                const timerIsExpired =
                  task.timerExpired || Boolean(timerRequired && timerEndsAt && timerRemainingSeconds <= 0);
                const canStartTimer =
                  timerRequired && !task.completed && task.availableToday && !task.deadlinePassed && !saving;
                const canSubmitCompletion =
                  !task.completed &&
                  !saving &&
                  task.availableToday &&
                  (!timerRequired || hasActiveTimer);

                return (
                  <div key={task.id} className="cosmic-subcard p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-2xl">{activeTheme.taskEmoji}</div>
                      <div className="flex-1">
                        <p className="text-xl font-black text-white">{task.title}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-100">
                          {task.points} pts • {task.requiresApproval ? "Parent checks" : "Auto win"}
                        </p>
                        {task.description ? <p className="mt-1 text-sm text-blue-100">{task.description}</p> : null}
                        <div className="mt-2 space-y-1 text-xs font-semibold text-blue-200">
                          {task.deadlineAt ? <p>Ends: {new Date(task.deadlineAt).toLocaleString()}</p> : null}
                          {timerRequired ? (
                            <p>
                              Timer {task.timerDurationMinutes} min
                              {hasActiveTimer ? ` • ${formatCountdown(timerRemainingSeconds)} left` : ""}
                            </p>
                          ) : null}
                          {!task.availableToday && !task.deadlinePassed ? <p>Not on today</p> : null}
                          {timerRequired && !task.completed && !hasActiveTimer && timerIsExpired ? <p>Timer ended. Start again.</p> : null}
                          {timerRequired && !task.completed && !hasActiveTimer && !timerIsExpired ? <p>Start timer first.</p> : null}
                          {!task.completed && task.deadlinePassed ? <p>Time is up.</p> : null}
                        </div>
                      </div>
                    </div>

                    {task.completed ? (
                      <div className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-500/35 text-xl font-black text-emerald-100">
                        <CheckCircle2 className="h-7 w-7" />
                        DONE!
                      </div>
                    ) : (
                      <>
                        {timerRequired && !hasActiveTimer ? (
                          <Button
                            type="button"
                            className="mt-3 h-12 w-full border-0 bg-sky-500 text-sm font-black text-white hover:bg-sky-400"
                            variant="ghost"
                            loading={saving}
                            disabled={!canStartTimer}
                            onClick={() =>
                              void handleAction(async () => {
                                await fetchJson(`/api/child/tasks/${task.id}/start-timer`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({})
                                });
                              }, "Timer started")
                            }
                          >
                            <span className="flex items-center justify-center gap-2">
                              {timerIsExpired ? <TimerReset className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                              {timerIsExpired ? "Restart timer" : "Start timer"}
                            </span>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          className="mt-3 h-14 w-full border-0 bg-emerald-500 text-xl font-black text-white hover:bg-emerald-400"
                          loading={saving}
                          disabled={!canSubmitCompletion}
                          onClick={() =>
                            void handleAction(async () => {
                              await fetchJson(`/api/child/tasks/${task.id}/complete`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({})
                              });
                            }, task.requiresApproval ? "Sent to parent" : "Mission complete")
                          }
                        >
                          <span className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="h-8 w-8" />
                            DONE
                          </span>
                        </Button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="cosmic-card p-4 sm:p-5">
          <h2 className="cosmic-section-title">
            {activeTheme.rewardEmoji} Artifact Redeems
          </h2>
          <div className="space-y-3">
            {data.rewards.length === 0 ? (
              <p className="text-sm font-semibold text-blue-200">No rewards yet.</p>
            ) : (
              data.rewards.map((reward) => (
                <div key={reward.id} className="cosmic-subcard p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-2xl">{reward.iconEmoji}</div>
                    <div className="flex-1">
                      <p className="text-xl font-black text-white">{reward.title}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-100">{reward.cost} pts</p>
                      {reward.description ? <p className="mt-1 text-sm text-blue-100">{reward.description}</p> : null}
                    </div>
                    <span className="cosmic-pill">{reward.affordable ? "Ready" : "Locked"}</span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.13em] text-blue-100">
                      <span>{reward.progress}% complete</span>
                      <span>{Math.max(0, reward.cost - data.points)} to go</span>
                    </div>
                    <div className="cosmic-progress-track">
                      <div className="cosmic-progress-fill" style={{ width: `${Math.max(0, Math.min(100, reward.progress))}%` }} />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className={
                      reward.affordable
                        ? "mt-3 h-12 w-full border-0 bg-violet-500 text-base font-black text-white hover:bg-violet-400"
                        : "mt-3 h-12 w-full text-base font-black"
                    }
                    variant={reward.affordable ? "secondary" : "ghost"}
                    disabled={!reward.affordable || saving}
                    loading={saving}
                    onClick={() =>
                      void handleAction(async () => {
                        await fetchJson(`/api/child/rewards/${reward.id}/request`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({})
                        });
                      }, "Reward requested")
                    }
                  >
                    {reward.affordable ? `${activeTheme.rewardEmoji} Redeem` : "Need more stars"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="cosmic-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="cosmic-section-title mb-0 text-2xl">{activeTheme.taskEmoji} Done</h2>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Tasks</span>
          </div>
          <div className="cosmic-scroll max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {completedTasks.length === 0 ? (
              <p className="text-sm font-semibold text-blue-200">No completed missions yet.</p>
            ) : (
              completedTasks.map((completion) => (
                <div key={completion.id} className="cosmic-subcard p-3">
                  <p className="text-sm font-bold text-white">{completion.task.title}</p>
                  <p className="text-xs text-blue-200">
                    {formatStatus(completion.status)} • {new Date(completion.completedAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="cosmic-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="cosmic-section-title mb-0 text-2xl">{activeTheme.accentEmoji} Points</h2>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Details</span>
          </div>
          <div className="cosmic-scroll max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {data.pointsHistory.length === 0 ? (
              <p className="text-sm font-semibold text-blue-200">No points history yet.</p>
            ) : (
              data.pointsHistory.map((entry) => (
                <div key={entry.id} className="cosmic-subcard p-3">
                  <p className="text-sm font-bold text-white">
                    <span className={entry.amount > 0 ? "text-emerald-200" : "text-rose-200"}>
                      {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                    </span>{" "}
                    {entry.note}
                  </p>
                  <p className="text-xs text-blue-200">
                    {new Date(entry.createdAt).toLocaleString()} • {entry.actor?.displayName ?? "System"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="cosmic-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="cosmic-section-title mb-0 text-2xl">{activeTheme.accentEmoji} Feed</h2>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Live</span>
          </div>
          <div className="cosmic-scroll max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {data.activity.length === 0 ? (
              <p className="text-sm font-semibold text-blue-200">No activity yet.</p>
            ) : (
              data.activity.map((event) => (
                <div key={event.id} className="cosmic-subcard p-3">
                  <p className="text-sm font-bold text-white">{event.message}</p>
                  <p className="text-xs text-blue-200">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}
