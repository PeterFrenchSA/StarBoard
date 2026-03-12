import type { Meta, StoryObj } from "@storybook/nextjs";
import { ChildDashboard } from "@/components/dashboard/child-dashboard";
import { type ChildThemeValue } from "@/lib/themes/child-themes";
import {
  childOverviewEmptyFixture,
  childOverviewFixture,
  childOverviewTimerExpiredFixture
} from "@/components/dashboard/storybook/fixtures";
import { MockApiProvider } from "@/components/dashboard/storybook/mock-api";
import { buildChildDashboardRoutes } from "@/components/dashboard/storybook/mock-routes";

function withTheme(theme: ChildThemeValue) {
  return {
    ...childOverviewFixture,
    child: {
      ...childOverviewFixture.child,
      childProfile: childOverviewFixture.child.childProfile
        ? {
            ...childOverviewFixture.child.childProfile,
            colorTheme: theme
          }
        : null
    }
  };
}

const defaultRoutes = buildChildDashboardRoutes(childOverviewFixture);
const timerExpiredRoutes = buildChildDashboardRoutes(childOverviewTimerExpiredFixture);
const emptyStateRoutes = buildChildDashboardRoutes(childOverviewEmptyFixture);
const dragonsRoutes = buildChildDashboardRoutes(withTheme("dragons"));
const ninjasRoutes = buildChildDashboardRoutes(withTheme("ninjas"));
const engineeringRoutes = buildChildDashboardRoutes(withTheme("engineering"));

const meta = {
  title: "Dashboards/Child Dashboard",
  component: ChildDashboard,
  args: {
    childName: "Leia"
  },
  parameters: {
    layout: "fullscreen"
  },
  render: (args) => (
    <MockApiProvider routes={defaultRoutes}>
      <ChildDashboard {...args} />
    </MockApiProvider>
  )
} satisfies Meta<typeof ChildDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TimerExpiredState: Story = {
  render: (args) => (
    <MockApiProvider routes={timerExpiredRoutes}>
      <ChildDashboard {...args} />
    </MockApiProvider>
  )
};

export const EmptyState: Story = {
  render: (args) => (
    <MockApiProvider routes={emptyStateRoutes}>
      <ChildDashboard {...args} />
    </MockApiProvider>
  )
};

export const DragonsTheme: Story = {
  render: (args) => (
    <MockApiProvider routes={dragonsRoutes}>
      <ChildDashboard {...args} />
    </MockApiProvider>
  )
};

export const NinjasTheme: Story = {
  render: (args) => (
    <MockApiProvider routes={ninjasRoutes}>
      <ChildDashboard {...args} />
    </MockApiProvider>
  )
};

export const EngineeringTheme: Story = {
  render: (args) => (
    <MockApiProvider routes={engineeringRoutes}>
      <ChildDashboard {...args} />
    </MockApiProvider>
  )
};
