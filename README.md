# Marksense

A VS Code / Cursor extension that lets you view and edit Markdown files in a rich, Notion-like editor powered by [Tiptap](https://tiptap.dev).

## Features

- **Notion-like editing** — full block-based editor with slash commands, drag & drop, floating toolbars, and rich formatting
- **Markdown round-trip** — opens `.md` / `.mdx` files, edits in rich text, saves back as clean Markdown
- **Instant auto-save** — every edit syncs to the file automatically (configurable debounce)
- **AI assistance** — inline AI tools for writing, improving, and generating content (requires Tiptap Cloud credentials)
- **Spellcheck** — browser-level spell checking enabled by default
- **Dark / light mode** — follows your VS Code theme
- **Emoji, mentions, tables, task lists, code blocks, math, and more**

## Installation

### From `.vsix` file

1. Download the latest `marksense-x.x.x.vsix` from the [Releases](https://github.com/janisberneker/marksense/releases) page
2. In VS Code / Cursor, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Extensions: Install from VSIX…** and select the downloaded file

### From source

```bash
git clone https://github.com/janisberneker/marksense.git
cd marksense
npm install
npm run build
```

Then press **F5** to launch the Extension Development Host.

## Usage

Open any `.md` or `.mdx` file, then right-click the editor tab and choose **Reopen Editor With… > Marksense Editor**.

## Configuration

| Setting                   | Default | Description                              |
| ------------------------- | ------- | ---------------------------------------- |
| `marksense.aiAppId`       | `""`    | Tiptap Cloud AI App ID                   |
| `marksense.aiToken`       | `""`    | Tiptap Cloud AI JWT Token                |
| `marksense.autoSaveDelay` | `300`   | Debounce delay (ms) before syncing edits |

### AI setup (optional)

Add your Tiptap Cloud credentials to a `.env` file in the project root:

```
TIPTAP_AI_APP_ID=your-app-id
TIPTAP_AI_TOKEN=your-jwt-token
```

Or configure them in VS Code settings under **Marksense**.

Get credentials at [https://cloud.tiptap.dev](https://cloud.tiptap.dev).

## Packaging

To build a shareable `.vsix` package:

```bash
npm run package
```

This produces `marksense-0.1.0.vsix` which you can share and install via **Extensions: Install from VSIX…**.

## Development

Watch mode rebuilds on file changes:

```bash
npm run watch
```

## How it works

The extension uses VS Code's `CustomEditorProvider` API:

1. When you open a `.md` file with Marksense, the extension reads the file content
2. The Markdown is parsed into the Tiptap editor using `@tiptap/markdown`
3. As you edit, changes are serialized back to Markdown and written to the document
4. VS Code's built-in auto-save writes the file to disk

This gives you native undo/redo, hot exit, and file save integration for free.

## License

MIT
