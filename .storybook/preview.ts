import type { Preview } from "@storybook/nextjs";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    nextjs: {
      // Required for components using next/navigation hooks (App Router).
      appDirectory: true,
      navigation: {
        pathname: "/",
        query: {}
      },
      router: {
        pathname: "/",
        query: {}
      }
    }
  }
};

export default preview;
