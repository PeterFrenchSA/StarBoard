import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StarBoard",
    short_name: "StarBoard",
    description: "Family stars, chores, streaks, and rewards",
    start_url: "/",
    display: "standalone",
    background_color: "#f5fbff",
    theme_color: "#29c7b8",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml"
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ]
  };
}
