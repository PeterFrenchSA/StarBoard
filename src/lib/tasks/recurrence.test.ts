import { describe, expect, it } from "vitest";
import { canTaskOccurToday } from "@/lib/tasks/recurrence";

describe("canTaskOccurToday", () => {
  it("returns true for daily recurrence", () => {
    expect(
      canTaskOccurToday({
        taskType: "RECURRING",
        recurrenceType: "DAILY",
        weekdays: []
      })
    ).toBe(true);
  });

  it("returns true for selected weekday", () => {
    const monday = new Date("2026-03-09T08:00:00.000Z");

    expect(
      canTaskOccurToday(
        {
          taskType: "RECURRING",
          recurrenceType: "WEEKDAYS",
          weekdays: [1, 3, 5]
        },
        monday
      )
    ).toBe(true);
  });

  it("returns false when weekday is not selected", () => {
    const tuesday = new Date("2026-03-10T08:00:00.000Z");

    expect(
      canTaskOccurToday(
        {
          taskType: "RECURRING",
          recurrenceType: "WEEKDAYS",
          weekdays: [1, 3, 5]
        },
        tuesday
      )
    ).toBe(false);
  });
});
