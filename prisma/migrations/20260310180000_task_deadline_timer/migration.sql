-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "deadlineAt" TIMESTAMP(3),
ADD COLUMN "timerDurationMinutes" INTEGER;

-- CreateTable
CREATE TABLE "TaskTimerSession" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTimerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskTimerSession_taskId_childId_occurrenceDate_key" ON "TaskTimerSession"("taskId", "childId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "TaskTimerSession_childId_expiresAt_idx" ON "TaskTimerSession"("childId", "expiresAt");

-- CreateIndex
CREATE INDEX "TaskTimerSession_taskId_occurrenceDate_idx" ON "TaskTimerSession"("taskId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "TaskTimerSession" ADD CONSTRAINT "TaskTimerSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimerSession" ADD CONSTRAINT "TaskTimerSession_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
