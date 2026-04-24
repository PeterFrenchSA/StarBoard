import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Mark As Done",
    variant: "primary"
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger"]
    },
    onClick: { action: "clicked" }
  },
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Request Reward"
  }
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Open Details"
  }
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "Remove Points"
  }
};

export const Loading: Story = {
  args: {
    loading: true
  }
};

export const Disabled: Story = {
  args: {
    disabled: true
  }
};
