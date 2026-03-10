"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function ServiceWorkerRegister() {
  const [installEvent, setInstallEvent] = useState<DeferredInstallPrompt | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }

    const handler = (event: Event) => {
      if (window.localStorage.getItem("starboard-install-dismissed") === "1") {
        return;
      }
      event.preventDefault();
      setInstallEvent(event as DeferredInstallPrompt);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!installEvent) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lift sm:left-auto sm:max-w-xs">
      <p className="mb-2 text-sm font-medium">Install StarBoard for quick access</p>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            await installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
          }}
        >
          Install App
        </Button>
        <Button
          variant="ghost"
          className="px-3"
          onClick={() => {
            window.localStorage.setItem("starboard-install-dismissed", "1");
            setInstallEvent(null);
          }}
        >
          Later
        </Button>
      </div>
    </div>
  );
}
