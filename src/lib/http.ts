import { z } from "zod";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ data }, { status });
}

export async function parseJsonBody<T extends z.ZodTypeAny>(request: Request, schema: T) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Invalid JSON payload", 400) } as const;
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      error: jsonError(parsed.error.issues[0]?.message ?? "Validation failed", 422)
    } as const;
  }

  return { data: parsed.data } as const;
}
