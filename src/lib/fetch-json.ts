export async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw new Error(`Server error (${response.status}). Please try again.`);
    }

    throw new Error("Unexpected server response");
  }

  let payload: { data?: T; error?: string };

  try {
    payload = (await response.json()) as { data?: T; error?: string };
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }

  return payload.data as T;
}
