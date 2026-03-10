import {
  ActivityType,
  PointTransactionType,
  PrismaClient,
  RecurrenceType,
  RedemptionStatus,
  Role,
  TaskCompletionStatus,
  TaskType
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function hashVoiceToken(token: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

async function resetDatabase() {
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
}

interface FamilySeedConfig {
  familyName: string;
  parentEmail: string;
  parentName: string;
  voiceToken: string;
  voiceLabel: string;
}

async function createFamilyWorkspace(config: FamilySeedConfig, parentPasswordHash: string, tokenSalt: string) {
  const family = await prisma.family.create({
    data: {
      name: config.familyName,
      activityLogs: {
        create: {
          type: ActivityType.FAMILY_CREATED,
          message: `Family workspace created (${config.familyName})`,
          metadata: { seeded: true }
        }
      }
    }
  });

  const parent = await prisma.user.create({
    data: {
      familyId: family.id,
      role: Role.PARENT,
      email: config.parentEmail,
      passwordHash: parentPasswordHash,
      displayName: config.parentName,
      activityAsActor: {
        create: {
          familyId: family.id,
          type: ActivityType.USER_CREATED,
          message: `${config.parentName} parent account created`,
          metadata: { seeded: true }
        }
      }
    }
  });

  await prisma.voiceApiToken.create({
    data: {
      familyId: family.id,
      label: config.voiceLabel,
      tokenHash: hashVoiceToken(config.voiceToken, tokenSalt),
      isActive: true,
      createdById: parent.id
    }
  });

  return { family, parent };
}

async function createChild(
  familyId: string,
  childPasswordHash: string,
  input: {
    email: string;
    displayName: string;
    avatarEmoji: string;
    colorTheme: string;
    currentStreak: number;
    longestStreak: number;
  }
) {
  return prisma.user.create({
    data: {
      familyId,
      role: Role.CHILD,
      email: input.email,
      passwordHash: childPasswordHash,
      displayName: input.displayName,
      childProfile: {
        create: {
          avatarEmoji: input.avatarEmoji,
          colorTheme: input.colorTheme,
          currentStreak: input.currentStreak,
          longestStreak: input.longestStreak,
          lastStreakDate: startOfDay(new Date())
        }
      }
    },
    include: { childProfile: true }
  });
}

async function seedTaskAllocationDataset(parentPasswordHash: string, childPasswordHash: string, tokenSalt: string) {
  const parentPassword = process.env.SEED_PARENT_PASSWORD ?? "ChangeMe123!";
  const parentEmail = process.env.SEED_PARENT_EMAIL ?? "parent@starboard.local";
  const voiceToken = process.env.SEED_VOICE_TOKEN ?? "starboard-voice-dev-token";

  const { family, parent } = await createFamilyWorkspace(
    {
      familyName: "Skywalkers - Task Allocation",
      parentEmail,
      parentName: "Parent Allocation",
      voiceToken,
      voiceLabel: "Allocation Assistant"
    },
    parentPasswordHash,
    tokenSalt
  );

  const leia = await createChild(family.id, childPasswordHash, {
    email: "leia@starboard.local",
    displayName: "Leia",
    avatarEmoji: "🌟",
    colorTheme: "sun",
    currentStreak: 2,
    longestStreak: 4
  });

  const william = await createChild(family.id, childPasswordHash, {
    email: "william@starboard.local",
    displayName: "William",
    avatarEmoji: "🚀",
    colorTheme: "sky",
    currentStreak: 1,
    longestStreak: 3
  });

  await prisma.task.createMany({
    data: [
      {
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
      },
      {
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
      },
      {
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
      },
      {
        familyId: family.id,
        createdById: parent.id,
        assignedChildId: william.id,
        title: "Pack school bag",
        description: "Prepare school books and lunch box for tomorrow.",
        points: 8,
        taskType: TaskType.RECURRING,
        recurrenceType: RecurrenceType.DAILY,
        weekdays: [],
        requiresApproval: false
      }
    ]
  });

  await prisma.reward.createMany({
    data: [
      {
        familyId: family.id,
        createdById: parent.id,
        title: "Choose Friday movie",
        description: "Pick the movie for family movie night.",
        cost: 70,
        iconEmoji: "🎬"
      },
      {
        familyId: family.id,
        createdById: parent.id,
        title: "Extra screen time",
        description: "30 extra minutes of screen time.",
        cost: 45,
        iconEmoji: "📺"
      }
    ]
  });

  await prisma.pointTransaction.createMany({
    data: [
      {
        familyId: family.id,
        childId: leia.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 25,
        note: "Starter points for testing",
        referenceType: "SEED"
      },
      {
        familyId: family.id,
        childId: william.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 18,
        note: "Starter points for testing",
        referenceType: "SEED"
      }
    ]
  });

  await prisma.activityLog.createMany({
    data: [
      {
        familyId: family.id,
        actorId: parent.id,
        childId: leia.id,
        type: ActivityType.TASK_CREATED,
        message: "Created task set for allocation testing (Leia)"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        childId: william.id,
        type: ActivityType.TASK_CREATED,
        message: "Created task set for allocation testing (William)"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        type: ActivityType.REWARD_CREATED,
        message: "Created rewards for allocation testing"
      }
    ]
  });

  return {
    parentEmail,
    parentPassword,
    childEmails: ["leia@starboard.local", "william@starboard.local"],
    voiceToken
  };
}

async function seedApprovalDataset(parentPasswordHash: string, childPasswordHash: string, tokenSalt: string) {
  const parentPassword = process.env.SEED_PARENT_PASSWORD ?? "ChangeMe123!";

  const { family, parent } = await createFamilyWorkspace(
    {
      familyName: "Guardians - Approval Flow",
      parentEmail: "parent.approvals@starboard.local",
      parentName: "Parent Approvals",
      voiceToken: "starboard-voice-approvals",
      voiceLabel: "Approval Assistant"
    },
    parentPasswordHash,
    tokenSalt
  );

  const asha = await createChild(family.id, childPasswordHash, {
    email: "asha@starboard.local",
    displayName: "Asha",
    avatarEmoji: "🧩",
    colorTheme: "mint",
    currentStreak: 3,
    longestStreak: 6
  });

  const noah = await createChild(family.id, childPasswordHash, {
    email: "noah@starboard.local",
    displayName: "Noah",
    avatarEmoji: "🛹",
    colorTheme: "sky",
    currentStreak: 1,
    longestStreak: 4
  });

  const washDishes = await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: asha.id,
      title: "Wash dishes",
      description: "Wash and dry all dinner dishes.",
      points: 12,
      taskType: TaskType.RECURRING,
      recurrenceType: RecurrenceType.DAILY,
      weekdays: [],
      requiresApproval: true
    }
  });

  const pianoPractice = await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: noah.id,
      title: "Practice piano",
      description: "Practice for at least 20 minutes.",
      points: 15,
      taskType: TaskType.RECURRING,
      recurrenceType: RecurrenceType.WEEKDAYS,
      weekdays: [1, 2, 3, 4, 5],
      requiresApproval: true
    }
  });

  const cleanDesk = await prisma.task.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      assignedChildId: asha.id,
      title: "Clean study desk",
      description: "Organize books and wipe desk surface.",
      points: 20,
      taskType: TaskType.ONE_OFF,
      recurrenceType: RecurrenceType.NONE,
      weekdays: [],
      requiresApproval: true
    }
  });

  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  await prisma.taskCompletion.createMany({
    data: [
      {
        taskId: washDishes.id,
        childId: asha.id,
        occurrenceDate: today,
        status: TaskCompletionStatus.PENDING_APPROVAL,
        pointsAwarded: 0,
        reviewNote: "Please review sink and cups"
      },
      {
        taskId: pianoPractice.id,
        childId: noah.id,
        occurrenceDate: today,
        status: TaskCompletionStatus.PENDING_APPROVAL,
        pointsAwarded: 0,
        reviewNote: "Practiced scales and song"
      },
      {
        taskId: cleanDesk.id,
        childId: asha.id,
        occurrenceDate: yesterday,
        status: TaskCompletionStatus.APPROVED,
        pointsAwarded: cleanDesk.points,
        reviewedAt: new Date(),
        reviewedById: parent.id,
        reviewNote: "Well organized"
      }
    ]
  });

  await prisma.pointTransaction.createMany({
    data: [
      {
        familyId: family.id,
        childId: asha.id,
        actorId: parent.id,
        type: PointTransactionType.TASK_REWARD,
        amount: cleanDesk.points,
        note: "Task approved: Clean study desk",
        referenceType: "TASK_COMPLETION"
      },
      {
        familyId: family.id,
        childId: noah.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 30,
        note: "Good focus this week",
        referenceType: "SEED"
      }
    ]
  });

  await prisma.reward.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      title: "Bowling night",
      description: "Choose a weekend bowling night.",
      cost: 95,
      iconEmoji: "🎳"
    }
  });

  await prisma.activityLog.createMany({
    data: [
      {
        familyId: family.id,
        actorId: asha.id,
        childId: asha.id,
        type: ActivityType.TASK_COMPLETED,
        message: "Asha submitted Wash dishes for approval"
      },
      {
        familyId: family.id,
        actorId: noah.id,
        childId: noah.id,
        type: ActivityType.TASK_COMPLETED,
        message: "Noah submitted Practice piano for approval"
      }
    ]
  });

  return {
    parentEmail: "parent.approvals@starboard.local",
    parentPassword,
    childEmails: ["asha@starboard.local", "noah@starboard.local"],
    voiceToken: "starboard-voice-approvals"
  };
}

