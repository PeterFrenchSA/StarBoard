import { describe, expect, it } from "vitest";
import { createTaskSchema } from "@/lib/validation/parent";

describe("parent task validation", () => {
  it("accepts recurring tasks assigned to multiple children", () => {
    const result = createTaskSchema.safeParse({
      assignedChildIds: ["cmchild000000000000000001", "cmchild000000000000000002"],
      title: "Tidy room",
      description: "Quick tidy",
      points: 12,
      taskType: "RECURRING",
      recurrenceType: "DAILY",
      weekdays: [],
      requiresApproval: true
    });

    expect(result.success).toBe(true);
  });

  it("rejects one-off tasks assigned to multiple children", () => {
    const result = createTaskSchema.safeParse({
      assignedChildIds: ["cmchild000000000000000001", "cmchild000000000000000002"],
      title: "Science fair project",
      points: 20,
      taskType: "ONE_OFF",
      recurrenceType: "NONE",
      weekdays: [],
      requiresApproval: true
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues.some((issue) => issue.message.includes("One-off tasks can only be assigned"))).toBe(true);
  });

  it("accepts timer and deadline fields", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const result = createTaskSchema.safeParse({
      assignedChildId: "cmchild000000000000000001",
      title: "Practice piano",
      points: 15,
      taskType: "ONE_OFF",
      recurrenceType: "NONE",
      weekdays: [],
      deadlineAt: future,
      timerDurationMinutes: 25,
      requiresApproval: true
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.timerDurationMinutes).toBe(25);
    expect(result.data.deadlineAt).toBeInstanceOf(Date);
  });

  it("rejects past deadlines for task creation", () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();

    const result = createTaskSchema.safeParse({
      assignedChildIds: ["cmchild000000000000000001"],
      title: "Pack bag",
      points: 8,
      taskType: "RECURRING",
      recurrenceType: "DAILY",
      weekdays: [],
      deadlineAt: past,
      requiresApproval: true
    });

    expect(result.success).toBe(false);
  });
});
