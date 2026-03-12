import {
  ActivityType,
  BillingInterval,
  PointTransactionType,
  PrismaClient,
  RecurrenceType,
  RedemptionStatus,
  Role,
  SubscriptionStatus,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketType,
  TaskCompletionStatus,
  TaskType
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function hashVoiceToken(token: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

function tokenPreview(token: string): string {
  return `${token.slice(0, 6)}...`;
}

async function resetDatabase() {
  await prisma.supportTicketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.billingEvent.deleteMany();
  await prisma.taskTimerSession.deleteMany();
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
  themePreset?: string;
}

async function createFamilyWorkspace(config: FamilySeedConfig, parentPasswordHash: string, tokenSalt: string) {
  const family = await prisma.family.create({
    data: {
      name: config.familyName,
      themePreset: config.themePreset ?? "sun",
      billingEmail: config.parentEmail,
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
      isFamilyOwner: true,
      onboardingCompletedAt: new Date(),
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
      tokenPreview: tokenPreview(config.voiceToken),
      isActive: true,
      createdById: parent.id,
      parentId: parent.id
    }
  });

  return { family, parent };
}

async function createAdditionalParent(input: {
  familyId: string;
  createdById: string;
  parentEmail: string;
  parentName: string;
  parentPasswordHash: string;
}) {
  const parent = await prisma.user.create({
    data: {
      familyId: input.familyId,
      role: Role.PARENT,
      email: input.parentEmail,
      passwordHash: input.parentPasswordHash,
      displayName: input.parentName,
      isFamilyOwner: false,
      onboardingCompletedAt: new Date()
    }
  });

  await prisma.activityLog.create({
    data: {
      familyId: input.familyId,
      actorId: input.createdById,
      type: ActivityType.PARENT_ADDED,
      message: `Additional parent account created for ${input.parentName}`,
      metadata: { parentId: parent.id, seeded: true }
    }
  });

  return parent;
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

async function createSupportTicket(input: {
  familyId: string;
  parentId: string;
  subject: string;
  description: string;
  priority?: SupportTicketPriority;
  type?: SupportTicketType;
}) {
  return prisma.supportTicket.create({
    data: {
      familyId: input.familyId,
      createdById: input.parentId,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? SupportTicketPriority.NORMAL,
      type: input.type ?? SupportTicketType.SUPPORT,
      status: SupportTicketStatus.OPEN,
      messages: {
        create: {
          authorId: input.parentId,
          body: input.description
        }
      }
    }
  });
}

async function seedPlatformAdmin(superAdminPasswordHash: string) {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? "admin@starboard.local";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "AdminPass123!";

  const platformFamily = await prisma.family.create({
    data: {
      name: "StarBoard Platform",
      billingEmail: "platform@starboard.local",
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.MONTHLY
    }
  });

  const superAdmin = await prisma.user.create({
    data: {
      familyId: platformFamily.id,
      role: Role.SUPER_ADMIN,
      email: superAdminEmail,
      passwordHash: superAdminPasswordHash,
      displayName: "StarBoard Admin",
      isSupportAgent: true,
      isFamilyOwner: false
    }
  });

  await prisma.activityLog.create({
    data: {
      familyId: platformFamily.id,
      actorId: superAdmin.id,
      type: ActivityType.USER_CREATED,
      message: "Seeded super admin account for platform operations",
      metadata: { seeded: true }
    }
  });

  return { superAdminEmail, superAdminPassword };
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
      voiceLabel: "Allocation Assistant",
      themePreset: "sun"
    },
    parentPasswordHash,
    tokenSalt
  );

  const coParentEmail = "coparent@starboard.local";
  const coParent = await createAdditionalParent({
    familyId: family.id,
    createdById: parent.id,
    parentEmail: coParentEmail,
    parentName: "Co-Parent Allocation",
    parentPasswordHash
  });

  const coParentVoiceToken = `starboard-voice-${randomBytes(4).toString("hex")}`;
  await prisma.voiceApiToken.create({
    data: {
      familyId: family.id,
      label: "Co-parent Assistant",
      tokenHash: hashVoiceToken(coParentVoiceToken, tokenSalt),
      tokenPreview: tokenPreview(coParentVoiceToken),
      isActive: true,
      createdById: coParent.id,
      parentId: coParent.id
    }
  });

  const leia = await createChild(family.id, childPasswordHash, {
    email: "leia@starboard.local",
    displayName: "Leia",
    avatarEmoji: "🌟",
    colorTheme: "fairies",
    currentStreak: 2,
    longestStreak: 4
  });

  const william = await createChild(family.id, childPasswordHash, {
    email: "william@starboard.local",
    displayName: "William",
    avatarEmoji: "🚀",
    colorTheme: "dragons",
    currentStreak: 1,
    longestStreak: 3
  });

  const readDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

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
        deadlineAt: readDeadline,
        requiresApproval: true
      },
      {
        familyId: family.id,
        createdById: coParent.id,
        assignedChildId: william.id,
        title: "Room tidy-up",
        description: "Tidy room before dinner on weekdays.",
        points: 10,
        taskType: TaskType.RECURRING,
        recurrenceType: RecurrenceType.WEEKDAYS,
        weekdays: [1, 2, 3, 4, 5],
        timerDurationMinutes: 20,
        requiresApproval: true
      },
      {
        familyId: family.id,
        createdById: coParent.id,
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
        createdById: coParent.id,
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
        actorId: coParent.id,
        type: PointTransactionType.MANUAL_ADD,
        amount: 18,
        note: "Starter points for testing",
        referenceType: "SEED"
      }
    ]
  });

  await prisma.family.update({
    where: { id: family.id },
    data: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.MONTHLY,
      stripeCustomerId: `cus_seed_${randomBytes(6).toString("hex")}`,
      stripeSubscriptionId: `sub_seed_${randomBytes(6).toString("hex")}`,
      billingUpdatedAt: new Date(),
      subscriptionCurrentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    }
  });

  const supportTicket = await createSupportTicket({
    familyId: family.id,
    parentId: coParent.id,
    subject: "Need help connecting Google Home",
    description: "Voice points command is not triggering from the kitchen speaker.",
    priority: SupportTicketPriority.HIGH
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
        actorId: coParent.id,
        childId: william.id,
        type: ActivityType.TASK_CREATED,
        message: "Created task set for allocation testing (William)"
      },
      {
        familyId: family.id,
        actorId: parent.id,
        type: ActivityType.SUPPORT_TICKET_CREATED,
        message: `Support ticket opened: ${supportTicket.subject}`,
        metadata: {
          ticketId: supportTicket.id
        }
      }
    ]
  });

  return {
    parentEmail,
    parentPassword,
    coParentEmail,
    childEmails: ["leia@starboard.local", "william@starboard.local"],
    voiceToken,
    coParentVoiceToken
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
      voiceLabel: "Approval Assistant",
      themePreset: "mint"
    },
    parentPasswordHash,
    tokenSalt
  );

  const asha = await createChild(family.id, childPasswordHash, {
    email: "asha@starboard.local",
    displayName: "Asha",
    avatarEmoji: "🧩",
    colorTheme: "ninjas",
    currentStreak: 3,
    longestStreak: 6
  });

  const noah = await createChild(family.id, childPasswordHash, {
    email: "noah@starboard.local",
    displayName: "Noah",
    avatarEmoji: "🛹",
    colorTheme: "engineering",
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
      timerDurationMinutes: 15,
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

  await createSupportTicket({
    familyId: family.id,
    parentId: parent.id,
    subject: "Billing question for annual plan",
    description: "Can I switch this family to annual billing and keep all existing data?",
    priority: SupportTicketPriority.NORMAL
  });

  await prisma.family.update({
    where: { id: family.id },
    data: {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      billingInterval: BillingInterval.MONTHLY,
      stripeCustomerId: `cus_seed_${randomBytes(6).toString("hex")}`,
      stripeSubscriptionId: `sub_seed_${randomBytes(6).toString("hex")}`,
      billingUpdatedAt: new Date()
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
      voiceLabel: "Rewards Assistant",
      themePreset: "sky"
    },
    parentPasswordHash,
    tokenSalt
  );

  const mia = await createChild(family.id, childPasswordHash, {
    email: "mia@starboard.local",
    displayName: "Mia",
    avatarEmoji: "🎨",
    colorTheme: "fairies",
    currentStreak: 4,
    longestStreak: 8
  });

  const liam = await createChild(family.id, childPasswordHash, {
    email: "liam@starboard.local",
    displayName: "Liam",
    avatarEmoji: "⚽",
    colorTheme: "dragons",
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

  await createSupportTicket({
    familyId: family.id,
    parentId: parent.id,
    subject: "Siri shortcut payload format",
    description: "Please share the expected JSON payload to request a reward over Siri.",
    priority: SupportTicketPriority.LOW,
    type: SupportTicketType.FEATURE_REQUEST
  });

  await prisma.family.update({
    where: { id: family.id },
    data: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.ANNUAL,
      stripeCustomerId: `cus_seed_${randomBytes(6).toString("hex")}`,
      stripeSubscriptionId: `sub_seed_${randomBytes(6).toString("hex")}`,
      billingUpdatedAt: new Date(),
      subscriptionCurrentPeriodEnd: new Date(Date.now() + 280 * 24 * 60 * 60 * 1000)
    }
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
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "AdminPass123!";
  const tokenSalt = process.env.VOICE_TOKEN_SALT ?? "change-me-too";

  await resetDatabase();

  const parentPasswordHash = await bcrypt.hash(parentPassword, 12);
  const childPasswordHash = await bcrypt.hash(childPassword, 12);
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 12);

  const platform = await seedPlatformAdmin(superAdminPasswordHash);
  const allocation = await seedTaskAllocationDataset(parentPasswordHash, childPasswordHash, tokenSalt);
  const approvals = await seedApprovalDataset(parentPasswordHash, childPasswordHash, tokenSalt);
  const rewards = await seedRedemptionDataset(parentPasswordHash, childPasswordHash, tokenSalt);

  console.log("Seed complete with 3 family datasets plus platform admin:");

  console.log("\n[Platform Admin]");
  console.log(`Admin login: ${platform.superAdminEmail} / ${platform.superAdminPassword}`);

  console.log("\n[Dataset 1] Task Allocation");
  console.log(`Parent login: ${allocation.parentEmail} / ${allocation.parentPassword}`);
  console.log(`Co-parent login: ${allocation.coParentEmail} / ${allocation.parentPassword}`);
  console.log(`Child logins: ${allocation.childEmails.join(", ")} / ${childPassword}`);
  console.log(`Voice tokens: ${allocation.voiceToken}, ${allocation.coParentVoiceToken}`);

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
