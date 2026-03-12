const NOW = "2026-03-12T09:00:00.000Z";
const TEN_MIN_AGO = "2026-03-12T08:50:00.000Z";
const THIRTY_MIN_AGO = "2026-03-12T08:30:00.000Z";
const NINETY_MIN_AGO = "2026-03-12T07:30:00.000Z";
const YESTERDAY = "2026-03-11T17:00:00.000Z";
const TWO_DAYS_AGO = "2026-03-10T18:20:00.000Z";

export const voiceTokensFixture = [
  {
    id: "voice-token-kitchen",
    label: "Kitchen Nest Hub",
    tokenPreview: "stb_1f9a••••••42de",
    isActive: true,
    lastUsedAt: TEN_MIN_AGO,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: TEN_MIN_AGO
  },
  {
    id: "voice-token-phone",
    label: "Mom iPhone Shortcut",
    tokenPreview: "stb_8be3••••••c19b",
    isActive: true,
    lastUsedAt: NINETY_MIN_AGO,
    createdAt: "2026-02-25T09:10:00.000Z",
    updatedAt: NINETY_MIN_AGO
  },
  {
    id: "voice-token-old",
    label: "Old Office Speaker",
    tokenPreview: "stb_92ab••••••a044",
    isActive: false,
    lastUsedAt: "2026-02-20T15:22:00.000Z",
    createdAt: "2026-02-10T07:45:00.000Z",
    updatedAt: "2026-02-20T15:22:00.000Z"
  }
];

