"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
    availableToday: boolean;
    completedToday: boolean;
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

export function ChildDashboard({ childName }: ChildDashboardProps) {
  const [data, setData] = useState<ChildOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const overview = await fetchJson<ChildOverview>("/api/child/overview");
      setData(overview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function handleAction(action: () => Promise<void>) {
    setSaving(true);
    setError(null);

    try {
      await action();
      await loadOverview();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

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

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Stars / Points</p>
          <p className="text-3xl font-black text-board-mint">{data.points}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Streak</p>
          <p className="text-3xl font-black text-board-sun">{data.child.childProfile?.currentStreak ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Best Streak</p>
          <p className="text-3xl font-black text-board-coral">{data.child.childProfile?.longestStreak ?? 0}</p>
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
          <Card key={badge.id} className={`p-4 ${badge.earned ? "animate-floaty" : "opacity-70"}`}>
            <p className="text-sm font-semibold">{badge.label}</p>
            <p className={`text-xs ${badge.earned ? "text-board-mint" : "text-slate-500"}`}>
              {badge.earned ? "Unlocked" : "Keep going"}
            </p>
          </Card>
        ))}
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">My Tasks</h2>
          <div className="space-y-3">
            {data.tasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks assigned yet.</p>
            ) : (
              data.tasks.map((task) => {
                const disabled = !task.availableToday || task.completedToday || saving;
                return (
                  <div key={task.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {task.points} pts • {task.requiresApproval ? "Needs parent approval" : "Auto-approval"}
                    </p>
                    {task.description ? <p className="mt-1 text-sm text-slate-600">{task.description}</p> : null}
                    {!task.availableToday ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">Not scheduled for today</p>
                    ) : null}
                    {task.completedToday ? (
                      <p className="mt-2 text-xs font-semibold text-board-mint">Completed today</p>
                    ) : null}
                    <Button
                      type="button"
                      className="mt-3"
                      loading={saving}
                      disabled={disabled}
                      onClick={() =>
                        void handleAction(async () => {
                          await fetchJson(`/api/child/tasks/${task.id}/complete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({})
                          });
                        })
                      }
                    >
                      Mark Complete
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Rewards</h2>
          <div className="space-y-3">
            {data.rewards.length === 0 ? (
              <p className="text-sm text-slate-500">No rewards yet. Ask your parent to add one.</p>
            ) : (
              data.rewards.map((reward) => (
                <div key={reward.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold">
                    {reward.iconEmoji} {reward.title}
                  </p>
                  <p className="text-xs text-slate-500">{reward.cost} pts</p>
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
                      })
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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Recent Task Activity</h2>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {data.completions.map((completion) => (
              <div key={completion.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium">{completion.task.title}</p>
                <p className="text-xs text-slate-500">
                  {completion.status.replace("_", " ")} • {new Date(completion.completedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Points History</h2>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {data.pointsHistory.map((entry) => (
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
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}
