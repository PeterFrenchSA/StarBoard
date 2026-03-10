"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
          });
          router.replace("/login");
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      Logout
    </Button>
  );
}
