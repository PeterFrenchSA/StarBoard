"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { centsToCurrencyString } from "@/lib/billing/pricing";
import { fetchJson } from "@/lib/fetch-json";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_PARENT" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface ProviderOverview {
  families: Array<{
    id: string;
    name: string;
    billingInterval: "MONTHLY" | "ANNUAL";
    subscriptionStatus: string;
    subscriptionCurrentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    planBaseAmountCents: number;
    includedChildren: number;
    additionalChildAmountCents: number;
    parentCount: number;
    childCount: number;
    openTicketCount: number;
    parents: Array<{ id: string; displayName: string; email: string }>;
  }>;
  tickets: Array<{
    id: string;
    familyId: string;
    family: { id: string; name: string };
    createdBy: { id: string; displayName: string; email: string };
    assignedTo: { id: string; displayName: string; email: string } | null;
    subject: string;
    description: string;
    type: "SUPPORT" | "FEATURE_REQUEST";
    status: TicketStatus;
    priority: TicketPriority;
    category: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      body: string;
      isInternal: boolean;
      createdAt: string;
      author: { id: string; displayName: string; role: string };
    }>;
  }>;
  supportAgents: Array<{
    id: string;
    displayName: string;
    email: string;
  }>;
  stats: {
    familiesCount: number;
    activeSubscriptions: number;
    openTicketsCount: number;
    featureRequestsCount: number;
    estimatedMrrCents: number;
  };
}

function formatStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

interface ProviderDashboardProps {
  adminName: string;
}

