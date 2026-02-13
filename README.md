# Markdown Tiptap Editor

A Cursor / VS Code extension that lets you view and edit Markdown files in a rich, Notion-like editor powered by [Tiptap](https://tiptap.dev).

## Features

- **Notion-like editing** -- full block-based editor with slash commands, drag & drop, floating toolbars, and rich formatting
- **Markdown round-trip** -- opens `.md` files, edits in rich text, saves back as clean Markdown via `@tiptap/markdown`
- **Instant auto-save** -- every edit syncs to the file automatically (debounced at 300ms)
- **AI assistance** -- inline AI tools for writing, improving, and generating content (requires Tiptap Cloud credentials)
- **Spellcheck** -- browser-level spell checking enabled by default
- **Dark / light mode** -- follows your VS Code theme
- **Emoji, mentions, tables, task lists, code blocks, math, and more**

## Requirements

- **Tiptap Start plan** -- the Notion-like template UI components require an active [Tiptap subscription](https://cloud.tiptap.dev)
- **Node.js >= 18** for building

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure AI (optional)

Add your Tiptap Cloud credentials to the `.env` file:

```
TIPTAP_AI_APP_ID=your-app-id
TIPTAP_AI_TOKEN=your-jwt-token
```

Or configure them in VS Code settings:

- `markdownTiptap.aiAppId`
- `markdownTiptap.aiToken`

Get credentials at [https://cloud.tiptap.dev](https://cloud.tiptap.dev).

### 3. Build

```bash
npm run build
```

### 4. Run in Cursor / VS Code

Press **F5** to launch the Extension Development Host. Open any `.md` file, then right-click the tab and choose **Reopen Editor With... > Tiptap Markdown Editor**.

### Development

Watch mode rebuilds on file changes:

```bash
npm run watch
```

## How it works

The extension uses VS Code's `CustomTextEditorProvider` API:

1. When you open a `.md` file with the Tiptap editor, the extension reads the file content
2. The Markdown is parsed into the Tiptap editor using `@tiptap/markdown`
3. As you edit, changes are serialized back to Markdown and written to the `TextDocument`
4. VS Code's built-in auto-save writes the file to disk

This gives you native undo/redo, hot exit, and file save integration for free.

## Project structure

```
src/
  extension.ts                  # Extension entry point
  markdownEditorProvider.ts     # CustomTextEditorProvider with sync logic
  webview/
    index.tsx                   # React entry point
    App.tsx                     # Provider wrapping
    MarkdownEditor.tsx          # Tiptap editor with all extensions + VS Code sync
    vscodeApi.ts                # acquireVsCodeApi() bridge
@/                              # Tiptap UI Components (installed by CLI)
  components/                   # UI components, nodes, extensions
  contexts/                     # React contexts
  hooks/                        # Custom hooks
  lib/                          # Utilities
  styles/                       # SCSS variables & animations
```

## Configuration


| Setting                        | Default | Description                              |
| ------------------------------ | ------- | ---------------------------------------- |
| `markdownTiptap.aiAppId`       | `""`    | Tiptap Cloud AI App ID                   |
| `markdownTiptap.aiToken`       | `""`    | Tiptap Cloud AI JWT Token                |
| `markdownTiptap.autoSaveDelay` | `300`   | Debounce delay (ms) before syncing edits |


## License

MIT