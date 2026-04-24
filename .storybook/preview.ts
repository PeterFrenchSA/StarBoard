import type { Preview } from "@storybook/nextjs-vite";
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
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo"
    }
  }
};

export default preview;
