import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProviderDashboard } from "@/components/dashboard/provider-dashboard";
import { providerOverviewFixture } from "@/components/dashboard/storybook/fixtures";
import { MockApiProvider } from "@/components/dashboard/storybook/mock-api";
import { buildProviderDashboardRoutes } from "@/components/dashboard/storybook/mock-routes";

const providerRoutes = buildProviderDashboardRoutes(providerOverviewFixture);

const meta = {
  title: "Dashboards/Provider Dashboard",
  component: ProviderDashboard,
  args: {
    adminName: "Jane Admin"
  },
  parameters: {
    layout: "fullscreen"
  },
  render: (args) => (
    <MockApiProvider routes={providerRoutes}>
      <ProviderDashboard {...args} />
    </MockApiProvider>
  )
} satisfies Meta<typeof ProviderDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