export const parentOverviewFixture = {
  parents: [
    {
      id: "parent-sarah",
      displayName: "Sarah",
      email: "sarah@starboard.local",
      isFamilyOwner: true,
      createdAt: "2026-01-02T08:00:00.000Z"
    },
    {
      id: "parent-john",
      displayName: "John",
      email: "john@starboard.local",
      isFamilyOwner: false,
      createdAt: "2026-01-10T08:00:00.000Z"
    }
  ],
  children: [
    {
      id: "child-leia",
      displayName: "Leia",
      email: "leia@starboard.local",
      points: 420,
      pendingTasks: 2,
      pendingRewards: 1,
      childProfile: {
        avatarEmoji: "🌟",
        currentStreak: 5,
        longestStreak: 9
      }
    },
    {
      id: "child-william",
      displayName: "William",
      email: "william@starboard.local",
      points: 305,
      pendingTasks: 1,
      pendingRewards: 0,
      childProfile: {
        avatarEmoji: "🚀",
        currentStreak: 3,
        longestStreak: 6
      }
    }
  ],
  pendingTaskApprovals: [
    {
      id: "completion-read",
      completedAt: THIRTY_MIN_AGO,
      task: {
        title: "Read for 20 minutes",
        points: 20
      },
      child: {
        displayName: "Leia",
        childProfile: { avatarEmoji: "🌟" }
      }
    },
    {
      id: "completion-room",
      completedAt: TEN_MIN_AGO,
      task: {
        title: "Room tidy-up",
        points: 30
      },
      child: {
        displayName: "William",
        childProfile: { avatarEmoji: "🚀" }
      }
    }
  ],
  pendingRedemptions: [
    {
      id: "redemption-movie-night",
      requestedAt: NINETY_MIN_AGO,
      pointsCost: 120,
      reward: {
        title: "Movie Night Pick",
        iconEmoji: "🎬"
      },
      child: {
        displayName: "Leia",
        childProfile: { avatarEmoji: "🌟" }
      }
    }
  ],
  tasks: [
    {
      id: "task-read-leia",
      assignedChildId: "child-leia",
      title: "Read for 20 minutes",
      description: "Choose any book and read without distractions.",
      points: 20,
      taskType: "RECURRING",
      recurrenceType: "DAILY",
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      deadlineAt: null,
      timerDurationMinutes: null,
      requiresApproval: true,
      isActive: true,
      assignedChild: {
        id: "child-leia",
        displayName: "Leia",
        childProfile: { avatarEmoji: "🌟" }
      }
    },
    {
      id: "task-read-william",
      assignedChildId: "child-william",
      title: "Read for 20 minutes",
      description: "Choose any book and read without distractions.",
      points: 20,
      taskType: "RECURRING",
      recurrenceType: "DAILY",
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      deadlineAt: null,
      timerDurationMinutes: null,
      requiresApproval: true,
      isActive: true,
      assignedChild: {
        id: "child-william",
        displayName: "William",
        childProfile: { avatarEmoji: "🚀" }
      }
    },
    {
      id: "task-room-william",
      assignedChildId: "child-william",
      title: "Room tidy-up",
      description: "Make bed, clear floor, and organize desk.",
      points: 30,
      taskType: "RECURRING",
      recurrenceType: "WEEKDAYS",
      weekdays: [1, 2, 3, 4, 5],
      deadlineAt: "2026-03-12T18:00:00.000Z",
      timerDurationMinutes: 25,
      requiresApproval: true,
      isActive: true,
      assignedChild: {
        id: "child-william",
        displayName: "William",
        childProfile: { avatarEmoji: "🚀" }
      }
    },
    {
      id: "task-math-leia",
      assignedChildId: "child-leia",
      title: "Math sprint worksheet",
      description: "Complete challenge sheet 4 before bedtime.",
      points: 35,
      taskType: "ONE_OFF",
      recurrenceType: "NONE",
      weekdays: [],
      deadlineAt: "2026-03-13T19:00:00.000Z",
      timerDurationMinutes: 30,
      requiresApproval: true,
      isActive: true,
      assignedChild: {
        id: "child-leia",
        displayName: "Leia",
        childProfile: { avatarEmoji: "🌟" }
      }
    }
  ],
  rewards: [
    {
      id: "reward-movie-night",
      title: "Movie Night Pick",
      description: "Choose the Friday family movie.",
      cost: 120,
      iconEmoji: "🎬",
      isActive: true
    },
    {
      id: "reward-zoo",
      title: "Saturday Zoo Trip",
      description: "Family outing to the zoo.",
      cost: 350,
      iconEmoji: "🦁",
      isActive: true
    },
    {
      id: "reward-dessert",
      title: "Dessert Pass",
      description: "Pick tonight's dessert.",
      cost: 80,
      iconEmoji: "🍰",
      isActive: true
    }
  ],
  supportTickets: [
    {
      id: "ticket-sync",
      subject: "Google Home delayed response",
      description: "Voice commands take 10+ seconds to reflect in dashboard.",
      type: "SUPPORT",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      category: "Integrations",
      createdAt: TWO_DAYS_AGO,
      updatedAt: YESTERDAY,
      resolvedAt: null,
      createdBy: {
        id: "parent-sarah",
        displayName: "Sarah",
        role: "PARENT"
      },
      assignedTo: {
        id: "agent-jane",
        displayName: "Jane",
        role: "SUPER_ADMIN"
      },
      messages: [
        {
          id: "ticket-sync-msg1",
          body: "Can you check if there is a known issue with Google Home lag?",
          createdAt: TWO_DAYS_AGO,
          author: {
            id: "parent-sarah",
            displayName: "Sarah",
            role: "PARENT"
          }
        },
        {
          id: "ticket-sync-msg2",
          body: "We are checking webhook retries and will share update shortly.",
          createdAt: YESTERDAY,
          author: {
            id: "agent-jane",
            displayName: "Jane",
            role: "SUPER_ADMIN"
          }
        }
      ]
    },
    {
      id: "ticket-feature",
      subject: "Weekly printable chart",
      description: "Would love a printable PDF of weekly points and streaks.",
      type: "FEATURE_REQUEST",
      status: "OPEN",
      priority: "LOW",
      category: "Reports",
      createdAt: YESTERDAY,
      updatedAt: YESTERDAY,
      resolvedAt: null,
      createdBy: {
        id: "parent-john",
        displayName: "John",
        role: "PARENT"
      },
      assignedTo: null,
      messages: [
        {
          id: "ticket-feature-msg1",
          body: "A printable chart would help when grandparents visit.",
          createdAt: YESTERDAY,
          author: {
            id: "parent-john",
            displayName: "John",
            role: "PARENT"
          }
        }
      ]
    }
  ],
  billing: {
    interval: "MONTHLY",
    status: "ACTIVE",
    billingEmail: "sarah@starboard.local",
    stripeCustomerLinked: true,
    currentPeriodEnd: "2026-04-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    childCount: 2,
    includedChildren: 2,
    additionalChildren: 0,
    monthlyAmountCents: 500,
    annualAmountCents: 5000
  },
  activity: [
    {
      id: "activity-1",
      type: "TASK_COMPLETED",
      message: "Leia submitted Read for 20 minutes",
      createdAt: THIRTY_MIN_AGO,
      actor: { displayName: "Leia" },
      child: { displayName: "Leia" }
    },
    {
      id: "activity-2",
      type: "TASK_COMPLETED",
      message: "William submitted Room tidy-up",
      createdAt: TEN_MIN_AGO,
      actor: { displayName: "William" },
      child: { displayName: "William" }
    },
    {
      id: "activity-3",
      type: "POINTS_ADJUSTED",
      message: "Sarah manually added 10 points to Leia",
      createdAt: "2026-03-12T08:20:00.000Z",
      actor: { displayName: "Sarah" },
      child: { displayName: "Leia" }
    },
    {
      id: "activity-4",
      type: "REWARD_REQUESTED",
      message: "Leia requested Movie Night Pick",
      createdAt: NINETY_MIN_AGO,
      actor: { displayName: "Leia" },
      child: { displayName: "Leia" }
    }
  ],
  stats: {
    childrenCount: 2,
    activeTasksCount: 4,
    totalPositivePointsThisMonth: 760,
    pendingApprovalsCount: 3,
    openSupportTicketsCount: 2
  }
};

