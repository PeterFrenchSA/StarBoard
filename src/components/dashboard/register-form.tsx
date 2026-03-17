"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-md p-7">
      <h1 className="mb-1 font-[var(--font-display)] text-3xl font-black">Start Your StarBoard</h1>
      <p className="mb-6 text-sm text-slate-600">Create your family workspace and parent login.</p>

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setLoading(true);

          const formData = new FormData(event.currentTarget);

          try {
            await fetchJson("/api/auth/register-parent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                familyName: formData.get("familyName"),
                parentName: formData.get("parentName"),
                email: formData.get("email"),
                password: formData.get("password")
              })
            });

            router.replace("/parent");
            router.refresh();
          } catch (registrationError) {
            setError(registrationError instanceof Error ? registrationError.message : "Registration failed");
            setLoading(false);
            return;
          }
        }}
      >
        <Input label="Family name" name="familyName" required />
        <Input label="Parent display name" name="parentName" required />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          required
        />

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <Button className="w-full" loading={loading} type="submit">
          Create Family Workspace
        </Button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already set up? <a href="/login" className="font-semibold text-board-mint">Log in</a>
      </p>
    </Card>
  );
}
