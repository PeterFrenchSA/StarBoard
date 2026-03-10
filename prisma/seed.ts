import { PrismaClient, RecurrenceType, Role, TaskCompletionStatus, TaskType, PointTransactionType, ActivityType, RedemptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function hashVoiceToken(token: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

async function main() {
  const parentEmail = process.env.SEED_PARENT_EMAIL ?? "parent@starboard.local";
  const parentPassword = process.env.SEED_PARENT_PASSWORD ?? "ChangeMe123!";
  const voiceToken = process.env.SEED_VOICE_TOKEN ?? "starboard-voice-dev-token";
  const tokenSalt = process.env.VOICE_TOKEN_SALT ?? "change-me-too";

  await prisma.taskCompletion.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.voiceApiToken.deleteMany();
  await prisma.childProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.family.deleteMany();

  const passwordHash = await bcrypt.hash(parentPassword, 12);
  const childPasswordHash = await bcrypt.hash("StarKid123!", 12);

  const family = await prisma.family.create({
    data: {
      name: "Skywalkers",
      activityLogs: {
        create: {
          type: ActivityType.FAMILY_CREATED,
          message: "Family workspace created",
          metadata: { seeded: true }
        }
      }
    }
  });

  const parent = await prisma.user.create({
    data: {
      familyId: family.id,
      role: Role.PARENT,
      email: parentEmail,
      passwordHash,
      displayName: "Parent",
      activityAsActor: {
        create: {
          familyId: family.id,
          type: ActivityType.USER_CREATED,
          message: "Parent account created",
          metadata: { seeded: true }
        }
      }
    }
  });

  const leia = await prisma.user.create({
    data: {
      familyId: family.id,
      role: Role.CHILD,
      email: "leia@starboard.local",
      passwordHash: childPasswordHash,
      displayName: "Leia",
      childProfile: {
        create: {
          avatarEmoji: "🌟",
          colorTheme: "sun",
          currentStreak: 3,
          longestStreak: 5,
          lastStreakDate: startOfDay(new Date())
        }
      }
    },
    include: { childProfile: true }
  });

  const william = await prisma.user.create({
    data: {
      familyId: family.id,
      role: Role.CHILD,
      email: "william@starboard.local",
      passwordHash: childPasswordHash,
      displayName: "William",
      childProfile: {
        create: {
          avatarEmoji: "🚀",
          colorTheme: "sky",
          currentStreak: 1,
          longestStreak: 2,
          lastStreakDate: startOfDay(new Date())
        }
      }
    },
    include: { childProfile: true }
  });

  const makeBedLeia = await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: leia.id,
      title: "Make your bed",
      description: "Neatly make your bed before school.",
      points: 5,
      taskType: TaskType.RECURRING,
      recurrenceType: RecurrenceType.DAILY,
      weekdays: [],
      requiresApproval: false
    }
  });

  const tidyRoomWilliam = await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: william.id,
      title: "Room tidy-up",
      description: "Tidy room before dinner on weekdays.",
      points: 10,
      taskType: TaskType.RECURRING,
      recurrenceType: RecurrenceType.WEEKDAYS,
      weekdays: [1, 2, 3, 4, 5],
      requiresApproval: true
    }
  });

  const readingLeia = await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: leia.id,
      title: "Read for 20 minutes",
      description: "Read any book for at least 20 minutes.",
      points: 15,
      taskType: TaskType.ONE_OFF,
      recurrenceType: RecurrenceType.NONE,
      weekdays: [],
      requiresApproval: true
    }
  });

  await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: william.id,
      title: "Water the garden",
      description: "Water front and back garden beds.",
      points: 20,
      taskType: TaskType.ONE_OFF,
      recurrenceType: RecurrenceType.NONE,
      weekdays: [],
      requiresApproval: true
    }
  });

  const rewardMovie = await prisma.reward.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      title: "Choose Friday movie",
      description: "Pick the family movie this Friday.",
      cost: 80,
      iconEmoji: "🎬"
    }
  });

  const rewardIceCream = await prisma.reward.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      title: "Ice cream outing",
      description: "Go for ice cream at favorite spot.",
      cost: 120,
      iconEmoji: "🍦"
    }
  });

  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  await prisma.taskCompletion.create({
    data: {
      taskId: makeBedLeia.id,
      childId: leia.id,
      occurrenceDate: today,
      status: TaskCompletionStatus.AUTO_APPROVED,
      pointsAwarded: makeBedLeia.points,
      reviewedAt: new Date(),
      reviewedById: parent.id
    }
  });

  await prisma.taskCompletion.create({
    data: {
      taskId: tidyRoomWilliam.id,
      childId: william.id,
      occurrenceDate: today,
      status: TaskCompletionStatus.PENDING_APPROVAL,
      pointsAwarded: 0
    }
  });

  await prisma.taskCompletion.create({
    data: {
      taskId: readingLeia.id,
      childId: leia.id,
      occurrenceDate: yesterday,
      status: TaskCompletionStatus.APPROVED,
      pointsAwarded: readingLeia.points,
      reviewedAt: new Date(),
      reviewedById: parent.id
    }
  });

  await prisma.pointTransaction.createMany({
    data: [
      {
        familyId: family.id,
        childId: leia.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 25,
        note: "Great attitude this week",
        referenceType: "SEED"
      },
      {
        familyId: family.id,
        childId: leia.id,
        actorId: parent.id,
        type: PointTransactionType.TASK_REWARD,
        amount: makeBedLeia.points,
        note: "Task auto-approved: Make your bed",
        referenceType: "TASK_COMPLETION"
      },
      {
        familyId: family.id,
        childId: leia.id,
        actorId: parent.id,
        type: PointTransactionType.TASK_REWARD,
        amount: readingLeia.points,
        note: "Task approved: Read for 20 minutes",
        referenceType: "TASK_COMPLETION"
      },
      {
        familyId: family.id,
        childId: william.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 10,
        note: "Helped with groceries",
        referenceType: "SEED"
      },
      {
        familyId: family.id,
        childId: william.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_REMOVE,
        amount: -5,
        note: "Missed evening routine",
        referenceType: "SEED"
      }
    ]
  });

  await prisma.rewardRedemption.create({
    data: {
      familyId: family.id,
      rewardId: rewardMovie.id,
      childId: leia.id,
      pointsCost: rewardMovie.cost,
      status: RedemptionStatus.REQUESTED,
      note: "Can I pick this week?"
    }
  });

  await prisma.activityLog.createMany({
    data: [
      {
        familyId: family.id,
        actorId: parent.id,
        childId: leia.id,
        type: ActivityType.TASK_CREATED,
        message: "Created recurring task: Make your bed"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        childId: william.id,
        type: ActivityType.TASK_CREATED,
        message: "Created recurring task: Room tidy-up"
      },
      {
        familyId: family.id,
        actorId: leia.id,
        childId: leia.id,
        type: ActivityType.TASK_COMPLETED,
        message: "Leia completed Make your bed"
      },
      {
        familyId: family.id,
        actorId: william.id,
        childId: william.id,
        type: ActivityType.TASK_COMPLETED,
        message: "William completed Room tidy-up (pending approval)"
      },
      {
        familyId: family.id,
        actorId: leia.id,
        childId: leia.id,
        type: ActivityType.REWARD_REQUESTED,
        message: "Leia requested reward: Choose Friday movie"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        childId: william.id,
        type: ActivityType.POINTS_ADJUSTED,
        message: "Adjusted points for William: -5"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        childId: leia.id,
        type: ActivityType.POINTS_ADJUSTED,
        message: "Adjusted points for Leia: +25"
      }
    ]
  });

  await prisma.voiceApiToken.create({
    data: {
      familyId: family.id,
      label: "Home Assistant",
      tokenHash: hashVoiceToken(voiceToken, tokenSalt),
      isActive: true,
      createdById: parent.id
    }
  });

  await prisma.activityLog.create({
    data: {
      familyId: family.id,
      actorId: parent.id,
      type: ActivityType.REWARD_CREATED,
      message: `Created rewards: ${rewardMovie.title}, ${rewardIceCream.title}`
    }
  });

  console.log("Seed complete.");
  console.log(`Parent login: ${parentEmail} / ${parentPassword}`);
  console.log("Child logins: leia@starboard.local / StarKid123!, william@starboard.local / StarKid123!");
  console.log(`Voice token (plain): ${voiceToken}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
