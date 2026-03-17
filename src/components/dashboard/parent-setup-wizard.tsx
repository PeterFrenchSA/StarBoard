"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fetchJson } from "@/lib/fetch-json";

type TaskType = "RECURRING" | "ONE_OFF";
type RecurrenceType = "DAILY" | "WEEKLY" | "WEEKDAYS" | "NONE";

const themeOptions = [
  { value: "sun", label: "Sunrise Gold" },
  { value: "mint", label: "Mint Spark" },
  { value: "sky", label: "Sky Blue" },
  { value: "coral", label: "Coral Pop" }
];

const avatarOptions = ["⭐", "🌟", "🚀", "🧩", "🎨", "⚽", "📚", "🏅"];

interface ChildDraft {
  id: string;
  childName: string;
  email: string;
  password: string;
  avatarEmoji: string;
}

interface TaskDraft {
  id: string;
  title: string;
  description: string;
  points: number;
  taskType: TaskType;
  recurrenceType: RecurrenceType;
  weekdays: number[];
  requiresApproval: boolean;
  assignedChildEmail: string;
}

interface RewardDraft {
  id: string;
  title: string;
  description: string;
  cost: number;
  iconEmoji: string;
}

interface ParentSetupWizardProps {
  parentName: string;
  initialFamilyName: string;
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultChild(): ChildDraft {
  return {
    id: createId("child"),
    childName: "",
    email: "",
    password: "",
    avatarEmoji: "⭐"
  };
}

function defaultTask(assignedChildEmail: string): TaskDraft {
  return {
    id: createId("task"),
    title: "",
    description: "",
    points: 10,
    taskType: "RECURRING",
    recurrenceType: "DAILY",
    weekdays: [1, 2, 3, 4, 5],
    requiresApproval: true,
    assignedChildEmail
  };
}

function defaultReward(): RewardDraft {
  return {
    id: createId("reward"),
    title: "",
    description: "",
    cost: 60,
    iconEmoji: "🎁"
  };
}

const stepLabels = ["Family", "Children", "Tasks", "Rewards", "Review"];

export function ParentSetupWizard({ parentName, initialFamilyName }: ParentSetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [familyName, setFamilyName] = useState(initialFamilyName);
  const [themePreset, setThemePreset] = useState("sun");
  const [children, setChildren] = useState<ChildDraft[]>([defaultChild()]);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [rewards, setRewards] = useState<RewardDraft[]>([]);

  const childEmailOptions = useMemo(
    () =>
      children
        .map((child) => ({
          label: child.childName || child.email || "Child",
          email: child.email.trim().toLowerCase()
        }))
        .filter((entry) => entry.email.length > 0),
    [children]
  );

  function addStarterTemplates() {
    if (tasks.length > 0 || childEmailOptions.length === 0) {
      return;
    }

    const target = childEmailOptions[0].email;
    setTasks([
      {
        ...defaultTask(target),
        title: "Make your bed",
        points: 8,
        recurrenceType: "DAILY"
      },
      {
        ...defaultTask(target),
        title: "Read for 20 minutes",
        points: 12,
        taskType: "ONE_OFF",
        recurrenceType: "NONE"
      }
    ]);
  }

  function addRewardTemplates() {
    if (rewards.length > 0) {
      return;
    }

    setRewards([
      {
        ...defaultReward(),
        title: "Choose Friday movie",
        cost: 70,
        iconEmoji: "🎬"
      },
      {
        ...defaultReward(),
        title: "Extra screen time",
        cost: 45,
        iconEmoji: "📺"
      }
    ]);
  }

  async function completeWizard() {
    setError(null);
    setSaving(true);

    try {
      await fetchJson("/api/parent/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          familyName,
          themePreset,
          children: children
            .filter((child) => child.childName.trim() && child.email.trim() && child.password.trim())
            .map((child) => ({
              childName: child.childName,
              email: child.email,
              password: child.password,
              avatarEmoji: child.avatarEmoji
            })),
          tasks: tasks
            .filter((task) => task.title.trim() && task.assignedChildEmail.trim())
            .map((task) => ({
              title: task.title,
              description: task.description || undefined,
              points: task.points,
              taskType: task.taskType,
              recurrenceType: task.recurrenceType,
              weekdays: task.recurrenceType === "WEEKDAYS" ? task.weekdays : [],
              requiresApproval: task.requiresApproval,
              assignedChildEmail: task.assignedChildEmail
            })),
          rewards: rewards
            .filter((reward) => reward.title.trim())
            .map((reward) => ({
              title: reward.title,
              description: reward.description || undefined,
              cost: reward.cost,
              iconEmoji: reward.iconEmoji
            }))
        })
      });

