import { ActivityType, PointTransactionType, TaskCompletionStatus, type Task } from "@prisma/client";
import { createPointTransaction } from "@/lib/points/service";
import { getOccurrenceDate } from "@/lib/tasks/recurrence";
import { updateChildStreak } from "@/lib/tasks/streak";
import { hasPrismaErrorCode, runSerializable } from "@/lib/transactions";

interface SubmitTaskInput {
  task: Task;
  childId: string;
  actorId: string | null;
  occurrenceDate: Date;
  status: TaskCompletionStatus;
  note?: string;
  timerSessionId?: string | null;
  activityType: ActivityType;
  activityMessage: string;
  pointNote: string;
  voiceTokenLabel?: string;
}

export class TaskSubmissionConflict extends Error {}

export async function submitTask(input: SubmitTaskInput) {
  try {
    return await runSerializable(async (tx) => {
      const now = new Date();
      if (input.task.deadlineAt && now >= input.task.deadlineAt) {
        throw new TaskSubmissionConflict("Task deadline has passed");
      }
      if (getOccurrenceDate(now).getTime() !== input.occurrenceDate.getTime()) {
        throw new TaskSubmissionConflict("A new day has started. Refresh and try again.");
      }

      const existing = await tx.taskCompletion.findFirst({
        where: {
          taskId: input.task.id,
          childId: input.childId,
          OR: [
            { occurrenceDate: input.occurrenceDate },
            ...(input.task.taskType === "ONE_OFF"
              ? [{ status: { not: TaskCompletionStatus.REJECTED } }]
              : [])
          ]
        },
        select: { id: true }
      });
      if (existing) {
        throw new TaskSubmissionConflict("Task already submitted");
      }

      if (input.timerSessionId) {
        const timer = await tx.taskTimerSession.updateMany({
          where: {
            id: input.timerSessionId,
            childId: input.childId,
            taskId: input.task.id,
            completedAt: null,
            expiresAt: { gt: now }
          },
          data: { completedAt: now }
        });
        if (timer.count !== 1) {
          throw new TaskSubmissionConflict("Task timer expired or was already used");
        }
      }

      const approved = input.status !== TaskCompletionStatus.PENDING_APPROVAL;
      const completion = await tx.taskCompletion.create({
        data: {
          taskId: input.task.id,
          childId: input.childId,
          occurrenceDate: input.occurrenceDate,
          status: input.status,
          pointsAwarded: approved ? input.task.points : 0,
          reviewNote: input.note,
          reviewedAt: approved ? now : null,
          reviewedById: approved ? input.actorId : null
        }
      });

      if (approved) {
        await createPointTransaction({
          familyId: input.task.familyId,
          childId: input.childId,
          actorId: input.actorId,
          type: PointTransactionType.TASK_REWARD,
          amount: input.task.points,
          note: input.pointNote,
          referenceType: "TASK_COMPLETION",
          referenceId: completion.id
        }, tx);
        await updateChildStreak(input.childId, completion.completedAt, tx);
      }

      await tx.activityLog.create({
        data: {
          familyId: input.task.familyId,
          actorId: input.actorId,
          childId: input.childId,
          type: input.activityType,
          message: input.activityMessage,
          metadata: {
            completionId: completion.id,
            note: input.note,
            usedTimer: Boolean(input.timerSessionId),
            timerSessionId: input.timerSessionId ?? null,
            voiceTokenLabel: input.voiceTokenLabel
          }
        }
      });
      return completion;
    });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      throw new TaskSubmissionConflict("Task already submitted");
    }
    throw error;
  }
}
