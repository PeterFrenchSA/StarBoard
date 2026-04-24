import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "@/components/ui/card";

const meta = {
  title: "UI/Card",
  component: Card,
  args: {
    children: "Card content"
  }
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  render: () => (
    <main className="min-h-screen bg-gradient-to-b from-board-bg to-white p-8">
      <div className="mx-auto max-w-lg">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Child Summary</p>
          <h3 className="mt-2 text-2xl font-black text-board-ink">Leia</h3>
          <p className="text-sm text-slate-600">12 tasks completed this week, streak 5 days.</p>
        </Card>
      </div>
    </main>
  )
};

export const Highlighted: Story = {
  render: () => (
    <main className="min-h-screen bg-gradient-to-b from-board-bg to-white p-8">
      <div className="mx-auto max-w-lg">
        <Card className="border-board-mint/50 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-xs uppercase tracking-wide text-slate-500">Reward Status</p>
          <h3 className="mt-2 text-2xl font-black text-board-ink">Zoo Day Badge</h3>
          <p className="text-sm text-slate-600">Ready to redeem now.</p>
        </Card>
      </div>
    </main>
  )
};