async function seedRedemptionDataset(parentPasswordHash: string, childPasswordHash: string, tokenSalt: string) {
  const parentPassword = process.env.SEED_PARENT_PASSWORD ?? "ChangeMe123!";

  const { family, parent } = await createFamilyWorkspace(
    {
      familyName: "Rangers - Reward Redemption",
      parentEmail: "parent.rewards@starboard.local",
      parentName: "Parent Rewards",
      voiceToken: "starboard-voice-rewards",
      voiceLabel: "Rewards Assistant"
    },
    parentPasswordHash,
    tokenSalt
  );

  const mia = await createChild(family.id, childPasswordHash, {
    email: "mia@starboard.local",
    displayName: "Mia",
    avatarEmoji: "🎨",
    colorTheme: "sun",
    currentStreak: 4,
    longestStreak: 8
  });

  const liam = await createChild(family.id, childPasswordHash, {
    email: "liam@starboard.local",
    displayName: "Liam",
    avatarEmoji: "⚽",
    colorTheme: "coral",
    currentStreak: 2,
    longestStreak: 5
  });

  const arcade = await prisma.reward.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      title: "Arcade trip",
      description: "Weekend arcade challenge.",
      cost: 100,
      iconEmoji: "🕹️"
    }
  });

  const zoo = await prisma.reward.create({
    data: {
      familyId: family.id,
      createdById: parent.id,
      title: "Zoo outing",
      description: "Pick a Saturday zoo outing.",
      cost: 140,
      iconEmoji: "🦓"
    }
  });

  await prisma.pointTransaction.createMany({
    data: [
      {
        familyId: family.id,
        childId: mia.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 165,
        note: "Saved points for redemption tests",
        referenceType: "SEED"
      },
      {
        familyId: family.id,
        childId: liam.id,
        actorId: parent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 220,
        note: "Saved points for redemption tests",
        referenceType: "SEED"
      },
      {
        familyId: family.id,
        childId: liam.id,
        actorId: parent.id,
        type: PointTransactionType.REWARD_REDEMPTION,
        amount: -140,
        note: "Reward redeemed: Zoo outing",
        referenceType: "REWARD_REDEMPTION"
      }
    ]
  });

  await prisma.rewardRedemption.createMany({
    data: [
      {
        familyId: family.id,
        rewardId: arcade.id,
        childId: mia.id,
        pointsCost: arcade.cost,
        status: RedemptionStatus.REQUESTED,
        note: "Can I redeem for this weekend?"
      },
      {
        familyId: family.id,
        rewardId: zoo.id,
        childId: liam.id,
        pointsCost: zoo.cost,
        status: RedemptionStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: parent.id,
        note: "Approved and scheduled"
      }
    ]
  });

  await prisma.activityLog.createMany({
    data: [
      {
        familyId: family.id,
        actorId: mia.id,
        childId: mia.id,
        type: ActivityType.REWARD_REQUESTED,
        message: "Mia requested Arcade trip"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        childId: liam.id,
        type: ActivityType.REWARD_APPROVED,
        message: "Parent Rewards approved Zoo outing for Liam"
      }
    ]
  });

  return {
    parentEmail: "parent.rewards@starboard.local",
    parentPassword,
    childEmails: ["mia@starboard.local", "liam@starboard.local"],
    voiceToken: "starboard-voice-rewards"
  };
}