export const parentOverviewHeavyApprovalsFixture = {
  ...parentOverviewFixture,
  pendingTaskApprovals: [
    ...parentOverviewFixture.pendingTaskApprovals,
    {
      id: "completion-math",
      completedAt: "2026-03-12T08:05:00.000Z",
      task: {
        title: "Math sprint worksheet",
        points: 35
      },
      child: {
        displayName: "Leia",
        childProfile: { avatarEmoji: "🌟" }
      }
    }
  ],
  pendingRedemptions: [
    ...parentOverviewFixture.pendingRedemptions,
    {
      id: "redemption-dessert",
      requestedAt: "2026-03-12T08:02:00.000Z",
      pointsCost: 80,
      reward: {
        title: "Dessert Pass",
        iconEmoji: "🍰"
      },
      child: {
        displayName: "William",
        childProfile: { avatarEmoji: "🚀" }
      }
    }
  ],
  stats: {
    ...parentOverviewFixture.stats,
    pendingApprovalsCount: 5
  }
};

export const childOverviewFixture = {
  child: {
    id: "child-leia",
    displayName: "Leia",
    childProfile: {
      avatarEmoji: "🌟",
      currentStreak: 5,
      longestStreak: 9
    }
  },
  points: 420,
  badges: [
    { id: "badge-streak-3", label: "3 Day Streak", earned: true },
    { id: "badge-100", label: "First 100 Points", earned: true },
    { id: "badge-reader", label: "Reading Hero", earned: true },
    { id: "badge-7-streak", label: "7 Day Streak", earned: false }
  ],
  tasks: [
    {
      id: "child-task-read",
      title: "Read for 20 minutes",
      description: "Choose any book and read without distractions.",
      points: 20,
      requiresApproval: true,
      deadlineAt: null,
      deadlinePassed: false,
      timerDurationMinutes: null,
      timerActive: false,
      timerExpired: false,
      timerStartedAt: null,
      timerEndsAt: null,
      availableToday: true,
      completedToday: false,
      completed: false,
      completedMessage: null
    },
    {
      id: "child-task-math",
      title: "Math sprint worksheet",
      description: "Complete challenge sheet 4 before bedtime.",
      points: 35,
      requiresApproval: true,
      deadlineAt: "2026-03-12T19:00:00.000Z",
      deadlinePassed: false,
      timerDurationMinutes: 30,
      timerActive: true,
      timerExpired: false,
      timerStartedAt: "2026-03-12T08:45:00.000Z",
      timerEndsAt: "2026-03-12T09:15:00.000Z",
      availableToday: true,
      completedToday: false,
      completed: false,
      completedMessage: null
    },
    {
      id: "child-task-piano",
      title: "Piano practice",
      description: "Complete 15 minutes of scales and one song.",
      points: 18,
      requiresApproval: false,
      deadlineAt: null,
      deadlinePassed: false,
      timerDurationMinutes: null,
      timerActive: false,
      timerExpired: false,
      timerStartedAt: null,
      timerEndsAt: null,
      availableToday: true,
      completedToday: true,
      completed: true,
      completedMessage: "Completed today and points awarded"
    }
  ],
  rewards: [
    {
      id: "child-reward-movie",
      title: "Movie Night Pick",
      description: "Choose Friday family movie.",
      cost: 120,
      iconEmoji: "🎬",
      affordable: true,
      progress: 100
    },
    {
      id: "child-reward-zoo",
      title: "Zoo Trip",
      description: "Family outing to the zoo.",
      cost: 500,
      iconEmoji: "🦁",
      affordable: false,
      progress: 84
    }
  ],
  completions: [
    {
      id: "child-completion-1",
      completedAt: "2026-03-11T18:40:00.000Z",
      status: "APPROVED",
      task: {
        title: "Piano practice"
      }
    },
    {
      id: "child-completion-2",
      completedAt: "2026-03-11T17:30:00.000Z",
      status: "APPROVED",
      task: {
        title: "Homework checklist"
      }
    }
  ],
  pointsHistory: [
    {
      id: "points-1",
      amount: 20,
      note: "Task approved: Read for 20 minutes",
      createdAt: "2026-03-11T19:00:00.000Z",
      actor: { displayName: "Sarah" }
    },
    {
      id: "points-2",
      amount: -80,
      note: "Reward redeemed: Dessert Pass",
      createdAt: "2026-03-10T18:00:00.000Z",
      actor: { displayName: "System" }
    }
  ],
  activity: [
    {
      id: "child-activity-1",
      message: "You earned 20 points for reading.",
      createdAt: "2026-03-11T19:00:00.000Z"
    },
    {
      id: "child-activity-2",
      message: "You requested Movie Night Pick reward.",
      createdAt: "2026-03-11T20:20:00.000Z"
    }
  ]
};

