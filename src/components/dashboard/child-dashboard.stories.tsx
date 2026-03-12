import type { Meta, StoryObj } from "@storybook/nextjs";
import { ChildDashboard } from "@/components/dashboard/child-dashboard";
import {
  childOverviewEmptyFixture,
  childOverviewFixture,
  childOverviewTimerExpiredFixture
} from "@/components/dashboard/storybook/fixtures";
import { MockApiProvider } from "@/components/dashboard/storybook/mock-api";
import { buildChildDashboardRoutes } from "@/components/dashboard/storybook/mock-routes";

const defaultRoutes = buildChildDashboardRoutes(childOverviewFixture);
const timerExpiredRoutes = buildChildDashboardRoutes(childOverviewTimerExpiredFixture);
const emptyStateRoutes = buildChildDashboardRoutes(childOverviewEmptyFixture);

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
