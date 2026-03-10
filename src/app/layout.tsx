import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "StarBoard",
  description: "Family star chart and rewards app",
  applicationName: "StarBoard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StarBoard"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml" },
      { url: "/icons/icon-maskable.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#29c7b8",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-[var(--font-body)] text-board-ink antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
