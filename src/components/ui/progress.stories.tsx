import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Progress } from "@/components/ui/progress";

const meta = {
  title: "UI/Progress",
  component: Progress,
  args: {
    value: 64,
    label: "Reward progress"
  },
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 }
    }
  },
  parameters: {
    layout: "padded"
  }
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NearlyDone: Story = {
  args: {
    value: 92
  }
};

export const StartingOut: Story = {
  args: {
    value: 14
  }
};
