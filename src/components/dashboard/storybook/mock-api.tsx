"use client";

import { useEffect, type ReactNode } from "react";

type RouteMatcher = string | RegExp;

export interface MockRouteContext {
  body: unknown;
  init?: RequestInit;
  input: RequestInfo | URL;
  method: string;
  url: URL;
}

type MockRouteResponse =
  | Response
  | {
      data?: unknown;
      error?: string;
      headers?: HeadersInit;
      status?: number;
    };

export interface MockRoute {
  method?: string;
  path: RouteMatcher;
  response?: MockRouteResponse;
  resolver?: (context: MockRouteContext) => MockRouteResponse | Promise<MockRouteResponse>;
}

interface MockApiProviderProps {
  children: ReactNode;
  routes: MockRoute[];
}

function routeMatches(pathname: string, matcher: RouteMatcher): boolean {
  if (matcher instanceof RegExp) {
    return matcher.test(pathname);
  }

  return matcher === pathname;
}

async function parseRequestBody(init?: RequestInit): Promise<unknown> {
  if (!init?.body || typeof init.body !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

function toResponse(result: MockRouteResponse): Response {
  if (result instanceof Response) {
    return result;
  }

  const status = result.status ?? (result.error ? 400 : 200);
  const body = result.error ? { error: result.error } : { data: result.data ?? {} };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(result.headers ?? {})
    }
  });
}

function findRoute(routes: MockRoute[], pathname: string, method: string): MockRoute | null {
  for (const route of routes) {
    const routeMethod = (route.method ?? "GET").toUpperCase();
    if (routeMethod !== method) {
      continue;
    }

    if (routeMatches(pathname, route.path)) {
      return route;
    }
  }

  return null;
}

function buildMockFetch(routes: MockRoute[], originalFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const requestUrl =
      input instanceof Request
        ? input.url
        : typeof input === "string"
          ? input
          : input.toString();
    const url = new URL(requestUrl, "http://localhost");
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (!url.pathname.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    const route = findRoute(routes, url.pathname, method);
    if (!route) {
      return toResponse({
        status: 404,
        error: `No Storybook mock route for ${method} ${url.pathname}`
      });
    }

    const context: MockRouteContext = {
      input,
      init,
      method,
      url,
      body: await parseRequestBody(init)
    };

    const resolved = route.resolver ? await route.resolver(context) : route.response ?? { data: {} };
    return toResponse(resolved);
  };
}

export function MockApiProvider({ children, routes }: MockApiProviderProps) {
  useEffect(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = buildMockFetch(routes, originalFetch);

    return () => {
      globalThis.fetch = originalFetch;
    };
  }, [routes]);

  return <>{children}</>;
}
