import { TaskCompletionStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";

export async function hasChildCompletedTask(taskId: string, childId: string): Promise<boolean> {
  const completion = await db.taskCompletion.findFirst({
    where: {
      taskId,
      childId,
      status: {
        in: [
          TaskCompletionStatus.PENDING_APPROVAL,
          TaskCompletionStatus.APPROVED,
          TaskCompletionStatus.AUTO_APPROVED
        ]
      }
    },
    include: {
      task: true
    }
  });

  if (!completion) {
    return false;
  }

  if (completion.task.taskType === TaskType.ONE_OFF) {
    return true;
  }

  const today = new Date();
  const date = completion.occurrenceDate;

  return (
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate()
  );
}