export function ProviderDashboard({ adminName }: ProviderDashboardProps) {
  const [data, setData] = useState<ProviderOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOverview = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    setError(null);

    try {
      const overview = await fetchJson<ProviderOverview>("/api/provider/overview");
      setData(overview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load provider dashboard");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview(true);
  }, [loadOverview]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = setTimeout(() => setSuccess(null), 2600);
    return () => clearTimeout(timer);
  }, [success]);

  const activeFamilies = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.families.filter((family) => ["ACTIVE", "TRIALING"].includes(family.subscriptionStatus));
  }, [data]);

  async function handleAction(action: () => Promise<void>, successMessage: string) {
    setSaving(true);
    setError(null);

    try {
      await action();
      await loadOverview(false);
      setSuccess(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardHeader
          title="Provider Operations"
          subtitle={`Welcome, ${adminName}. Loading subscriptions, families, and support queues.`}
        />
        <Card>
          <p className="animate-pulse text-sm text-slate-600">Loading platform overview...</p>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardHeader
          title="Provider Operations"
          subtitle={`Welcome, ${adminName}. Loading subscriptions, families, and support queues.`}
        />
        <Card>
          <p className="text-sm text-red-600">{error ?? "Could not load provider data"}</p>
          <Button className="mt-3" onClick={() => void loadOverview(true)}>
            Retry
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <DashboardHeader
        title="Provider Operations"
        subtitle={`Welcome, ${adminName}. Manage billing health, support operations, and family workspaces.`}
      />

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm justify-end">
        {success ? <Toast message={success} /> : null}
      </div>

      {error ? <Toast message={error} variant="error" className="mb-4" /> : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Families</p>
          <p className="text-2xl font-black">{data.stats.familiesCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Subs</p>
          <p className="text-2xl font-black text-board-mint">{data.stats.activeSubscriptions}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open Tickets</p>
          <p className="text-2xl font-black text-board-coral">{data.stats.openTicketsCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Feature Requests</p>
          <p className="text-2xl font-black text-board-sky">{data.stats.featureRequestsCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Est. MRR</p>
          <p className="text-2xl font-black text-board-sun">{centsToCurrencyString(data.stats.estimatedMrrCents)}</p>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Family Billing Overview</h2>
          <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {data.families.length === 0 ? (
              <p className="text-sm text-slate-500">No families found.</p>
            ) : (
              data.families.map((family) => {
                const additionalChildren = Math.max(0, family.childCount - family.includedChildren);
                const monthlyPrice =
                  family.planBaseAmountCents + additionalChildren * family.additionalChildAmountCents;
                const annualEquivalent = monthlyPrice * 10;

                return (
                  <div key={family.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="font-semibold">{family.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {formatStatus(family.subscriptionStatus)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {family.parentCount} parent(s) • {family.childCount} child(ren) • {family.openTicketCount} open ticket(s)
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Monthly model {centsToCurrencyString(monthlyPrice)} • Annual model {centsToCurrencyString(annualEquivalent)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Primary parents: {family.parents.map((parent) => parent.email).join(", ")}</p>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-[var(--font-display)] text-2xl font-black">Active Subscription Families</h2>
          <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {activeFamilies.length === 0 ? (
              <p className="text-sm text-slate-500">No active subscriptions yet.</p>
            ) : (
              activeFamilies.map((family) => (
                <div key={family.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-semibold">{family.name}</p>
                  <p className="text-xs text-slate-600">
                    {family.billingInterval.toLowerCase()} billing • next period end:{" "}
                    {family.subscriptionCurrentPeriodEnd
                      ? new Date(family.subscriptionCurrentPeriodEnd).toLocaleDateString()
                      : "n/a"}
                  </p>
                  <p className="text-xs text-slate-500">Stripe customer: {family.stripeCustomerId ?? "not linked"}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[var(--font-display)] text-2xl font-black">Support Queue</h2>
            <a
              href="/api/provider/feature-requests/export"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-board-ink hover:bg-slate-50"
            >
              Export Feature Requests CSV
            </a>
          </div>
          <div className="space-y-4">
            {data.tickets.length === 0 ? (
              <p className="text-sm text-slate-500">No support tickets in queue.</p>
            ) : (
              data.tickets.map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-board-sky/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-board-ink">
                      {ticket.family.name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {formatStatus(ticket.status)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        ticket.type === "FEATURE_REQUEST"
                          ? "bg-board-coral/15 text-board-ink"
                          : "bg-board-mint/20 text-board-ink"
                      }`}
                    >
                      {ticket.type === "FEATURE_REQUEST" ? "feature request" : "support"}
                    </span>
                    <span className="rounded-full bg-board-sun/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-board-ink">
                      {ticket.priority.toLowerCase()}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                  <p className="mb-2 text-sm text-slate-600">Opened by {ticket.createdBy.displayName} ({ticket.createdBy.email})</p>

                  <div className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    {ticket.messages.map((message) => (
                      <div key={message.id} className="rounded-xl bg-white p-2 text-sm shadow-sm">
                        <p className="font-semibold text-slate-700">
                          {message.author.displayName}
                          {message.isInternal ? " (internal)" : ""}
                        </p>
                        <p className="text-slate-700">{message.body}</p>
                        <p className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <form
                    className="grid gap-2 md:grid-cols-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);

                      void handleAction(async () => {
                        await fetchJson(`/api/provider/tickets/${ticket.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: formData.get("status"),
                            priority: formData.get("priority"),
                            assignedToId: formData.get("assignedToId") || null
                          })
                        });
                      }, "Ticket updated");
                    }}
                  >
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Status
                      <select
                        name="status"
                        defaultValue={ticket.status}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_ON_PARENT">Waiting On Parent</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Priority
                      <select
                        name="priority"
                        defaultValue={ticket.priority}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Assigned Agent
                      <select
                        name="assignedToId"
                        defaultValue={ticket.assignedTo?.id ?? ""}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {data.supportAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.displayName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="md:col-span-3">
                      <Button type="submit" variant="secondary" loading={saving}>
                        Save Ticket Changes
                      </Button>
                    </div>
                  </form>

                  <form
                    className="mt-3 grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const formData = new FormData(event.currentTarget);

                      void handleAction(async () => {
                        await fetchJson(`/api/provider/tickets/${ticket.id}/messages`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            body: formData.get("body"),
                            isInternal: formData.get("isInternal") === "on"
                          })
                        });
                        form.reset();
                      }, "Reply sent");
                    }}
                  >
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Reply
                      <textarea
                        name="body"
                        rows={3}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-board-mint transition focus:ring-2"
                        placeholder="Send update or request more detail..."
                        required
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input type="checkbox" name="isInternal" className="h-4 w-4" />
                      Internal note (hidden from parent dashboard)
                    </label>
                    <Button type="submit" loading={saving}>
                      Send Reply
                    </Button>
                  </form>
                </article>
              ))
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}
