import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "bin/galileii": "bin/galileii.ts",
    "server": "src/server.ts",
  },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
});
