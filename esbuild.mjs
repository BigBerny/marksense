import * as esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import fs from "fs";
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
  external: ["@typewise/autocorrect-predictions-sdk"],
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
    "process.env.USE_JWT_TOKEN_API_ENDPOINT": '""',
  },
  // Ensure JSON imports work (for content.json etc.)
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json", ".scss", ".css"],
};

// ── Copy Typewise SDK assets to dist/typewise-sdk/ ─────────────────────────
// The SDK needs WASM, Web Workers, and language resource files served as
// static assets.  Resource files live in an external directory with
// versioned subdirectories (set TYPEWISE_MODELS_DIR or place at
// ../superhumanmodels).  The build scans all versions, picks the latest
// copy of each file, and only copies resources for the target languages.

const SDK_PKG = path.resolve(
  __dirname,
  "node_modules/@typewise/autocorrect-predictions-sdk"
);

const TARGET_LANGUAGES = ["en", "de"];

const EN_PREDICTION_MODEL = "l=en-c=traineddemo-st_d=2048-ep=50-lr=0.0003-fin_lr=0.0000_len_1000_at_v1.1_newline_in_vocab_single_ckpt";

function copyFileSync(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirSync(src, dest, { exclude } = {}) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude?.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, { exclude });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyModelDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const configSrc = path.join(src, "config.json");
  if (fs.existsSync(configSrc)) {
    fs.copyFileSync(configSrc, path.join(dest, "config.json"));
  }
  const tfliteSrc = path.join(src, "checkpoint", "model.tf_lite");
  if (fs.existsSync(tfliteSrc)) {
    const ckptDest = path.join(dest, "checkpoint");
    fs.mkdirSync(ckptDest, { recursive: true });
    fs.copyFileSync(tfliteSrc, path.join(ckptDest, "model.tf_lite"));
  }
}

function resolveModelsDir() {
  if (process.env.TYPEWISE_MODELS_DIR) {
    const dir = path.resolve(process.env.TYPEWISE_MODELS_DIR);
    if (fs.existsSync(dir)) return dir;
    console.warn(`[build] TYPEWISE_MODELS_DIR=${dir} does not exist`);
  }
  const sibling = path.resolve(__dirname, "..", "superhumanmodels");
  if (fs.existsSync(sibling)) return sibling;
  return null;
}

function resolveModelsHubDir() {
  if (process.env.TYPEWISE_MODELS_HUB_DIR) {
    const dir = path.resolve(process.env.TYPEWISE_MODELS_HUB_DIR);
    if (fs.existsSync(dir)) return dir;
    console.warn(`[build] TYPEWISE_MODELS_HUB_DIR=${dir} does not exist`);
  }
  const sibling = path.resolve(__dirname, "..", "typewise-alllanguagesinternal-files/models_hub");
  if (fs.existsSync(sibling)) return sibling;
  return null;
}

/** Check whether a resource name is needed for TARGET_LANGUAGES. */
function isRelevantResource(name) {
  const GLOBAL = [
    "company_config.json",
    "global_library_settings.json",
    "language_modelling_settings.json",
  ];
  if (GLOBAL.includes(name)) return true;
  if (name.includes("charvocab")) return true;
  if (name.startsWith("l=all_")) return true;

  // Prediction model directories (l=en-c=superhuman-...) are large and
  // handled separately via language_modelling_settings.json (step 3).
  if (/^l=\w+-c=/.test(name)) return false;

  for (const lang of TARGET_LANGUAGES) {
    if (name === `typewise_db_${lang}.db`) return true;
    if (name === `main_dictionary_${lang}.bin`) return true;
    if (name === `additional_wordlist_${lang}.bin`) return true;
    if (new RegExp(`^v[\\d.]+_API_${lang}$`).test(name)) return true;         // model dir
    if (new RegExp(`^v[\\d.]+_API_${lang}\\.json$`).test(name)) return true;   // normalizer
    if (new RegExp(`^v[\\d.]+_API_${lang}\\.normalizer\\.json$`).test(name)) return true;
    if (name.startsWith(`l=${lang}_`) || name.startsWith(`l=${lang}-`)) return true;
  }
  return false;
}

