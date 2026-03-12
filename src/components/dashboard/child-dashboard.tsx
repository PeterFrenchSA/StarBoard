"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, PlayCircle, TimerReset } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Toast } from "@/components/ui/toast";

type ChildOverview = {
  child: {
    id: string;
    displayName: string;
    childProfile: { avatarEmoji: string; currentStreak: number; longestStreak: number } | null;
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

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload.data as T;
}

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

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardHeader title="My StarBoard" subtitle={`Hey ${childName}, loading your stars...`} />
        <Card>
          <p className="animate-pulse text-sm text-slate-600">Fetching your dashboard...</p>
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <DashboardHeader
        title={`${data.child.childProfile?.avatarEmoji ?? "⭐"} My StarBoard`}
        subtitle={`Hi ${data.child.displayName}! Keep your streak alive and unlock rewards.`}
      />

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm justify-end">
        {success ? <Toast message={success} /> : null}
      </div>

      {error ? (
        <Toast message={error} variant="error" className="mb-4" />
      ) : null}

      <section className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-board-sky to-board-mint text-3xl shadow-sm">
              {data.child.childProfile?.avatarEmoji ?? "⭐"}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Child Profile</p>
              <h2 className="font-[var(--font-display)] text-2xl font-black">{data.child.displayName}</h2>
              <p className="text-sm text-slate-600">Stay consistent to build your streak and unlock rewards.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-lg font-black text-board-mint">{data.tasks.length}</p>
              <p>Assigned Tasks</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-lg font-black text-board-sun">{completedTasks.length}</p>
              <p>Completed</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-lg font-black text-board-coral">
                {data.rewards.filter((reward) => reward.affordable).length}
              </p>
              <p>Rewards Ready</p>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-center p-5">
          <ProgressRing
            value={nextRewardProgress}
            label={nextReward ? "Next Reward" : "All Rewards Reachable"}
            subtitle={nextReward ? `${nextReward.iconEmoji} ${nextReward.title}` : "Great work"}
          />
        </Card>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="relative p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Stars / Points</p>
          <p className="text-3xl font-black text-board-mint">{data.points}</p>
          {pointsDelta ? (
            <span
              className={`absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-black text-white animate-points-flash ${
                pointsDelta > 0 ? "bg-board-mint" : "bg-board-coral"
              }`}
            >
              {pointsDelta > 0 ? `+${pointsDelta}` : pointsDelta}
            </span>
          ) : null}
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Streak</p>
          <p className="text-3xl font-black text-board-sun">{data.child.childProfile?.currentStreak ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">🔥 Keep it alive today</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Best Streak</p>
          <p className="text-3xl font-black text-board-coral">{data.child.childProfile?.longestStreak ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">🏆 Personal best</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Badges Earned</p>
          <p className="text-3xl font-black text-board-ink">
            {data.badges.filter((badge) => badge.earned).length}/{data.badges.length}
          </p>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {data.badges.map((badge) => (
          <Card
            key={badge.id}
            className={`p-4 ${badge.earned ? "animate-floaty border-board-mint/40 bg-gradient-to-br from-emerald-50 to-white" : "opacity-70"}`}
          >
            <p className="text-sm font-semibold">
              {badge.earned ? "🏅" : "🔒"} {badge.label}
            </p>
            <p className={`text-xs ${badge.earned ? "text-board-mint" : "text-slate-500"}`}>
              {badge.earned ? "Unlocked" : "Keep going"}
            </p>
          </Card>
        ))}
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Assigned Tasks</h2>
          <div className="space-y-3">
            {data.tasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks assigned yet.</p>
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
                  <div key={task.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {task.points} pts • {task.requiresApproval ? "Needs parent approval" : "Auto-approval"}
                    </p>
                    {task.description ? <p className="mt-1 text-sm text-slate-600">{task.description}</p> : null}
                    {task.deadlineAt ? (
                      <p className="mt-1 text-xs font-semibold text-board-coral">
                        Deadline: {new Date(task.deadlineAt).toLocaleString()}
                      </p>
                    ) : null}
                    {timerRequired ? (
                      <p className="mt-1 text-xs font-semibold text-board-ink">
                        Timer: {task.timerDurationMinutes} min
                        {hasActiveTimer ? ` • ${formatCountdown(timerRemainingSeconds)} remaining` : ""}
                      </p>
                    ) : null}
                    {!task.availableToday && !task.deadlinePassed ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">Not scheduled for today</p>
                    ) : null}
                    {timerRequired && !task.completed && !hasActiveTimer && timerIsExpired ? (
                      <p className="mt-2 text-xs font-semibold text-board-coral">
                        Timer expired. Start a new timer before marking done.
                      </p>
                    ) : null}
                    {timerRequired && !task.completed && !hasActiveTimer && !timerIsExpired ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">Start timer to enable completion.</p>
                    ) : null}
                    {!task.completed && task.deadlinePassed ? (
                      <p className="mt-2 text-xs font-semibold text-board-coral">Deadline passed for this task.</p>
                    ) : null}
                    {task.completed ? (
                      <p className="mt-2 text-xs font-semibold text-board-mint">{task.completedMessage ?? "Completed"}</p>
                    ) : null}
                    {task.completed ? (
                      <div className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-100 text-base font-black text-emerald-700">
                        <CheckCircle2 className="h-6 w-6" />
                        Done
                      </div>
                    ) : (
                      <>
                        {timerRequired && !hasActiveTimer ? (
                          <Button
                            type="button"
                            className="mt-3 h-12 w-full text-sm font-black"
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
                              {timerIsExpired ? "Restart Timer" : "Start Timer"}
                            </span>
                          </Button>
                        ) : null}

                        <Button
                          type="button"
                          className="mt-3 h-14 w-full text-base font-black"
                          loading={saving}
                          disabled={!canSubmitCompletion}
                          onClick={() =>
                            void handleAction(async () => {
                              await fetchJson(`/api/child/tasks/${task.id}/complete`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({})
                              });
                            }, task.requiresApproval ? "Task submitted for review" : "Task completed and points awarded")
                          }
                        >
                          <span className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="h-6 w-6" />
                            Mark As Done
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

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Rewards Available</h2>
          <div className="space-y-3">
            {data.rewards.length === 0 ? (
              <p className="text-sm text-slate-500">No rewards yet. Ask your parent to add one.</p>
            ) : (
              data.rewards.map((reward) => (
                <div key={reward.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold">
                    {reward.iconEmoji} {reward.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-slate-500">{reward.cost} pts</p>
                    <span className="rounded-full bg-board-sky/20 px-2 py-0.5 text-[10px] font-semibold text-board-ink">
                      Badge Reward
                    </span>
                  </div>
                  {reward.description ? <p className="mt-1 text-sm text-slate-600">{reward.description}</p> : null}
                  <div className="mt-2">
                    <Progress value={reward.progress} label={`${reward.progress}% of goal`} />
                  </div>
                  <Button
                    type="button"
                    className="mt-3"
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
                      }, "Reward request sent")
                    }
                  >
                    {reward.affordable ? "Request Reward" : "Not enough points"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-xl font-black">Completed Tasks</h2>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {completedTasks.length === 0 ? (
              <p className="text-sm text-slate-500">No completed tasks yet.</p>
            ) : (
              completedTasks.map((completion) => (
                <div key={completion.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium">{completion.task.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatStatus(completion.status)} • {new Date(completion.completedAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-xl font-black">Points History</h2>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {data.pointsHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No points history yet.</p>
            ) : (
              data.pointsHistory.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium">
                    <span className={entry.amount > 0 ? "text-board-mint" : "text-board-coral"}>
                      {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                    </span>{" "}
                    {entry.note}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(entry.createdAt).toLocaleString()} • {entry.actor?.displayName ?? "System"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-xl font-black">Activity Feed</h2>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {data.activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet. Complete a task to start your timeline.</p>
            ) : (
              data.activity.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium">{event.message}</p>
                  <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}
