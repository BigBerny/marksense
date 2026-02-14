# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project Overview

Marksense is a VS Code / Cursor extension that provides a Notion-like rich-text editor for Markdown (`.md`) files. It uses [Tiptap](https://tiptap.dev) under the hood with a React webview, and optionally integrates [Typewise](https://www.typewise.ai) for autocorrect, grammar correction, and sentence completion. (MDX support code exists in the codebase but is currently disabled.)

## Directory Structure

```
├── src/
│   ├── extension.ts              # VS Code extension entry point
│   ├── markdownEditorProvider.ts  # CustomEditorProvider — file I/O, webview lifecycle, settings
│   └── webview/
│       ├── index.tsx              # React entry point (mounted in the webview)
│       ├── App.tsx                # Top-level React component
│       ├── MarkdownEditor.tsx     # Main editor component (Tiptap setup, extensions, sync)
│       ├── extensions/
│       │   ├── TypewiseIntegration.ts  # Autocorrect, grammar, sentence completion
│       │   ├── MdxTagExtension.ts      # Non-editable MDX/JSX tag chips
│       │   └── DiffHighlightExtension.ts
│       ├── components/            # CorrectionPopup, FrontmatterPanel, DiffView, MdxTagBlock
│       ├── frontmatterUtils.ts    # YAML frontmatter + JSX tag round-trip helpers
│       ├── diffEngine.ts          # Block-level diff algorithm
│       └── DiffContext.tsx         # React context for diff mode
├── @/                             # Tiptap template UI components (from Tiptap CLI)
│   ├── components/                # Editor chrome: toolbars, menus, panels
│   ├── contexts/                  # React contexts (AI, collab, user, app)
│   ├── hooks/                     # Editor-related React hooks
│   ├── lib/                       # tiptap-collab-utils.ts, tiptap-utils.ts, etc.
│   └── styles/                    # SCSS variables and animations
├── dist/                          # Build output (extension.js, webview.js, webview.css)
├── esbuild.mjs                    # Build config for extension host + webview bundles
├── package.json
└── tsconfig.json
```

## Architecture

The extension has two runtime contexts:

1. **Extension host** (Node.js) — `src/extension.ts` registers a `CustomEditorProvider`. When a `.md` file is opened, `markdownEditorProvider.ts` reads the file, creates a webview, injects settings via `window.__SETTINGS__`, and handles bidirectional content sync.

2. **Webview** (browser/React) — `src/webview/` renders the Tiptap editor. Content flows as Markdown string -> Tiptap document -> Markdown string. Edits are posted back to the extension host which writes to disk.

### Settings flow

```
VS Code settings / .env file
    → markdownEditorProvider.ts (reads & merges)
    → injected as window.__SETTINGS__ in webview HTML
    → MarkdownEditor.tsx reads and passes to Tiptap extensions
```

### Key extension points

- **TypewiseIntegration** — ProseMirror plugin for word correction, grammar checking, and ghost-text predictions via the Typewise API. Disabled when no API token is configured.
- **MdxTagExtension** — (Disabled) Renders JSX/MDX tags as non-editable atom nodes. Code retained for future re-enablement.
- **DiffHighlight** — Inline diff decorations for git change review.
- **FrontmatterPanel** — Side panel for editing YAML frontmatter as key-value pairs.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Production build (extension + webview)
npm run watch        # Watch mode with incremental rebuilds
npm run package      # Build a .vsix package for distribution
```

Press **F5** in VS Code/Cursor to launch the Extension Development Host for testing.

## Conventions

- TypeScript throughout; the webview uses React 19 + Tiptap 3.
- Path alias `@/*` maps to the `@/` directory (Tiptap template components).
- The extension reads settings from `marksense.*` VS Code configuration, with `.env` file as fallback for `TYPEWISE_TOKEN`.
- No external test framework currently; manual testing via Extension Development Host.
