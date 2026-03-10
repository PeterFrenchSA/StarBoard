"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-md p-7">
      <h1 className="mb-1 font-[var(--font-display)] text-3xl font-black">Welcome Back</h1>
      <p className="mb-6 text-sm text-slate-600">Log in to your family StarBoard workspace.</p>

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setLoading(true);

          const formData = new FormData(event.currentTarget);

          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.get("email"),
              password: formData.get("password")
            })
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error ?? "Login failed");
            setLoading(false);
            return;
          }

          const role = result.data?.role;
          router.replace(role === "PARENT" ? "/parent" : "/child");
          router.refresh();
        }}
      >
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <Button className="w-full" loading={loading} type="submit">
          Log In
        </Button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        New family? <a href="/register" className="font-semibold text-board-mint">Create a parent account</a>
      </p>
    </Card>
  );
}