function copyTypewiseSdkAssets() {
  const dest = path.resolve(__dirname, "dist/typewise-sdk");

  // 1. SDK bundle + WASM + Workers from node_modules
  copyFileSync(path.join(SDK_PKG, "dist/typewise.js"), path.join(dest, "typewise.js"));
  copyFileSync(path.join(SDK_PKG, "dist/sql-wasm.wasm"), path.join(dest, "sql-wasm.wasm"));
  copyDirSync(path.join(SDK_PKG, "dist/onnx-1.18.0"), path.join(dest, "onnx-1.18.0"), { exclude: ["ort.min.js.map"] });
  copyFileSync(path.join(SDK_PKG, "tf-js-web-worker-autocorrection.js"), path.join(dest, "tf-js-web-worker-autocorrection.js"));
  copyFileSync(path.join(SDK_PKG, "tf-js-web-worker-predictions.js"), path.join(dest, "tf-js-web-worker-predictions.js"));
  console.log("[build] Typewise SDK static assets copied");

  // 2. Resource files from external models directory
  const modelsDir = resolveModelsDir();
  if (!modelsDir) {
    console.warn(
      "[build] No models directory found — SDK resources not copied.\n" +
      "        Set TYPEWISE_MODELS_DIR or place models at ../superhumanmodels"
    );
    return;
  }

  // Collect version directories sorted newest → oldest
  const versionDirs = fs
    .readdirSync(modelsDir)
    .filter((d) => /^\d+\.\d+\.\d+$/.test(d) && fs.statSync(path.join(modelsDir, d)).isDirectory())
    .sort((a, b) => {
      const va = a.split(".").map(Number);
      const vb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if (va[i] !== vb[i]) return vb[i] - va[i];
      }
      return 0;
    });

  // Scan all versions newest-first; first occurrence of each resource wins.
  const resourcesDest = path.join(dest, "resources");
  /** @type {Set<string>} already-copied resource names */
  const seen = new Set();
  let copied = 0;

  for (const ver of versionDirs) {
    const resDir = path.join(modelsDir, ver, "resources");
    if (!fs.existsSync(resDir)) continue;

    for (const entry of fs.readdirSync(resDir, { withFileTypes: true })) {
      if (seen.has(entry.name)) continue;
      if (!isRelevantResource(entry.name)) continue;

      const src = path.join(resDir, entry.name);
      const dst = path.join(resourcesDest, entry.name);

      if (entry.isDirectory()) {
        copyDirSync(src, dst);
      } else {
        copyFileSync(src, dst);
      }
      seen.add(entry.name);
      copied++;
    }
  }

  console.log(
    `[build] Typewise resources: ${copied} files/dirs copied ` +
    `for [${TARGET_LANGUAGES.join(", ")}] from ${modelsDir}`
  );

  // 3a. Patch company_config.json: enable predictions for all target
  //     languages.  The upstream config only enables predictions for "en";
  //     our code falls back to the English model for other languages so the
  //     SDK must not short-circuit before we get a chance to call it.
  const ccPath = path.join(resourcesDest, "company_config.json");
  if (fs.existsSync(ccPath)) {
    try {
      const cc = JSON.parse(fs.readFileSync(ccPath, "utf-8"));
      let ccPatched = false;
      for (const lang of TARGET_LANGUAGES) {
        if (cc.languages?.[lang] && !cc.languages[lang].prediction?.enabled) {
          cc.languages[lang].prediction = { enabled: true };
          ccPatched = true;
        }
      }
      if (ccPatched) {
        fs.writeFileSync(ccPath, JSON.stringify(cc, null, 2) + "\n");
        console.log("[build]   ~ patched company_config.json (enabled predictions for all target languages)");
      }
    } catch { /* best-effort */ }
  }

  // 3b. Patch language_modelling_settings.json: set the English prediction
  //     model to the TFLite model, remove non-English prediction entries
  //     (they fall back to the API), and add missing SDK fields.
  const lmsPath = path.join(resourcesDest, "language_modelling_settings.json");
  if (fs.existsSync(lmsPath)) {
    try {
      const lms = JSON.parse(fs.readFileSync(lmsPath, "utf-8"));

      if (lms.use_unknown_in_language_detection === undefined) {
        lms.use_unknown_in_language_detection = true;
      }

      // Set English prediction model to the TFLite model
      if (lms.lang_to_model_names) {
        lms.lang_to_model_names.en = {
          word_completion_model_name: EN_PREDICTION_MODEL,
          sentence_completion_model_name: EN_PREDICTION_MODEL,
          sentence_completion_combination_model_settings: {
            model_name_to_inference_technique: {
              [EN_PREDICTION_MODEL]: "beam-search-k5-ll_sum-beamscore-filtnotwordlst"
            }
          }
        };

        // Remove non-English prediction entries — other languages fall back
        // to the API.  The SDK still autocorrects via v*_API_xx models and
        // dictionaries.
        for (const lang of Object.keys(lms.lang_to_model_names)) {
          if (lang === "en") continue;
          delete lms.lang_to_model_names[lang];
        }
      }

      fs.writeFileSync(lmsPath, JSON.stringify(lms, null, 2) + "\n");
      console.log("[build]   ~ patched language_modelling_settings.json (en prediction -> TFLite model)");
    } catch { /* best-effort */ }
  }

  // 4. Copy prediction model directories referenced by
  //    language_modelling_settings.json (only for TARGET_LANGUAGES).
  //    Models are looked up first in models_hub, then in the versioned
  //    superhumanmodels directories.
  if (fs.existsSync(lmsPath)) {
    try {
      const lms = JSON.parse(fs.readFileSync(lmsPath, "utf-8"));
      const modelNames = new Set();

      for (const [lang, cfg] of Object.entries(lms.lang_to_model_names || {})) {
        if (!TARGET_LANGUAGES.includes(lang)) continue;
        for (const key of ["word_completion_model_name", "sentence_completion_model_name"]) {
          if (cfg[key]) modelNames.add(cfg[key]);
        }
        const combo = cfg.sentence_completion_combination_model_settings;
        if (combo?.model_name_to_inference_technique) {
          for (const mn of Object.keys(combo.model_name_to_inference_technique)) {
            modelNames.add(mn);
          }
        }
      }

      const modelsHubDir = resolveModelsHubDir();

      for (const modelName of modelNames) {
        const modelDest = path.join(resourcesDest, modelName);
        if (fs.existsSync(modelDest)) continue;

        // Check models_hub first
        if (modelsHubDir) {
          const hubCandidate = path.join(modelsHubDir, modelName);
          if (fs.existsSync(hubCandidate) && fs.statSync(hubCandidate).isDirectory()) {
            copyModelDirSync(hubCandidate, modelDest);
            console.log(`[build]   + prediction model: ${modelName} (models_hub)`);
            continue;
          }
        }

        // Fall back to versioned superhumanmodels directories
        for (const ver of versionDirs) {
          const candidate = path.join(modelsDir, ver, "resources", modelName);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            copyModelDirSync(candidate, modelDest);
            console.log(`[build]   + prediction model: ${modelName} (${ver})`);
            break;
          }
        }
      }
    } catch { /* best-effort */ }
  }
}

async function build() {
  copyTypewiseSdkAssets();

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
