import * as esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !isWatch,
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ["src/webview/index.tsx"],
  bundle: true,
  outfile: "dist/webview.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  minify: !isWatch,
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".svg": "dataurl",
  },
  // Resolve @/ path alias to the literal @/ directory created by Tiptap CLI
  alias: {
    "@": path.resolve(__dirname, "@"),
  },
  plugins: [
    sassPlugin({
      type: "css",
      filter: /\.scss$/,
    }),
  ],
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
    // Replace process.env references used by the template with empty strings.
    // Actual values are injected at runtime via window.__SETTINGS__.
    "process.env.TIPTAP_COLLAB_DOC_PREFIX": '""',
    "process.env.TIPTAP_COLLAB_APP_ID": '""',
    "process.env.TIPTAP_COLLAB_TOKEN": '""',
    "process.env.TIPTAP_AI_APP_ID": '"__REPLACED_AT_RUNTIME__"',
    "process.env.TIPTAP_AI_TOKEN": '"__REPLACED_AT_RUNTIME__"',
    "process.env.USE_JWT_TOKEN_API_ENDPOINT": '""',
  },
  // Ensure JSON imports work (for content.json etc.)
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json", ".scss", ".css"],
};

async function build() {
  if (isWatch) {
    const extCtx = await esbuild.context(extensionConfig);
    const webCtx = await esbuild.context(webviewConfig);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log("[watch] Build started — watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log("[build] Extension and webview built successfully.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
