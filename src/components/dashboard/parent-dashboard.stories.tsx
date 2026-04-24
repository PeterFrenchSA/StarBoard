import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import {
  parentOverviewFixture,
  parentOverviewHeavyApprovalsFixture,
  voiceTokensFixture
} from "@/components/dashboard/storybook/fixtures";
import { MockApiProvider } from "@/components/dashboard/storybook/mock-api";
import { buildParentDashboardRoutes } from "@/components/dashboard/storybook/mock-routes";

const mainRoutes = buildParentDashboardRoutes(parentOverviewFixture, voiceTokensFixture);
const approvalsHeavyRoutes = buildParentDashboardRoutes(parentOverviewHeavyApprovalsFixture, voiceTokensFixture);

const meta = {
  title: "Dashboards/Parent Dashboard",
  component: ParentDashboard,
  args: {
    parentName: "Sarah",
    mode: "main"
  },
  parameters: {
    layout: "fullscreen"
  },
  render: (args) => (
    <MockApiProvider routes={mainRoutes}>
      <ParentDashboard {...args} />
    </MockApiProvider>
  )
} satisfies Meta<typeof ParentDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MainOverview: Story = {};

export const ApprovalsQueue: Story = {
  args: {
    mode: "approvals"
  },
  render: (args) => (
    <MockApiProvider routes={approvalsHeavyRoutes}>
      <ParentDashboard {...args} />
    </MockApiProvider>
  )
};

export const BillingWorkspace: Story = {
  args: {
    mode: "billing"
  }
};

export const IntegrationsWorkspace: Story = {
  args: {
    mode: "integrations"
  }
};

export const SupportWorkspace: Story = {
  args: {
    mode: "support"
  }
};

export const AdminWorkspace: Story = {
  args: {
    mode: "admin"
  }
};
