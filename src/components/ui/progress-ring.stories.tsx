import type { Meta, StoryObj } from "@storybook/nextjs";
import { ProgressRing } from "@/components/ui/progress-ring";

const meta = {
  title: "UI/Progress Ring",
  component: ProgressRing,
  args: {
    value: 58,
    label: "Next Reward",
    subtitle: "Movie Night"
  },
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 }
    },
    size: {
      control: { type: "range", min: 80, max: 220, step: 10 }
    }
  },
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof ProgressRing>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Complete: Story = {
  args: {
    value: 100,
    subtitle: "Ready to redeem"
  }
};
