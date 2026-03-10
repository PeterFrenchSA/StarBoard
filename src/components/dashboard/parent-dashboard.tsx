"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ParentOverview = {
  children: Array<{
    id: string;
    displayName: string;
    email: string;
    points: number;
    pendingTasks: number;
    pendingRewards: number;
    childProfile: { avatarEmoji: string; currentStreak: number; longestStreak: number } | null;
  }>;
  pendingTaskApprovals: Array<{
    id: string;
    completedAt: string;
    task: { title: string; points: number };
    child: { displayName: string; childProfile: { avatarEmoji: string } | null };
  }>;
  pendingRedemptions: Array<{
    id: string;
    requestedAt: string;
    pointsCost: number;
    reward: { title: string; iconEmoji: string };
    child: { displayName: string; childProfile: { avatarEmoji: string } | null };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    points: number;
    taskType: string;
    recurrenceType: string;
    requiresApproval: boolean;
    assignedChild: { displayName: string; childProfile: { avatarEmoji: string } | null };
  }>;
  rewards: Array<{
    id: string;
    title: string;
    cost: number;
    iconEmoji: string;
  }>;
  activity: Array<{
    id: string;
    message: string;
    createdAt: string;
    actor: { displayName: string } | null;
    child: { displayName: string } | null;
  }>;
  stats: {
    childrenCount: number;
    activeTasksCount: number;
    totalPositivePointsThisMonth: number;
    pendingApprovalsCount: number;
  };
};

const weekdayChoices = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 }
];

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

interface ParentDashboardProps {
  parentName: string;
}