async function main() {
  const parentPassword = process.env.SEED_PARENT_PASSWORD ?? "ChangeMe123!";
  const childPassword = "StarKid123!";
  const tokenSalt = process.env.VOICE_TOKEN_SALT ?? "change-me-too";

  await resetDatabase();

  const parentPasswordHash = await bcrypt.hash(parentPassword, 12);
  const childPasswordHash = await bcrypt.hash(childPassword, 12);

  const allocation = await seedTaskAllocationDataset(parentPasswordHash, childPasswordHash, tokenSalt);
  const approvals = await seedApprovalDataset(parentPasswordHash, childPasswordHash, tokenSalt);
  const rewards = await seedRedemptionDataset(parentPasswordHash, childPasswordHash, tokenSalt);

  console.log("Seed complete with 3 datasets:");
  console.log("\n[Dataset 1] Task Allocation");
  console.log(`Parent login: ${allocation.parentEmail} / ${allocation.parentPassword}`);
  console.log(`Child logins: ${allocation.childEmails.join(", ")} / ${childPassword}`);
  console.log(`Voice token: ${allocation.voiceToken}`);

  console.log("\n[Dataset 2] Approval Flow");
  console.log(`Parent login: ${approvals.parentEmail} / ${approvals.parentPassword}`);
  console.log(`Child logins: ${approvals.childEmails.join(", ")} / ${childPassword}`);
  console.log(`Voice token: ${approvals.voiceToken}`);

  console.log("\n[Dataset 3] Reward Redemption");
  console.log(`Parent login: ${rewards.parentEmail} / ${rewards.parentPassword}`);
  console.log(`Child logins: ${rewards.childEmails.join(", ")} / ${childPassword}`);
  console.log(`Voice token: ${rewards.voiceToken}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
