import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    webhooks: "src/webhooks.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  treeshake: true,
  target: "es2022",
  outDir: "dist",
  external: [],
});