export function ParentDashboard({ parentName }: ParentDashboardProps) {
  const [data, setData] = useState<ParentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [taskType, setTaskType] = useState<"ONE_OFF" | "RECURRING">("RECURRING");
  const [recurrenceType, setRecurrenceType] = useState<"NONE" | "DAILY" | "WEEKLY" | "WEEKDAYS">("DAILY");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const overview = await fetchJson<ParentOverview>("/api/parent/overview");
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

  const childOptions = useMemo(() => data?.children ?? [], [data]);

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
        <DashboardHeader title="Parent Control Center" subtitle={`Welcome back, ${parentName}.`} />
        <Card>
          <p className="animate-pulse text-sm text-slate-600">Loading your family board...</p>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardHeader title="Parent Control Center" subtitle={`Welcome back, ${parentName}.`} />
        <Card>
          <p className="text-sm text-red-600">{error ?? "Could not load data"}</p>
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
        title="Parent Control Center"
        subtitle={`Welcome back, ${parentName}. Manage tasks, points, rewards, and approvals.`}
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Children</p>
          <p className="text-2xl font-black">{data.stats.childrenCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Tasks</p>
          <p className="text-2xl font-black">{data.stats.activeTasksCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Points This Month</p>
          <p className="text-2xl font-black">{data.stats.totalPositivePointsThisMonth}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Reviews</p>
          <p className="text-2xl font-black">{data.stats.pendingApprovalsCount}</p>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        {data.children.map((child) => (
          <Card key={child.id} className="p-4">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-2xl">{child.childProfile?.avatarEmoji ?? "⭐"}</span>
              <div>
                <p className="font-bold">{child.displayName}</p>
                <p className="text-xs text-slate-500">{child.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-black text-base text-board-mint">{child.points}</p>
                <p>Points</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-black text-base text-board-sun">{child.childProfile?.currentStreak ?? 0}</p>
                <p>Streak</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-black text-base text-board-coral">{child.pendingTasks + child.pendingRewards}</p>
                <p>Pending</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Add Child</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void handleAction(async () => {
                await fetchJson("/api/parent/children", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    childName: formData.get("childName"),
                    email: formData.get("email"),
                    password: formData.get("password"),
                    avatarEmoji: formData.get("avatarEmoji") || "⭐"
                  })
                });
                event.currentTarget.reset();
              });
            }}
          >
            <Input name="childName" label="Child name" required />
            <Input name="email" label="Child email" type="email" required />
            <Input name="password" label="Child password" type="password" required />
            <Input name="avatarEmoji" label="Avatar emoji" defaultValue="⭐" />
            <Button type="submit" loading={saving}>
              Create Child Account
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Manual Points</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void handleAction(async () => {
                await fetchJson("/api/parent/points", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    childId: formData.get("childId"),
                    amount: Number(formData.get("amount")),
                    note: formData.get("note")
                  })
                });
                event.currentTarget.reset();
              });
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Child
              <select
                name="childId"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                required
                defaultValue=""
              >
                <option disabled value="">
                  Select child
                </option>
                {childOptions.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Input name="amount" label="Points amount (use negative for deduction)" type="number" required />
            <Input name="note" label="Reason" required />
            <Button type="submit" variant="secondary" loading={saving}>
              Save Point Adjustment
            </Button>
          </form>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Create Task</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const normalizedRecurrence = taskType === "ONE_OFF" ? "NONE" : recurrenceType;

              void handleAction(async () => {
                await fetchJson("/api/parent/tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    assignedChildId: formData.get("assignedChildId"),
                    title: formData.get("title"),
                    description: formData.get("description") || undefined,
                    points: Number(formData.get("points")),
                    taskType,
                    recurrenceType: normalizedRecurrence,
                    weekdays: normalizedRecurrence === "WEEKDAYS" ? weekdays : [],
                    requiresApproval: formData.get("requiresApproval") === "on"
                  })
                });
                event.currentTarget.reset();
              });
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Assign child
              <select
                name="assignedChildId"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                required
                defaultValue=""
              >
                <option disabled value="">
                  Select child
                </option>
                {childOptions.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.displayName}
                  </option>
                ))}
              </select>
            </label>

            <Input name="title" label="Task title" required />
            <Input name="description" label="Description (optional)" />
            <Input name="points" label="Points" type="number" min={1} required />

            <label className="flex flex-col gap-1 text-sm font-medium">
              Task type
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={taskType}
                onChange={(event) => {
                  const value = event.target.value as "ONE_OFF" | "RECURRING";
                  setTaskType(value);
                  if (value === "ONE_OFF") {
                    setRecurrenceType("NONE");
                  } else if (recurrenceType === "NONE") {
                    setRecurrenceType("DAILY");
                  }
                }}
              >
                <option value="RECURRING">Recurring</option>
                <option value="ONE_OFF">One-off</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Recurrence
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={taskType === "ONE_OFF" ? "NONE" : recurrenceType}
                onChange={(event) =>
                  setRecurrenceType(event.target.value as "NONE" | "DAILY" | "WEEKLY" | "WEEKDAYS")
                }
                disabled={taskType === "ONE_OFF"}
              >
                <option value="NONE">None</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly (Monday)</option>
                <option value="WEEKDAYS">Selected weekdays</option>
              </select>
            </label>

            {taskType === "RECURRING" && recurrenceType === "WEEKDAYS" ? (
              <div>
                <p className="mb-1 text-sm font-medium">Weekdays</p>
                <div className="flex flex-wrap gap-2">
                  {weekdayChoices.map((choice) => {
                    const selected = weekdays.includes(choice.value);
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          selected ? "bg-board-mint text-white" : "bg-slate-100 text-slate-600"
                        }`}
                        onClick={() => {
                          setWeekdays((previous) =>
                            previous.includes(choice.value)
                              ? previous.filter((day) => day !== choice.value)
                              : [...previous, choice.value]
                          );
                        }}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="requiresApproval" defaultChecked className="h-4 w-4" />
              Require parent approval
            </label>

            <Button type="submit" loading={saving}>
              Create Task
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Create Reward</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              void handleAction(async () => {
                await fetchJson("/api/parent/rewards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: formData.get("title"),
                    description: formData.get("description") || undefined,
                    cost: Number(formData.get("cost")),
                    iconEmoji: formData.get("iconEmoji") || "🎁"
                  })
                });
                event.currentTarget.reset();
              });
            }}
          >
            <Input name="title" label="Reward name" required />
            <Input name="description" label="Description (optional)" />
            <Input name="cost" label="Points cost" type="number" min={1} required />
            <Input name="iconEmoji" label="Badge emoji" defaultValue="🎁" />
            <Button type="submit" variant="secondary" loading={saving}>
              Add Reward
            </Button>
          </form>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Pending Task Approvals</h2>
          <div className="space-y-3">
            {data.pendingTaskApprovals.length === 0 ? (
              <p className="text-sm text-slate-500">No task approvals pending.</p>
            ) : (
              data.pendingTaskApprovals.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold">
                    {entry.child.childProfile?.avatarEmoji ?? "⭐"} {entry.child.displayName}: {entry.task.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {entry.task.points} pts • submitted {new Date(entry.completedAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      className="h-9"
                      loading={saving}
                      onClick={() =>
                        void handleAction(async () => {
                          await fetchJson(`/api/parent/tasks/completions/${entry.id}/review`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ decision: "APPROVE" })
                          });
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="h-9"
                      loading={saving}
                      onClick={() =>
                        void handleAction(async () => {
                          await fetchJson(`/api/parent/tasks/completions/${entry.id}/review`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ decision: "REJECT" })
                          });
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Pending Reward Requests</h2>
          <div className="space-y-3">
            {data.pendingRedemptions.length === 0 ? (
              <p className="text-sm text-slate-500">No reward requests pending.</p>
            ) : (
              data.pendingRedemptions.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold">
                    {entry.child.childProfile?.avatarEmoji ?? "⭐"} {entry.child.displayName}: {entry.reward.iconEmoji} {entry.reward.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {entry.pointsCost} pts • requested {new Date(entry.requestedAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      className="h-9"
                      loading={saving}
                      onClick={() =>
                        void handleAction(async () => {
                          await fetchJson(`/api/parent/rewards/redemptions/${entry.id}/review`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ decision: "APPROVE" })
                          });
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="h-9"
                      loading={saving}
                      onClick={() =>
                        void handleAction(async () => {
                          await fetchJson(`/api/parent/rewards/redemptions/${entry.id}/review`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ decision: "REJECT" })
                          });
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Active Tasks</h2>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {data.tasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-semibold">{task.title}</p>
                <p className="text-xs text-slate-500">
                  {task.assignedChild.childProfile?.avatarEmoji ?? "⭐"} {task.assignedChild.displayName} • {task.points} pts • {task.taskType.replace("_", " ")} / {task.recurrenceType}
                </p>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-4 text-lg font-bold">Rewards Catalog</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.rewards.map((reward) => (
              <div key={reward.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold">
                  {reward.iconEmoji} {reward.title}
                </p>
                <p className="text-xs text-slate-500">{reward.cost} pts</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Activity Feed</h2>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {data.activity.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium">{event.message}</p>
                <p className="text-xs text-slate-500">
                  {new Date(event.createdAt).toLocaleString()} • {event.actor?.displayName ?? "System"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}