      setSuccess("Setup complete. Loading your full parent dashboard...");
      router.replace("/parent");
      router.refresh();
    } catch (wizardError) {
      setError(wizardError instanceof Error ? wizardError.message : "Could not complete setup wizard");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <DashboardHeader
        title="Welcome Setup Wizard"
        subtitle={`Hi ${parentName}. Let's configure your StarBoard in a few simple steps.`}
      />

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm justify-end">
        {success ? <Toast message={success} /> : null}
      </div>

      {error ? <Toast message={error} variant="error" className="mb-4" /> : null}

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-5 gap-2">
          {stepLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                index === step
                  ? "bg-board-mint text-white"
                  : index < step
                    ? "bg-board-sun/20 text-board-ink"
                    : "bg-slate-100 text-slate-500"
              }`}
              onClick={() => {
                if (index <= step) {
                  setStep(index);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {step === 0 ? (
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Family Personalization</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Family name" value={familyName} onChange={(event) => setFamilyName(event.target.value)} required />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Theme preset
              <select
                value={themePreset}
                onChange={(event) => setThemePreset(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Child Accounts</h2>
          <p className="mb-3 text-sm text-slate-600">Add child logins now so tasks and rewards can be assigned immediately.</p>
          <div className="space-y-3">
            {children.map((child, index) => (
              <div key={child.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold">Child {index + 1}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Child name"
                    value={child.childName}
                    onChange={(event) =>
                      setChildren((current) =>
                        current.map((entry) =>
                          entry.id === child.id ? { ...entry, childName: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <Input
                    label="Child email"
                    type="email"
                    value={child.email}
                    onChange={(event) =>
                      setChildren((current) =>
                        current.map((entry) =>
                          entry.id === child.id ? { ...entry, email: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <Input
                    label="Child password"
                    type="password"
                    value={child.password}
                    onChange={(event) =>
                      setChildren((current) =>
                        current.map((entry) =>
                          entry.id === child.id ? { ...entry, password: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    Avatar
                    <select
                      value={child.avatarEmoji}
                      onChange={(event) =>
                        setChildren((current) =>
                          current.map((entry) =>
                            entry.id === child.id ? { ...entry, avatarEmoji: event.target.value } : entry
                          )
                        )
                      }
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      {avatarOptions.map((emoji) => (
                        <option key={emoji} value={emoji}>
                          {emoji}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {children.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 h-8"
                    onClick={() => setChildren((current) => current.filter((entry) => entry.id !== child.id))}
                  >
                    Remove Child
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setChildren((current) => [...current, defaultChild()])}>
            Add Another Child
          </Button>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Starter Tasks</h2>
          {childEmailOptions.length === 0 ? (
            <p className="text-sm text-slate-500">Add at least one child email before creating tasks.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" className="h-8" onClick={addStarterTemplates}>
                  Add Suggested Tasks
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8"
                  onClick={() =>
                    setTasks((current) => [...current, defaultTask(childEmailOptions[0]?.email ?? "")])
                  }
                >
                  Add Custom Task
                </Button>
              </div>

              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="Task title"
                        value={task.title}
                        onChange={(event) =>
                          setTasks((current) =>
                            current.map((entry) =>
                              entry.id === task.id ? { ...entry, title: event.target.value } : entry
                            )
                          )
                        }
                      />
                      <Input
                        label="Points"
                        type="number"
                        min={1}
                        value={task.points}
                        onChange={(event) =>
                          setTasks((current) =>
                            current.map((entry) =>
                              entry.id === task.id ? { ...entry, points: Number(event.target.value) } : entry
                            )
                          )
                        }
                      />
                      <Input
                        label="Description"
                        value={task.description}
                        onChange={(event) =>
                          setTasks((current) =>
                            current.map((entry) =>
                              entry.id === task.id ? { ...entry, description: event.target.value } : entry
                            )
                          )
                        }
                      />
                      <label className="flex flex-col gap-1 text-sm font-medium">
                        Assign to child email
                        <select
                          value={task.assignedChildEmail}
                          onChange={(event) =>
                            setTasks((current) =>
                              current.map((entry) =>
                                entry.id === task.id ? { ...entry, assignedChildEmail: event.target.value } : entry
                              )
                            )
                          }
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          {childEmailOptions.map((child) => (
                            <option key={child.email} value={child.email}>
                              {child.label} ({child.email})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium">
                        Task type
                        <select
                          value={task.taskType}
                          onChange={(event) =>
                            setTasks((current) =>
                              current.map((entry) =>
                                entry.id === task.id
                                  ? {
                                      ...entry,
                                      taskType: event.target.value as TaskType,
                                      recurrenceType: event.target.value === "ONE_OFF" ? "NONE" : entry.recurrenceType
                                    }
                                  : entry
                              )
                            )
                          }
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value="RECURRING">Recurring</option>
                          <option value="ONE_OFF">One-off</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium">
                        Recurrence
                        <select
                          value={task.recurrenceType}
                          onChange={(event) =>
                            setTasks((current) =>
                              current.map((entry) =>
                                entry.id === task.id
                                  ? { ...entry, recurrenceType: event.target.value as RecurrenceType }
                                  : entry
                              )
                            )
                          }
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="WEEKDAYS">Selected weekdays</option>
                          <option value="NONE">None</option>
                        </select>
                      </label>
                    </div>
                    <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={task.requiresApproval}
                        onChange={(event) =>
                          setTasks((current) =>
                            current.map((entry) =>
                              entry.id === task.id
                                ? {
                                    ...entry,
                                    requiresApproval: event.target.checked
                                  }
                                : entry
                            )
                          )
                        }
                        className="h-4 w-4"
                      />
                      Requires parent approval
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-2 h-8"
                      onClick={() => setTasks((current) => current.filter((entry) => entry.id !== task.id))}
                    >
                      Remove Task
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Starter Rewards</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="h-8" onClick={addRewardTemplates}>
              Add Suggested Rewards
            </Button>
            <Button type="button" variant="secondary" className="h-8" onClick={() => setRewards((current) => [...current, defaultReward()])}>
              Add Custom Reward
            </Button>
          </div>
          <div className="space-y-3">
            {rewards.map((reward) => (
              <div key={reward.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Reward title"
                    value={reward.title}
                    onChange={(event) =>
                      setRewards((current) =>
                        current.map((entry) =>
                          entry.id === reward.id ? { ...entry, title: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <Input
                    label="Cost"
                    type="number"
                    min={1}
                    value={reward.cost}
                    onChange={(event) =>
                      setRewards((current) =>
                        current.map((entry) =>
                          entry.id === reward.id ? { ...entry, cost: Number(event.target.value) } : entry
                        )
                      )
                    }
                  />
                  <Input
                    label="Description"
                    value={reward.description}
                    onChange={(event) =>
                      setRewards((current) =>
                        current.map((entry) =>
                          entry.id === reward.id ? { ...entry, description: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <Input
                    label="Emoji"
                    value={reward.iconEmoji}
                    onChange={(event) =>
                      setRewards((current) =>
                        current.map((entry) =>
                          entry.id === reward.id ? { ...entry, iconEmoji: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 h-8"
                  onClick={() => setRewards((current) => current.filter((entry) => entry.id !== reward.id))}
                >
                  Remove Reward
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Review and Launch</h2>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              Family: <span className="font-semibold">{familyName}</span>
            </p>
            <p>
              Theme: <span className="font-semibold capitalize">{themePreset}</span>
            </p>
            <p>
              Child accounts to create: <span className="font-semibold">{children.filter((child) => child.childName && child.email).length}</span>
            </p>
            <p>
              Starter tasks: <span className="font-semibold">{tasks.filter((task) => task.title).length}</span>
            </p>
            <p>
              Starter rewards: <span className="font-semibold">{rewards.filter((reward) => reward.title).length}</span>
            </p>
          </div>
          <Button className="mt-4" loading={saving} onClick={() => void completeWizard()}>
            Complete Setup Wizard
          </Button>
        </Card>
      ) : null}

      <section className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((value) => Math.max(0, value - 1))}>
          Back
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={step === stepLabels.length - 1 || saving}
          onClick={() => setStep((value) => Math.min(stepLabels.length - 1, value + 1))}
        >
          Next
        </Button>
      </section>
    </main>
  );
}
