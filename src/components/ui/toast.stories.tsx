import type { Meta, StoryObj } from "@storybook/nextjs";
import { Toast } from "@/components/ui/toast";

const meta = {
  title: "UI/Toast",
  component: Toast,
  args: {
    message: "Points updated successfully"
  },
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {};

export const Error: Story = {
  args: {
    variant: "error",
    message: "Could not save task changes"
  }
};
