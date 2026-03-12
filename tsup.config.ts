import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["cjs"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  dts: false,
  noExternal: [/.*/],
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
});