export const childOverviewTimerExpiredFixture = {
  ...childOverviewFixture,
  tasks: childOverviewFixture.tasks.map((task) =>
    task.id !== "child-task-math"
      ? task
      : {
          ...task,
          timerActive: false,
          timerExpired: true,
          timerStartedAt: "2026-03-12T08:00:00.000Z",
          timerEndsAt: "2026-03-12T08:30:00.000Z"
        }
  )
};

export const childOverviewEmptyFixture = {
  ...childOverviewFixture,
  points: 0,
  badges: childOverviewFixture.badges.map((badge) => ({ ...badge, earned: false })),
  tasks: [],
  rewards: [],
  completions: [],
  pointsHistory: [],
  activity: []
};

export const providerOverviewFixture = {
  families: [
    {
      id: "family-skywalkers",
      name: "Skywalkers",
      billingInterval: "MONTHLY",
      subscriptionStatus: "ACTIVE",
      subscriptionCurrentPeriodEnd: "2026-04-01T00:00:00.000Z",
      stripeCustomerId: "cus_starboard_skywalkers",
      planBaseAmountCents: 500,
      includedChildren: 2,
      additionalChildAmountCents: 200,
      parentCount: 2,
      childCount: 2,
      openTicketCount: 1,
      parents: [
        {
          id: "parent-sarah",
          displayName: "Sarah",
          email: "sarah@starboard.local"
        }
      ]
    },
    {
      id: "family-guardians",
      name: "Guardians",
      billingInterval: "ANNUAL",
      subscriptionStatus: "TRIALING",
      subscriptionCurrentPeriodEnd: "2026-03-28T00:00:00.000Z",
      stripeCustomerId: "cus_starboard_guardians",
      planBaseAmountCents: 500,
      includedChildren: 2,
      additionalChildAmountCents: 200,
      parentCount: 1,
      childCount: 4,
      openTicketCount: 2,
      parents: [
        {
          id: "parent-mira",
          displayName: "Mira",
          email: "mira@starboard.local"
        }
      ]
    }
  ],
  tickets: [
    {
      id: "provider-ticket-1",
      familyId: "family-guardians",
      family: {
        id: "family-guardians",
        name: "Guardians"
      },
      createdBy: {
        id: "parent-mira",
        displayName: "Mira",
        email: "mira@starboard.local"
      },
      assignedTo: {
        id: "agent-jane",
        displayName: "Jane",
        email: "jane@starboard.local"
      },
      subject: "Feature request: printable weekly chart",
      description: "Would love a PDF summary of weekly task performance.",
      type: "FEATURE_REQUEST",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      category: "Reports",
      resolvedAt: null,
      createdAt: "2026-03-10T12:00:00.000Z",
      updatedAt: "2026-03-12T08:00:00.000Z",
      messages: [
        {
          id: "provider-ticket-1-msg-1",
          body: "A weekly printable summary would be very useful.",
          isInternal: false,
          createdAt: "2026-03-10T12:00:00.000Z",
          author: {
            id: "parent-mira",
            displayName: "Mira",
            role: "PARENT"
          }
        },
        {
          id: "provider-ticket-1-msg-2",
          body: "Logged as candidate for reporting roadmap.",
          isInternal: true,
          createdAt: "2026-03-11T15:00:00.000Z",
          author: {
            id: "agent-jane",
            displayName: "Jane",
            role: "SUPER_ADMIN"
          }
        }
      ]
    }
  ],
  supportAgents: [
    {
      id: "agent-jane",
      displayName: "Jane",
      email: "jane@starboard.local"
    },
    {
      id: "agent-lee",
      displayName: "Lee",
      email: "lee@starboard.local"
    }
  ],
  stats: {
    familiesCount: 2,
    activeSubscriptions: 1,
    openTicketsCount: 3,
    featureRequestsCount: 2,
    estimatedMrrCents: 1100
  }
};

export const fixtureMeta = {
  generatedAt: NOW
};
