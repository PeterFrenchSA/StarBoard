import { RecurrenceType, TaskType } from "@prisma/client";
import { getDay, startOfDay } from "date-fns";

export function getOccurrenceDate(date = new Date()): Date {
  return startOfDay(date);
}

interface RecurrenceInput {
  taskType: TaskType;
  recurrenceType: RecurrenceType;
  weekdays: number[];
}

export function canTaskOccurToday(task: RecurrenceInput, now = new Date()): boolean {
  if (task.taskType === "ONE_OFF" || task.recurrenceType === "NONE") {
    return true;
  }

  if (task.recurrenceType === "DAILY") {
    return true;
  }

  if (task.recurrenceType === "WEEKLY") {
    return getDay(now) === 1;
  }

  if (task.recurrenceType === "WEEKDAYS") {
    const currentDay = getDay(now);
    const normalized = currentDay === 0 ? 7 : currentDay;
    return task.weekdays.includes(normalized);
  }

  return false;
}
