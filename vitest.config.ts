import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    test: {
      exclude: [
        "**/node_modules/**",
        "**/firebase/functions/lib/**",
      ],
    },
  };
});
