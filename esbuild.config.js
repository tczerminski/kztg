const { sentryEsbuildPlugin } = require("@sentry/esbuild-plugin");
const esbuild = require("esbuild");
require("dotenv").config({ path: ".env" });

esbuild.build({
  entryPoints: ["js/index.js"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outdir: "dist",
  platform: "browser",
  target: "es2017",
  splitting: true,
  format: "esm",
  plugins: [
    sentryEsbuildPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "kztg",
      project: "javascript",
    }),
  ],
}).catch(() => process.exit(1));

