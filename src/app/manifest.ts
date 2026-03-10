import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StarBoard",
    short_name: "StarBoard",
    description: "Family stars, chores, streaks, and rewards",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#f5fbff",
    theme_color: "#29c7b8",
    orientation: "portrait",
    lang: "en-US",
    categories: ["family", "education", "productivity"],
    shortcuts: [
      {
        name: "Parent Dashboard",
        short_name: "Parent",
        url: "/parent"
      },
      {
        name: "Child Dashboard",
        short_name: "Child",
        url: "/child"
      }
    ],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      }
    ],
    prefer_related_applications: false
  };
}
