import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const sharedConfig = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: !isWatch,
  sourcemap: true,
  target: ["es2020"],
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
  },
};

// UMD/IIFE build for <script> tag
await esbuild.build({
  ...sharedConfig,
  outfile: "dist/guidesforge-sdk.js",
  format: "iife",
  globalName: "GuidesForge",
});

// ESM build for bundlers
await esbuild.build({
  ...sharedConfig,
  outfile: "dist/guidesforge-sdk.esm.js",
  format: "esm",
});

console.log("SDK built successfully");
