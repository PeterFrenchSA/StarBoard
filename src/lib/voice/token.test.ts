import { describe, expect, it } from "vitest";
import { hashVoiceToken, parseBearerToken } from "@/lib/voice/token";

describe("voice token helpers", () => {
  it("hashes token deterministically", () => {
    process.env.VOICE_TOKEN_SALT = "test-salt";
    const hashA = hashVoiceToken("abc123");
    const hashB = hashVoiceToken("abc123");
    expect(hashA).toBe(hashB);
  });

  it("parses bearer token", () => {
    expect(parseBearerToken("Bearer token-xyz")).toBe("token-xyz");
    expect(parseBearerToken("Basic nope")).toBeNull();
  });
});
