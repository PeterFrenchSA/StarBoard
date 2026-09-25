import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

async function data<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).data as T;
}

test("anonymous routes and voice endpoints require authentication", async ({ request }) => {
  for (const path of ["/api/parent/overview", "/api/child/overview", "/api/provider/overview", "/api/voice/family-summary"]) {
    expect((await request.get(path)).status()).toBe(401);
  }
});

test("family workflows preserve points and permissions under concurrent requests", async ({ browser, baseURL }) => {
  test.skip(process.env.PLAYWRIGHT_ALLOW_MUTATIONS !== "1", "Use a disposable database and set PLAYWRIGHT_ALLOW_MUTATIONS=1");
  test.setTimeout(120_000);
  const tag = randomUUID().slice(0, 8);
  const password = "AuditPass123!";
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext({
    baseURL, extraHTTPHeaders: { Origin: baseURL! }
  })));
  const [parentContext, childContext, siblingContext, outsiderContext, coparentContext] = contexts;
  const parent = parentContext.request;
  const child = childContext.request;
  const outsider = outsiderContext.request;
  const childEmail = `leia-${tag}@example.test`;
  const siblingEmail = `william-${tag}@example.test`;
  const login = (client: APIRequestContext, email: string) => client.post("/api/auth/login", { data: { email, password } });

  try {
    await data(await parent.post("/api/auth/register-parent", { data: {
      familyName: `Audit ${tag}`, parentName: "Audit Parent", email: `parent-${tag}@example.test`, password
    } }));
    await data(await parent.post("/api/parent/onboarding/complete", { data: {
      familyName: `Audit ${tag}`, themePreset: "mint",
      children: [
        { childName: "Leia", email: childEmail, password },
        { childName: "William", email: siblingEmail, password }
      ], tasks: [], rewards: []
    } }));
    await data(await login(child, childEmail));
    await data(await login(siblingContext.request, siblingEmail));
    await data(await outsider.post("/api/auth/register-parent", { data: {
      familyName: `Other ${tag}`, parentName: "Other Parent", email: `other-${tag}@example.test`, password
    } }));

    type Overview = { children: Array<{ id: string; displayName: string }>; activity: Array<{ type: string }> };
    const overview = await data<Overview>(await parent.get("/api/parent/overview"));
    const childId = overview.children.find((row) => row.displayName === "Leia")!.id;
    const siblingId = overview.children.find((row) => row.displayName === "William")!.id;
    expect(JSON.stringify(overview)).not.toContain("passwordHash");
    expect((await child.get("/api/parent/overview")).status()).toBe(403);
    expect((await parent.get("/api/provider/overview")).status()).toBe(403);
    expect((await parent.post("/api/parent/points", {
      headers: { Origin: "https://untrusted.example" }, data: { childId, amount: 10, note: "Rejected origin" }
    })).status()).toBe(403);
    expect((await outsider.post("/api/parent/points", { data: { childId, amount: 10, note: "Other family" } })).status()).toBe(404);

    const points = async () => (await data<{ points: number }>(await child.get("/api/child/overview"))).points;
    const createTask = async (title: string, extra: Record<string, unknown> = {}) => data<{ id: string }>(
      await parent.post("/api/parent/tasks", { data: {
        assignedChildId: childId, title, points: 10, taskType: "RECURRING", recurrenceType: "DAILY",
        requiresApproval: false, ...extra
      } })
    );
    const complete = (taskId: string) => child.post(`/api/child/tasks/${taskId}/complete`, { data: {} });
    const review = (id: string, decision = "APPROVE") => parent.post(`/api/parent/tasks/completions/${id}/review`, { data: { decision } });

    const automatic = await createTask("Make the bed");
    expect((await siblingContext.request.post(`/api/child/tasks/${automatic.id}/complete`, { data: {} })).status()).toBe(404);
    const submissions = await Promise.all([complete(automatic.id), complete(automatic.id)]);
    expect(submissions.map((response) => response.status()).sort()).toEqual([201, 409]);
    expect(await points()).toBe(10);

    const approved = await createTask("Read a chapter", { requiresApproval: true });
    const completion = await data<{ id: string }>(await complete(approved.id));
    expect(await points()).toBe(10);
    expect((await outsider.post(`/api/parent/tasks/completions/${completion.id}/review`, { data: { decision: "APPROVE" } })).status()).toBe(404);
    const approvals = await Promise.all([review(completion.id), review(completion.id)]);
    expect(approvals.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect(await points()).toBe(20);

    const contested = await createTask("Tidy the desk", { requiresApproval: true });
    const contestedCompletion = await data<{ id: string }>(await complete(contested.id));
    const [approve, reject] = await Promise.all([review(contestedCompletion.id), review(contestedCompletion.id, "REJECT")]);
    expect([approve.status(), reject.status()].sort()).toEqual([200, 409]);
    const afterReview = 20 + (approve.status() === 200 ? 10 : 0);
    expect(await points()).toBe(afterReview);

    const multi = await data<{ createdCount: number }>(await parent.post("/api/parent/tasks", { data: {
      assignedChildIds: [childId, siblingId], title: "Family tidy-up", points: 5,
      taskType: "RECURRING", recurrenceType: "WEEKDAYS", weekdays: [1, 2, 3, 4, 5, 6, 7], requiresApproval: true
    } }));
    expect(multi.createdCount).toBe(2);
    const timed = await createTask("Timed practice", { timerDurationMinutes: 5 });
    expect((await complete(timed.id)).status()).toBe(409);
    await data(await child.post(`/api/child/tasks/${timed.id}/start-timer`, { data: {} }));
    await data(await complete(timed.id));
    const expired = await createTask("Expired task");
    await data(await parent.patch(`/api/parent/tasks/${expired.id}`, { data: {
      assignedChildId: childId, title: "Expired task", points: 10, taskType: "ONE_OFF", recurrenceType: "NONE",
      requiresApproval: false, deadlineAt: "2020-01-01T00:00:00Z"
    } }));
    expect((await complete(expired.id)).status()).toBe(409);

    await data(await parent.post("/api/parent/points", { data: { childId, amount: 100 - await points(), note: "Reward test balance" } }));
    const reward = async (title: string) => data<{ id: string }>(await parent.post("/api/parent/rewards", {
      data: { title, cost: 70, iconEmoji: "*" }
    }));
    const firstReward = await reward("Movie night");
    const secondReward = await reward("Choose dessert");
    const requestReward = (id: string) => child.post(`/api/child/rewards/${id}/request`, { data: {} });
    const duplicateRequests = await Promise.all([requestReward(firstReward.id), requestReward(firstReward.id)]);
    expect(duplicateRequests.map((response) => response.status()).sort()).toEqual([201, 409]);
    const firstRedemption = await data<{ id: string }>(duplicateRequests.find((response) => response.status() === 201)!);
    const secondRedemption = await data<{ id: string }>(await requestReward(secondReward.id));
    const redeem = (id: string) => parent.post(`/api/parent/rewards/redemptions/${id}/review`, { data: { decision: "APPROVE" } });
    const redemptions = await Promise.all([redeem(firstRedemption.id), redeem(secondRedemption.id)]);
    expect(redemptions.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect(await points()).toBe(30);

    await data(await parent.post("/api/parent/parents", { data: { parentName: "Co Parent", email: `coparent-${tag}@example.test`, password } }));
    await data(await login(coparentContext.request, `coparent-${tag}@example.test`));
    expect((await data<Overview>(await coparentContext.request.get("/api/parent/overview"))).children).toHaveLength(2);
    expect((await coparentContext.request.post("/api/parent/parents", {
      data: { parentName: "Unauthorized", email: `extra-${tag}@example.test`, password }
    })).status()).toBe(403);

    const token = await data<{ id: string; token: string }>(await parent.post("/api/parent/voice/tokens", { data: { label: "Audit speaker" } }));
    const voiceHeaders = { Authorization: `Bearer ${token.token}` };
    await data(await outsider.post("/api/voice/add-points", { headers: voiceHeaders, data: { childId, amount: 5, note: "Voice reward" } }));
    const voiceTask = await createTask("Voice task");
    const voiceSubmissions = await Promise.all([0, 1].map(() => outsider.post("/api/voice/complete-task", {
      headers: voiceHeaders, data: { childId, taskId: voiceTask.id }
    })));
    expect(voiceSubmissions.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect(await points()).toBe(45);
    expect((await outsider.get(`/api/voice/child-summary?childId=${childId}`, { headers: voiceHeaders })).status()).toBe(200);
    expect((await outsider.get("/api/voice/family-summary", { headers: voiceHeaders })).status()).toBe(200);
    expect((await coparentContext.request.patch(`/api/parent/voice/tokens/${token.id}`, { data: { isActive: false } })).status()).toBe(404);
    await data(await parent.patch(`/api/parent/voice/tokens/${token.id}`, { data: { isActive: false } }));
    expect((await outsider.get("/api/voice/family-summary", { headers: voiceHeaders })).status()).toBe(401);

    const ticket = await data<{ id: string }>(await parent.post("/api/parent/support/tickets", {
      data: { subject: "Feature request", description: "Please add a family calendar", type: "FEATURE_REQUEST" }
    }));
    await data(await parent.post(`/api/parent/support/tickets/${ticket.id}/messages`, { data: { body: "Additional context" } }));
    expect((await outsider.post(`/api/parent/support/tickets/${ticket.id}/messages`, { data: { body: "Not my family" } })).status()).toBe(404);

    if (process.env.PLAYWRIGHT_PROVIDER_EMAIL && process.env.PLAYWRIGHT_PROVIDER_PASSWORD) {
      const providerContext = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } });
      contexts.push(providerContext);
      const provider = providerContext.request;
      await data(await provider.post("/api/auth/login", { data: {
        email: process.env.PLAYWRIGHT_PROVIDER_EMAIL, password: process.env.PLAYWRIGHT_PROVIDER_PASSWORD
      } }));
      expect((await provider.get("/api/provider/overview")).status()).toBe(200);
      await data(await provider.post(`/api/provider/tickets/${ticket.id}/messages`, { data: { body: "Private provider note", isInternal: true } }));
      await data(await provider.patch(`/api/provider/tickets/${ticket.id}`, { data: { status: "RESOLVED" } }));
      const tickets = await parent.get("/api/parent/support/tickets");
      expect(await tickets.text()).not.toContain("Private provider note");
      const exported = await provider.get("/api/provider/feature-requests/export");
      expect(exported.status()).toBe(200);
      expect(await exported.text()).toContain(ticket.id);
    }

    if (process.env.PLAYWRIGHT_WEBHOOK_SECRET) {
      const { familyId } = await data<{ familyId: string }>(await parent.get("/api/auth/me"));
      const payload = JSON.stringify({
        id: `evt_audit_${tag}`, type: "checkout.session.completed",
        data: { object: { id: `cs_audit_${tag}`, metadata: { familyId }, customer: `cus_audit_${tag}`, subscription: `sub_audit_${tag}` } }
      });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.PLAYWRIGHT_WEBHOOK_SECRET });
      const deliver = () => outsider.post("/api/stripe/webhook", {
        headers: { "stripe-signature": signature, "Content-Type": "application/json" }, data: payload
      });
      const events = await Promise.all([deliver(), deliver()]);
      expect(events.map((response) => response.status())).toEqual([200, 200]);
      const billingActivity = (await data<Overview>(await parent.get("/api/parent/overview"))).activity;
      expect(billingActivity.filter((entry) => entry.type === "BILLING_UPDATED")).toHaveLength(1);
      expect((await outsider.post("/api/stripe/webhook", { headers: { "stripe-signature": "invalid" }, data: payload })).status()).toBe(400);
    }
    await data(await child.post("/api/child/theme", { data: { theme: "dragons" } }));
    const activity = (await data<Overview>(await parent.get("/api/parent/overview"))).activity;
    expect(activity.some((entry) => entry.type === "REWARD_APPROVED")).toBe(true);

    const childPage = await childContext.newPage();
    await childPage.setViewportSize({ width: 390, height: 844 });
    await childPage.goto("/child");
    await expect(childPage.getByRole("heading", { name: /My StarBoard/ })).toBeVisible();
    await expect(childPage.getByRole("button", { name: "Dragons theme" })).toHaveAttribute("aria-pressed", "true");
    expect(await childPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const parentPage = await parentContext.newPage();
    await parentPage.goto("/parent");
    await expect(parentPage.getByRole("heading", { name: "Parent Control Center" })).toBeVisible();
    await data(await child.post("/api/auth/logout", { data: {} }));
    expect((await child.get("/api/child/overview")).status()).toBe(401);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
