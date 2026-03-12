"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarPicker } from "@/components/dashboard/avatar-picker";
import { RewardEmojiPicker } from "@/components/dashboard/reward-emoji-picker";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";

type TaskKind = "ONE_OFF" | "RECURRING";
type RecurrenceKind = "NONE" | "DAILY" | "WEEKLY" | "WEEKDAYS";
type ParentViewMode = "main" | "approvals" | "billing" | "integrations" | "support" | "admin";
type VoiceTokenRow = {
  id: string;
  label: string;
  tokenPreview: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  token?: string;
};

type ParentOverview = {
  parents: Array<{
    id: string;
    displayName: string;
    email: string;
    isFamilyOwner: boolean;
    createdAt: string;
  }>;
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
    assignedChildId: string;
    title: string;
    description: string | null;
    points: number;
    taskType: TaskKind;
    recurrenceType: RecurrenceKind;
    weekdays: number[];
    deadlineAt: string | null;
    timerDurationMinutes: number | null;
    requiresApproval: boolean;
    isActive: boolean;
    assignedChild: { id: string; displayName: string; childProfile: { avatarEmoji: string } | null };
  }>;
  rewards: Array<{
    id: string;
    title: string;
    description: string | null;
    cost: number;
    iconEmoji: string;
    isActive: boolean;
  }>;
  supportTickets: Array<{
    id: string;
    subject: string;
    description: string;
    type: "SUPPORT" | "FEATURE_REQUEST";
    status: "OPEN" | "IN_PROGRESS" | "WAITING_ON_PARENT" | "RESOLVED" | "CLOSED";
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    category: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    createdBy: {
      id: string;
      displayName: string;
      role: string;
    };
    assignedTo: {
      id: string;
      displayName: string;
      role: string;
    } | null;
    messages: Array<{
      id: string;
      body: string;
      createdAt: string;
      author: {
        id: string;
        displayName: string;
        role: string;
      };
    }>;
  }>;
  billing: {
    interval: "MONTHLY" | "ANNUAL";
    status: string;
    billingEmail: string | null;
    stripeCustomerLinked: boolean;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    childCount: number;
    includedChildren: number;
    additionalChildren: number;
    monthlyAmountCents: number;
    annualAmountCents: number;
  };
  activity: Array<{
    id: string;
    type: string;
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
    openSupportTicketsCount: number;
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

function formatEventType(type: string): string {
  return type
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function formatStatusLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function toDateTimeLocalValue(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  mode?: ParentViewMode;
}

export function ParentDashboard({ parentName, mode = "main" }: ParentDashboardProps) {
  const [data, setData] = useState<ParentOverview | null>(null);
  const [voiceTokens, setVoiceTokens] = useState<VoiceTokenRow[]>([]);
  const [revealedVoiceToken, setRevealedVoiceToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("⭐");
  const [pointDeltas, setPointDeltas] = useState<Record<string, number>>({});
  const previousPointsRef = useRef<Record<string, number>>({});

  const [taskType, setTaskType] = useState<TaskKind>("RECURRING");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceKind>("DAILY");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [editTaskType, setEditTaskType] = useState<TaskKind>("RECURRING");
  const [editRecurrenceType, setEditRecurrenceType] = useState<RecurrenceKind>("DAILY");
  const [editWeekdays, setEditWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [selectedRewardId, setSelectedRewardId] = useState<string>("");
  const [createRewardEmoji, setCreateRewardEmoji] = useState("🎁");
  const [editRewardEmoji, setEditRewardEmoji] = useState("🎁");

  const loadOverview = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const [overview, tokens] = await Promise.all([
        fetchJson<ParentOverview>("/api/parent/overview"),
        fetchJson<VoiceTokenRow[]>("/api/parent/voice/tokens")
      ]);
      const deltas = overview.children.reduce<Record<string, number>>((acc, child) => {
        const previous = previousPointsRef.current[child.id];
        if (typeof previous === "number" && previous !== child.points) {
          acc[child.id] = child.points - previous;
        }
        return acc;
      }, {});
      previousPointsRef.current = overview.children.reduce<Record<string, number>>((acc, child) => {
        acc[child.id] = child.points;
        return acc;
      }, {});
      setPointDeltas(deltas);
      setData(overview);
      setVoiceTokens(tokens);
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

    const timer = setTimeout(() => setSuccess(null), 2800);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!revealedVoiceToken) {
      return;
    }

    const timer = setTimeout(() => setRevealedVoiceToken(null), 12000);
    return () => clearTimeout(timer);
  }, [revealedVoiceToken]);

  useEffect(() => {
    if (Object.keys(pointDeltas).length === 0) {
      return;
    }

    const timer = setTimeout(() => setPointDeltas({}), 1800);
    return () => clearTimeout(timer);
  }, [pointDeltas]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.tasks.length > 0 && !data.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(data.tasks[0].id);
    }

    if (data.rewards.length > 0 && !data.rewards.some((reward) => reward.id === selectedRewardId)) {
      setSelectedRewardId(data.rewards[0].id);
    }
  }, [data, selectedRewardId, selectedTaskId]);

  const childOptions = useMemo(() => data?.children ?? [], [data]);

  const selectedTask = useMemo(
    () => data?.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [data, selectedTaskId]
  );

  const selectedReward = useMemo(
    () => data?.rewards.find((reward) => reward.id === selectedRewardId) ?? null,
    [data, selectedRewardId]
  );

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    setEditTaskType(selectedTask.taskType);
    setEditRecurrenceType(selectedTask.recurrenceType);
    setEditWeekdays(selectedTask.weekdays);
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedReward) {
      return;
    }
    setEditRewardEmoji(selectedReward.iconEmoji || "🎁");
  }, [selectedReward]);

  const taskSummary = useMemo(() => {
    const tasks = data?.tasks ?? [];
    return {
      total: tasks.length,
      recurring: tasks.filter((task) => task.taskType === "RECURRING").length,
      oneOff: tasks.filter((task) => task.taskType === "ONE_OFF").length,
      requiresApproval: tasks.filter((task) => task.requiresApproval).length
    };
  }, [data]);

  const rewardSummary = useMemo(() => {
    const rewards = data?.rewards ?? [];

    if (!rewards.length) {
      return {
        total: 0,
        active: 0,
        averageCost: 0,
        maxCost: 0
      };
    }

    const totalCost = rewards.reduce((sum, reward) => sum + reward.cost, 0);

    return {
      total: rewards.length,
      active: rewards.filter((reward) => reward.isActive).length,
      averageCost: Math.round(totalCost / rewards.length),
      maxCost: Math.max(...rewards.map((reward) => reward.cost))
    };
  }, [data]);

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

  function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const showMainOverview = mode === "main";
  const showTaskTools = mode === "main";
  const showRewardTools = mode === "main";
  const showApprovals = mode === "approvals";
  const showBillingTools = mode === "billing";
  const showVoiceTools = mode === "integrations";
  const showSupportTools = mode === "support";
  const showAdminTools = mode === "admin";
  const showActivityPanel = mode === "main";

  const modeSubtitle: Record<ParentViewMode, string> = {
    main: `Welcome back, ${parentName}. Manage children, tasks, rewards, and daily activity.`,
    approvals: `Welcome back, ${parentName}. Review pending task completions and reward redemptions.`,
    billing: `Welcome back, ${parentName}. Manage your subscription and billing profile.`,
    integrations: `Welcome back, ${parentName}. Manage voice assistant tokens and integrations.`,
    support: `Welcome back, ${parentName}. Create and track support tickets and feature requests.`,
    admin: `Welcome back, ${parentName}. Manage parent and child account access.`
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <DashboardHeader
        title="Parent Control Center"
        subtitle={modeSubtitle[mode]}
      />

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm justify-end">
        {success ? <Toast message={success} /> : null}
      </div>

      {error ? (
        <Toast message={error} variant="error" className="mb-4" />
      ) : null}

      {showMainOverview ? (
        <section className="mb-6">
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="h-9" onClick={() => scrollToSection("task-tools")}>
                Tasks
              </Button>
              <Button type="button" variant="ghost" className="h-9" onClick={() => scrollToSection("reward-tools")}>
                Rewards
              </Button>
              <Button type="button" variant="ghost" className="h-9" onClick={() => window.location.assign("/parent/approvals")}>
                Approvals
              </Button>
            </div>
          </Card>
        </section>
      ) : null}

      {showMainOverview ? (
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
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
          <button
            type="button"
            className="text-left text-2xl font-black text-board-coral underline-offset-4 hover:underline"
            onClick={() => window.location.assign("/parent/approvals")}
          >
            {data.stats.pendingApprovalsCount}
          </button>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open Support</p>
          <button
            type="button"
            className="text-left text-2xl font-black text-board-sky underline-offset-4 hover:underline"
            onClick={() => window.location.assign("/parent/support")}
          >
            {data.stats.openSupportTicketsCount}
          </button>
        </Card>
        </section>
      ) : null}

      {showMainOverview ? (
        <section className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-[var(--font-display)] text-xl font-black">Task Summary</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-ink">{taskSummary.total}</p>
              <p>Total Tasks</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-mint">{taskSummary.recurring}</p>
              <p>Recurring</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-sun">{taskSummary.oneOff}</p>
              <p>One-off</p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100"
              onClick={() => window.location.assign("/parent/approvals")}
            >
              <p className="font-black text-lg text-board-coral">{taskSummary.requiresApproval}</p>
              <p>Need Approval</p>
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 font-[var(--font-display)] text-xl font-black">Reward Summary</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-ink">{rewardSummary.total}</p>
              <p>Total Rewards</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-mint">{rewardSummary.active}</p>
              <p>Active</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-sun">{rewardSummary.averageCost}</p>
              <p>Avg Cost</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-black text-lg text-board-coral">{rewardSummary.maxCost}</p>
              <p>Highest Cost</p>
            </div>
          </div>
        </Card>
        </section>
      ) : null}

      {showMainOverview ? (
        <section className="mb-6 grid gap-4 md:grid-cols-3">
        {data.children.length === 0 ? (
          <Card className="md:col-span-3">
            <p className="text-sm text-slate-500">No children yet. Add the first child profile to start assigning tasks.</p>
          </Card>
        ) : (
          data.children.map((child) => (
            <Card key={child.id} className="relative p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-2xl">{child.childProfile?.avatarEmoji ?? "⭐"}</span>
                <div>
                  <p className="font-bold">{child.displayName}</p>
                  <p className="text-xs text-slate-500">{child.email}</p>
                </div>
              </div>

              {pointDeltas[child.id] ? (
                <span
                  className={`absolute right-4 top-4 rounded-full px-2 py-1 text-xs font-black text-white animate-points-flash ${
                    pointDeltas[child.id] > 0 ? "bg-board-mint" : "bg-board-coral"
                  }`}
                >
                  {pointDeltas[child.id] > 0 ? `+${pointDeltas[child.id]}` : pointDeltas[child.id]} pts
                </span>
              ) : null}

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-slate-50 p-2">
                  <p className="font-black text-base text-board-mint">{child.points}</p>
                  <p>Points</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <p className="font-black text-base text-board-sun">{child.childProfile?.currentStreak ?? 0}</p>
                  <p>Streak</p>
                </div>
              <button
                  type="button"
                  className="rounded-xl bg-slate-50 p-2 transition hover:bg-slate-100"
                  onClick={() => window.location.assign("/parent/approvals")}
                >
                  <p className="font-black text-base text-board-coral">{child.pendingTasks + child.pendingRewards}</p>
                  <p>Pending</p>
                </button>
              </div>
            </Card>
          ))
        )}
        </section>
      ) : null}

      {showMainOverview ? (
        <section className="mb-6 grid gap-4">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Manual Points</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
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
                form.reset();
              }, "Points updated");
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
      ) : null}

      {showTaskTools ? (
        <section id="task-tools" className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Create Task</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(event.currentTarget);
              const normalizedRecurrence = taskType === "ONE_OFF" ? "NONE" : recurrenceType;
              const selectedChildIds = formData.getAll("assignedChildIds").map((value) => String(value));
              const oneOffChildId = formData.get("assignedChildId");
              const deadlineValue = formData.get("deadlineAt");
              const timerDurationValue = formData.get("timerDurationMinutes");

              void handleAction(async () => {
                const result = await fetchJson<{ createdCount?: number }>("/api/parent/tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    assignedChildId: oneOffChildId || undefined,
                    assignedChildIds: selectedChildIds.length > 0 ? selectedChildIds : undefined,
                    title: formData.get("title"),
                    description: formData.get("description") || undefined,
                    points: Number(formData.get("points")),
                    taskType,
                    recurrenceType: normalizedRecurrence,
                    weekdays: normalizedRecurrence === "WEEKDAYS" ? weekdays : [],
                    deadlineAt:
                      typeof deadlineValue === "string" && deadlineValue.length > 0
                        ? new Date(deadlineValue).toISOString()
                        : undefined,
                    timerDurationMinutes:
                      typeof timerDurationValue === "string" && timerDurationValue.length > 0
                        ? Number(timerDurationValue)
                        : undefined,
                    requiresApproval: formData.get("requiresApproval") === "on"
                  })
                });
                form.reset();
                setTaskType("RECURRING");
                setRecurrenceType("DAILY");
                setWeekdays([1, 2, 3, 4, 5]);
                if (result?.createdCount && result.createdCount > 1) {
                  setSuccess(`Task created for ${result.createdCount} children`);
                } else {
                  setSuccess("Task created");
                }
              });
            }}
          >
            {taskType === "ONE_OFF" ? (
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
            ) : (
              <div>
                <p className="mb-1 text-sm font-medium">Assign children (recurring)</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {childOptions.map((child) => (
                    <label
                      key={child.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <input type="checkbox" name="assignedChildIds" value={child.id} className="h-4 w-4" />
                      <span>{child.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Input name="title" label="Task title" required />
            <Input name="description" label="Description (optional)" />
            <Input name="points" label="Points" type="number" min={1} required />
            <Input name="deadlineAt" label="Deadline (optional)" type="datetime-local" />
            <Input
              name="timerDurationMinutes"
              label="Running Timer (minutes, optional)"
              type="number"
              min={1}
              max={240}
            />

            <label className="flex flex-col gap-1 text-sm font-medium">
              Task type
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={taskType}
                onChange={(event) => {
                  const value = event.target.value as TaskKind;
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
                onChange={(event) => setRecurrenceType(event.target.value as RecurrenceKind)}
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
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Edit Task</h2>
          {!selectedTask ? (
            <p className="text-sm text-slate-500">Create a task first, then edit it here.</p>
          ) : (
            <form
              key={selectedTask.id}
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const normalizedRecurrence = editTaskType === "ONE_OFF" ? "NONE" : editRecurrenceType;
                const deadlineValue = formData.get("deadlineAt");
                const timerDurationValue = formData.get("timerDurationMinutes");

                void handleAction(async () => {
                  await fetchJson(`/api/parent/tasks/${selectedTask.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      assignedChildId: formData.get("assignedChildId"),
                      title: formData.get("title"),
                      description: formData.get("description") || undefined,
                      points: Number(formData.get("points")),
                      taskType: editTaskType,
                      recurrenceType: normalizedRecurrence,
                      weekdays: normalizedRecurrence === "WEEKDAYS" ? editWeekdays : [],
                      deadlineAt:
                        typeof deadlineValue === "string" && deadlineValue.length > 0
                          ? new Date(deadlineValue).toISOString()
                          : undefined,
                      timerDurationMinutes:
                        typeof timerDurationValue === "string" && timerDurationValue.length > 0
                          ? Number(timerDurationValue)
                          : undefined,
                      requiresApproval: formData.get("requiresApproval") === "on",
                      isActive: formData.get("isActive") === "on"
                    })
                  });
                }, "Task updated");
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Task
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={selectedTask.id}
                  onChange={(event) => setSelectedTaskId(event.target.value)}
                >
                  {data.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Assign child
                <select
                  name="assignedChildId"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  defaultValue={selectedTask.assignedChildId}
                >
                  {childOptions.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <Input name="title" label="Task title" defaultValue={selectedTask.title} required />
              <Input
                name="description"
                label="Description (optional)"
                defaultValue={selectedTask.description ?? ""}
              />
              <Input name="points" label="Points" type="number" min={1} defaultValue={selectedTask.points} required />
              <Input
                name="deadlineAt"
                label="Deadline (optional)"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(selectedTask.deadlineAt)}
              />
              <Input
                name="timerDurationMinutes"
                label="Running Timer (minutes, optional)"
                type="number"
                min={1}
                max={240}
                defaultValue={selectedTask.timerDurationMinutes ?? ""}
              />

              <label className="flex flex-col gap-1 text-sm font-medium">
                Task type
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={editTaskType}
                  onChange={(event) => {
                    const value = event.target.value as TaskKind;
                    setEditTaskType(value);
                    if (value === "ONE_OFF") {
                      setEditRecurrenceType("NONE");
                    } else if (editRecurrenceType === "NONE") {
                      setEditRecurrenceType("DAILY");
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
                  value={editTaskType === "ONE_OFF" ? "NONE" : editRecurrenceType}
                  onChange={(event) => setEditRecurrenceType(event.target.value as RecurrenceKind)}
                  disabled={editTaskType === "ONE_OFF"}
                >
                  <option value="NONE">None</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly (Monday)</option>
                  <option value="WEEKDAYS">Selected weekdays</option>
                </select>
              </label>

              {editTaskType === "RECURRING" && editRecurrenceType === "WEEKDAYS" ? (
                <div>
                  <p className="mb-1 text-sm font-medium">Weekdays</p>
                  <div className="flex flex-wrap gap-2">
                    {weekdayChoices.map((choice) => {
                      const selected = editWeekdays.includes(choice.value);
                      return (
                        <button
                          key={choice.value}
                          type="button"
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            selected ? "bg-board-mint text-white" : "bg-slate-100 text-slate-600"
                          }`}
                          onClick={() => {
                            setEditWeekdays((previous) =>
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
                <input
                  type="checkbox"
                  name="requiresApproval"
                  defaultChecked={selectedTask.requiresApproval}
                  className="h-4 w-4"
                />
                Require parent approval
              </label>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="isActive" defaultChecked={selectedTask.isActive} className="h-4 w-4" />
                Task is active
              </label>

              <Button type="submit" loading={saving} variant="secondary">
                Save Task Changes
              </Button>
            </form>
          )}
        </Card>
        </section>
      ) : null}

      {showRewardTools ? (
        <section id="reward-tools" className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Create Reward</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(event.currentTarget);

              void handleAction(async () => {
                await fetchJson("/api/parent/rewards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: formData.get("title"),
                    description: formData.get("description") || undefined,
                    cost: Number(formData.get("cost")),
                    iconEmoji: createRewardEmoji
                  })
                });
                form.reset();
                setCreateRewardEmoji("🎁");
              }, "Reward created");
            }}
          >
            <Input name="title" label="Reward name" required />
            <Input name="description" label="Description (optional)" />
            <Input name="cost" label="Points cost" type="number" min={1} required />
            <RewardEmojiPicker value={createRewardEmoji} onChange={setCreateRewardEmoji} />
            <Button type="submit" variant="secondary" loading={saving}>
              Add Reward
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Edit Reward</h2>
          {!selectedReward ? (
            <p className="text-sm text-slate-500">Create a reward first, then edit it here.</p>
          ) : (
            <form
              key={selectedReward.id}
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);

                void handleAction(async () => {
                  await fetchJson(`/api/parent/rewards/${selectedReward.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: formData.get("title"),
                    description: formData.get("description") || undefined,
                    cost: Number(formData.get("cost")),
                    iconEmoji: editRewardEmoji,
                    isActive: formData.get("isActive") === "on"
                  })
                });
                }, "Reward updated");
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Reward
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={selectedReward.id}
                  onChange={(event) => setSelectedRewardId(event.target.value)}
                >
                  {data.rewards.map((reward) => (
                    <option key={reward.id} value={reward.id}>
                      {reward.title}
                    </option>
                  ))}
                </select>
              </label>

              <Input name="title" label="Reward name" defaultValue={selectedReward.title} required />
              <Input
                name="description"
                label="Description (optional)"
                defaultValue={selectedReward.description ?? ""}
              />
              <Input name="cost" label="Points cost" type="number" min={1} defaultValue={selectedReward.cost} required />
              <RewardEmojiPicker value={editRewardEmoji} onChange={setEditRewardEmoji} />

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={selectedReward.isActive}
                  className="h-4 w-4"
                />
                Reward is active
              </label>

              <Button type="submit" loading={saving} variant="secondary">
                Save Reward Changes
              </Button>
            </form>
          )}
        </Card>
        </section>
      ) : null}

      {showApprovals ? (
        <section id="approvals" className="mb-6 grid gap-4 lg:grid-cols-2">
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
                        }, "Task completion approved")
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
                        }, "Task completion rejected")
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
                    {entry.child.childProfile?.avatarEmoji ?? "⭐"} {entry.child.displayName}: {entry.reward.iconEmoji}{" "}
                    {entry.reward.title}
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
                        }, "Reward approved")
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
                        }, "Reward rejected")
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
      ) : null}

      {showBillingTools ? (
        <section id="billing-tools" className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Billing & Subscription</h2>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              Status: <span className="font-semibold capitalize">{formatStatusLabel(data.billing.status)}</span>
            </p>
            <p>
              Current interval:{" "}
              <span className="font-semibold capitalize">{data.billing.interval.toLowerCase()}</span>
            </p>
            <p>
              Family size: <span className="font-semibold">{data.billing.childCount}</span> child profiles
            </p>
            <p>
              Monthly model: <span className="font-semibold">{formatCents(data.billing.monthlyAmountCents)}</span>
            </p>
            <p>
              Annual model (10x monthly):{" "}
              <span className="font-semibold">{formatCents(data.billing.annualAmountCents)}</span>
            </p>
            <p>
              Stripe linked:{" "}
              <span className={`font-semibold ${data.billing.stripeCustomerLinked ? "text-board-mint" : "text-board-coral"}`}>
                {data.billing.stripeCustomerLinked ? "Yes" : "Not yet"}
              </span>
            </p>
            {data.billing.currentPeriodEnd ? (
              <p>
                Current period ends:{" "}
                <span className="font-semibold">
                  {new Date(data.billing.currentPeriodEnd).toLocaleDateString()}
                </span>
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              loading={saving}
              onClick={() =>
                void handleAction(async () => {
                  const result = await fetchJson<{ url: string | null }>("/api/billing/checkout-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ interval: "MONTHLY" })
                  });

                  if (result.url) {
                    window.location.href = result.url;
                  }
                }, "Opening Stripe checkout")
              }
            >
              Start Monthly Plan
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={saving}
              onClick={() =>
                void handleAction(async () => {
                  const result = await fetchJson<{ url: string | null }>("/api/billing/checkout-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ interval: "ANNUAL" })
                  });

                  if (result.url) {
                    window.location.href = result.url;
                  }
                }, "Opening Stripe checkout")
              }
            >
              Start Annual Plan
            </Button>
            <Button
              type="button"
              variant="ghost"
              loading={saving}
              onClick={() =>
                void handleAction(async () => {
                  const result = await fetchJson<{ url: string }>("/api/billing/portal-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                  });
                  window.location.href = result.url;
                }, "Opening billing portal")
              }
            >
              Open Billing Portal
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Family Parents</h2>
          <div className="space-y-2 text-sm">
            {data.parents.map((parent) => (
              <div key={parent.id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-semibold">
                  {parent.displayName} {parent.isFamilyOwner ? "(Owner)" : ""}
                </p>
                <p className="text-slate-600">{parent.email}</p>
                <p className="text-xs text-slate-500">Added {new Date(parent.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </Card>
        </section>
      ) : null}

      {showVoiceTools ? (
        <section id="voice-tools" className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Voice Assistant Tokens</h2>
          <p className="mb-3 text-sm text-slate-600">
            Create private tokens per parent for Siri Shortcuts or Google Home automations.
          </p>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(event.currentTarget);

              void handleAction(async () => {
                const created = await fetchJson<VoiceTokenRow>("/api/parent/voice/tokens", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    label: formData.get("label")
                  })
                });

                if (created.token) {
                  setRevealedVoiceToken(created.token);
                }
                form.reset();
              }, "Voice token created");
            }}
          >
            <Input name="label" label="Token label" placeholder="Kitchen speaker" required />
            <Button type="submit" loading={saving}>
              Create Voice Token
            </Button>
          </form>
          {revealedVoiceToken ? (
            <div className="mt-3 rounded-xl border border-board-sun/30 bg-board-sun/10 p-3 text-sm">
              <p className="font-semibold text-board-ink">Copy this token now:</p>
              <p className="mt-1 break-all font-mono text-xs text-board-ink">{revealedVoiceToken}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">My Voice Tokens</h2>
          <div className="space-y-3">
            {voiceTokens.length === 0 ? (
              <p className="text-sm text-slate-500">No voice tokens yet.</p>
            ) : (
              voiceTokens.map((token) => (
                <div key={token.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold">{token.label}</p>
                  <p className="text-xs text-slate-500">Preview: {token.tokenPreview ?? "n/a"}</p>
                  <p className="text-xs text-slate-500">
                    Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "Never"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant={token.isActive ? "danger" : "secondary"}
                      className="h-8"
                      loading={saving}
                      onClick={() =>
                        void handleAction(async () => {
                          await fetchJson(`/api/parent/voice/tokens/${token.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isActive: !token.isActive })
                          });
                        }, token.isActive ? "Voice token revoked" : "Voice token re-activated")
                      }
                    >
                      {token.isActive ? "Revoke" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        </section>
      ) : null}

      {showSupportTools ? (
        <section id="support-tools" className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Open Support Ticket</h2>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(event.currentTarget);

              void handleAction(async () => {
                await fetchJson("/api/parent/support/tickets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    subject: formData.get("subject"),
                    description: formData.get("description"),
                    type: formData.get("type"),
                    priority: formData.get("priority"),
                    category: formData.get("category") || undefined
                  })
                });
                form.reset();
              }, "Support ticket opened");
            }}
          >
            <Input name="subject" label="Subject" required />
            <Input name="category" label="Category (optional)" />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ticket type
              <select
                name="type"
                defaultValue="SUPPORT"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="SUPPORT">Support issue</option>
                <option value="FEATURE_REQUEST">Feature request</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Priority
              <select
                name="priority"
                defaultValue="NORMAL"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Description
              <textarea
                name="description"
                rows={4}
                required
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-board-mint transition focus:ring-2"
                placeholder="Describe the issue and what you already tried."
              />
            </label>
            <Button type="submit" loading={saving}>
              Submit Ticket
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Support Timeline</h2>
          <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
            {data.supportTickets.length === 0 ? (
              <p className="text-sm text-slate-500">No support tickets yet.</p>
            ) : (
              data.supportTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {formatStatusLabel(ticket.status)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        ticket.type === "FEATURE_REQUEST"
                          ? "bg-board-sky/20 text-board-ink"
                          : "bg-board-mint/20 text-board-ink"
                      }`}
                    >
                      {ticket.type === "FEATURE_REQUEST" ? "feature request" : "support"}
                    </span>
                    <span className="rounded-full bg-board-sun/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-board-ink">
                      {ticket.priority.toLowerCase()}
                    </span>
                  </div>
                  <p className="font-semibold">{ticket.subject}</p>
                  <p className="text-xs text-slate-500">
                    Created by {ticket.createdBy.displayName} • {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                  {ticket.assignedTo ? (
                    <p className="text-xs text-slate-500">Assigned to {ticket.assignedTo.displayName}</p>
                  ) : null}

                  <div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    {ticket.messages.map((message) => (
                      <div key={message.id} className="rounded-xl bg-white p-2 text-xs shadow-sm">
                        <p className="font-semibold">{message.author.displayName}</p>
                        <p>{message.body}</p>
                        <p className="text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <form
                    className="mt-2 grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const formData = new FormData(event.currentTarget);

                      void handleAction(async () => {
                        await fetchJson(`/api/parent/support/tickets/${ticket.id}/messages`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            body: formData.get("body")
                          })
                        });
                        form.reset();
                      }, "Support reply sent");
                    }}
                  >
                    <textarea
                      name="body"
                      rows={2}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-board-mint transition focus:ring-2"
                      placeholder="Reply to this ticket"
                      required
                    />
                    <Button type="submit" variant="secondary" loading={saving}>
                      Send Reply
                    </Button>
                  </form>
                </div>
              ))
            )}
          </div>
        </Card>
        </section>
      ) : null}

      {showAdminTools ? (
        <section id="admin-settings" className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Admin: Parent Accounts</h2>
          <p className="mb-3 text-sm text-slate-600">
            Family owner can add a second parent login for shared management.
          </p>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(event.currentTarget);

              void handleAction(async () => {
                await fetchJson("/api/parent/parents", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    parentName: formData.get("parentName"),
                    email: formData.get("email"),
                    password: formData.get("password")
                  })
                });
                form.reset();
              }, "Parent account created");
            }}
          >
            <Input name="parentName" label="Parent name" required />
            <Input name="email" label="Parent email" type="email" required />
            <Input name="password" label="Parent password" type="password" required />
            <Button type="submit" loading={saving}>
              Create Parent Account
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Admin: Child Accounts</h2>
          <p className="mb-3 text-sm text-slate-600">
            Add or manage child logins from this admin area instead of the regular daily workflow.
          </p>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(event.currentTarget);
              void handleAction(async () => {
                await fetchJson("/api/parent/children", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    childName: formData.get("childName"),
                    email: formData.get("email"),
                    password: formData.get("password"),
                    avatarEmoji: formData.get("avatarEmoji") || selectedAvatar
                  })
                });
                form.reset();
                setSelectedAvatar("⭐");
              }, "Child account created");
            }}
          >
            <Input name="childName" label="Child name" required />
            <Input name="email" label="Child email" type="email" required />
            <Input name="password" label="Child password" type="password" required />
            <input type="hidden" name="avatarEmoji" value={selectedAvatar} />
            <AvatarPicker value={selectedAvatar} onChange={setSelectedAvatar} />
            <Button type="submit" loading={saving}>
              Create Child Account
            </Button>
          </form>
        </Card>
        </section>
      ) : null}

      {showActivityPanel ? (
        <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Active Tasks & Rewards</h2>
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {data.tasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks available yet.</p>
            ) : (
              data.tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {task.assignedChild.childProfile?.avatarEmoji ?? "⭐"} {task.assignedChild.displayName} • {task.points} pts •{" "}
                    {task.taskType.replace("_", " ")} / {task.recurrenceType}
                  </p>
                  {task.deadlineAt ? (
                    <p className="mt-1 text-xs font-semibold text-board-coral">
                      Deadline: {new Date(task.deadlineAt).toLocaleString()}
                    </p>
                  ) : null}
                  {task.timerDurationMinutes ? (
                    <p className="mt-1 text-xs font-semibold text-board-ink">Timer: {task.timerDurationMinutes} min</p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <h3 className="mb-2 mt-4 text-lg font-bold">Rewards Catalog</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.rewards.length === 0 ? (
              <p className="text-sm text-slate-500">No rewards in catalog yet.</p>
            ) : (
              data.rewards.map((reward) => (
                <div key={reward.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold">
                    {reward.iconEmoji} {reward.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-board-sun/20 px-2 py-0.5 text-[10px] font-semibold text-board-ink">
                      {reward.cost} pts
                    </span>
                    <span className="rounded-full bg-board-mint/15 px-2 py-0.5 text-[10px] font-semibold text-board-ink">
                      Reward Badge
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Activity Timeline</h2>
          <div className="relative max-h-[420px] overflow-y-auto pr-1">
            {data.activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet. Events will appear here as your family uses StarBoard.</p>
            ) : (
              <>
                <span className="absolute left-[11px] top-1 h-[95%] w-px bg-slate-200" />
                <div className="space-y-3">
                  {data.activity.map((event) => (
                    <div key={event.id} className="relative rounded-xl border border-slate-200 p-3 pl-7">
                      <span className="absolute left-2.5 top-5 h-2.5 w-2.5 rounded-full bg-board-mint" />
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600">
                          {formatEventType(event.type)}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{event.message}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.createdAt).toLocaleString()} • {event.actor?.displayName ?? "System"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
        </section>
      ) : null}
    </main>
  );
}
