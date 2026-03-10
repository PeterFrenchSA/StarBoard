import { differenceInCalendarDays, startOfDay } from "date-fns";
import { db } from "@/lib/db";

export async function updateChildStreak(childId: string, completionDate: Date): Promise<void> {
  const profile = await db.childProfile.findUnique({
    where: { userId: childId }
  });

  if (!profile) {
    return;
  }

  const completionDay = startOfDay(completionDate);

  if (!profile.lastStreakDate) {
    await db.childProfile.update({
      where: { userId: childId },
      data: {
        currentStreak: 1,
        longestStreak: Math.max(profile.longestStreak, 1),
        lastStreakDate: completionDay
      }
    });
    return;
  }

  const lastDay = startOfDay(profile.lastStreakDate);
  const diffDays = differenceInCalendarDays(completionDay, lastDay);

  if (diffDays <= 0) {
    return;
  }

  const currentStreak = diffDays === 1 ? profile.currentStreak + 1 : 1;

  await db.childProfile.update({
    where: { userId: childId },
    data: {
      currentStreak,
      longestStreak: Math.max(profile.longestStreak, currentStreak),
      lastStreakDate: completionDay
    }
  });
}
