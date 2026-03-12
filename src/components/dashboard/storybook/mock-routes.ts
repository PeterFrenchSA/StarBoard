import type { MockRoute } from "@/components/dashboard/storybook/mock-api";
import {
  childOverviewFixture,
  parentOverviewFixture,
  providerOverviewFixture,
  voiceTokensFixture
} from "@/components/dashboard/storybook/fixtures";

function parseResourceId(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "unknown";
}

export function buildParentDashboardRoutes(
  overview: unknown = parentOverviewFixture,
  voiceTokens: unknown = voiceTokensFixture
): MockRoute[] {
  return [
    { method: "GET", path: "/api/parent/overview", response: { data: overview } },
    { method: "GET", path: "/api/parent/voice/tokens", response: { data: voiceTokens } },
    {
      method: "POST",
      path: "/api/parent/voice/tokens",
      resolver: ({ body }) => ({
        data: {
          id: `voice-token-${Date.now()}`,
          label:
            typeof body === "object" && body && "label" in body && typeof body.label === "string"
              ? body.label
              : "New Voice Token",
          tokenPreview: "stb_new••••••mock",
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          token: "stb_mock_storybook_token_123456"
        }
      })
    },
    {
      method: "PATCH",
      path: /\/api\/parent\/voice\/tokens\/[^/]+$/,
      resolver: ({ url }) => ({
        data: { id: parseResourceId(url.pathname), updated: true }
      })
    },
    { method: "POST", path: "/api/parent/points", response: { data: { ok: true } } },
    { method: "POST", path: "/api/parent/tasks", response: { data: { createdCount: 1 } } },
    {
      method: "PATCH",
      path: /\/api\/parent\/tasks\/[^/]+$/,
      response: { data: { updated: true } }
    },
    {
      method: "POST",
      path: /\/api\/parent\/tasks\/completions\/[^/]+\/review$/,
      response: { data: { reviewed: true } }
    },
    { method: "POST", path: "/api/parent/rewards", response: { data: { ok: true } } },
    {
      method: "PATCH",
      path: /\/api\/parent\/rewards\/[^/]+$/,
      response: { data: { updated: true } }
    },
    {
      method: "POST",
      path: /\/api\/parent\/rewards\/redemptions\/[^/]+\/review$/,
      response: { data: { reviewed: true } }
    },
    { method: "POST", path: "/api/parent/support/tickets", response: { data: { id: "new-ticket" } } },
    {
      method: "POST",
      path: /\/api\/parent\/support\/tickets\/[^/]+\/messages$/,
      response: { data: { id: "new-message" } }
    },
    { method: "POST", path: "/api/parent/parents", response: { data: { id: "new-parent" } } },
    { method: "POST", path: "/api/parent/children", response: { data: { id: "new-child" } } },
    { method: "POST", path: "/api/billing/checkout-session", response: { data: { url: null } } },
    {
      method: "POST",
      path: "/api/billing/portal-session",
      response: { data: { url: "https://billing.stripe.com/session/test" } }
    },
    { method: "POST", path: "/api/auth/logout", response: { data: { ok: true } } }
  ];
}

export function buildChildDashboardRoutes(overview: unknown = childOverviewFixture): MockRoute[] {
  return [
    { method: "GET", path: "/api/child/overview", response: { data: overview } },
    {
      method: "POST",
      path: /\/api\/child\/tasks\/[^/]+\/start-timer$/,
      response: { data: { started: true } }
    },
    {
      method: "POST",
      path: /\/api\/child\/tasks\/[^/]+\/complete$/,
      response: { data: { submitted: true } }
    },
    {
      method: "POST",
      path: /\/api\/child\/rewards\/[^/]+\/request$/,
      response: { data: { requested: true } }
    },
    { method: "POST", path: "/api/auth/logout", response: { data: { ok: true } } }
  ];
}

export function buildProviderDashboardRoutes(overview: unknown = providerOverviewFixture): MockRoute[] {
  return [
    { method: "GET", path: "/api/provider/overview", response: { data: overview } },
    {
      method: "PATCH",
      path: /\/api\/provider\/tickets\/[^/]+$/,
      response: { data: { updated: true } }
    },
    {
      method: "POST",
      path: /\/api\/provider\/tickets\/[^/]+\/messages$/,
      response: { data: { posted: true } }
    },
    {
      method: "GET",
      path: "/api/provider/feature-requests/export",
      response: {
        status: 200,
        headers: { "Content-Type": "text/csv" },
        data: "id,subject\nfeature-1,Printable weekly chart"
      }
    },
    { method: "POST", path: "/api/auth/logout", response: { data: { ok: true } } }
  ];
}
