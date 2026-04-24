// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [{
  ignores: [".next/**", "storybook-static/**"]
}, ...nextVitals, ...nextTypescript, {
  rules: {
    "@next/next/no-img-element": "off"
  }
}, ...storybook.configs["flat/recommended"]];

export default config;
