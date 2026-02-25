<p align="center">
  <img src="https://raw.githubusercontent.com/BigBerny/marksense/main/icon.png" alt="Marksense" width="128" />
</p>

<h1 align="center">Marksense</h1>

<p align="center">
  A VS Code / Cursor extension that lets you view and edit Markdown files in a rich, Notion-like editor powered by <a href="https://tiptap.dev">Tiptap</a>.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/BigBerny/marksense/main/screenshot.png" alt="Marksense editor screenshot" width="800" />
</p>
## Features

- **Notion-like editing** — full block-based editor with slash commands, drag & drop, floating toolbars, and rich formatting
- **Instant autocorrect** — spellcheck runs locally via WASM, no network or API token needed; grammar correction available with a [Typewise](https://www.typewise.app) API token
- **Inline predictions** — sentence completion powered by [Typewise](https://www.typewise.app) cloud API
- **Interactive tables** — use toggleable checkboxes and dropdowns for select or multiselect options, all within valid Markdown.
- **Frontmatter panel** — edit document metadata (YAML frontmatter) within the UI
- **Image upload** — drag & drop or click to upload images; files are saved to an `images/` folder next to the Markdown file and rendered inline
- **Git diff viewer** — inline change highlighting against the last commit
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

### Making Marksense the default editor

#### For a single file type

Right-click the editor tab → **Reopen Editor With…** → **Marksense Editor** → click **Configure default editor for '*.md'…** at the bottom of the picker and select **Marksense Editor**. Repeat for `*.mdx` if desired.

#### For a project

Add to `.vscode/settings.json` in your project:

```json
{
  "workbench.editorAssociations": {
    "*.md": "marksense.editor",
    "*.mdx": "marksense.editor"
  }
}
```

#### Globally (all projects)

Open your **User** settings (`Ctrl+Shift+P` / `Cmd+Shift+P` → **Preferences: Open User Settings (JSON)**) and add:

```json
{
  "workbench.editorAssociations": {
    "*.md": "marksense.editor",
    "*.mdx": "marksense.editor"
  }
}
```

> To revert back to the built-in text editor, change the value to `"default"` or remove the entry.

## Configuration

| Setting                      | Default             | Description                                                     |
| ---------------------------- | ------------------- | --------------------------------------------------------------- |
| `marksense.autoSaveDelay`    | `300`               | Debounce delay (ms) before syncing edits to the file            |
| `marksense.defaultFullWidth` | `false`             | Open files in wide layout by default (togglable per file)       |
| `marksense.aiProvider`       | `offlinePreferred`  | AI provider mode — see [Offline support](#offline-support) below |
| `marksense.typewiseToken`    | `""`                | Typewise API token for grammar correction and cloud fallback    |

### Offline support

Marksense ships with a local WASM-based AI engine that runs entirely inside the editor — no network connection or API token required. Spellcheck, autocorrect, and sentence completion (English) work out of the box.

The `marksense.aiProvider` setting controls how local and cloud AI are combined:

| Mode | Behaviour |
| --- | --- |
| `offlinePreferred` (default) | Local WASM models run first; falls back to the cloud API only if a token is set and the local engine hasn't loaded yet |
| `apiPreferred` | Cloud API runs first (requires token); falls back to local models if the API is unreachable |
| `offlineOnly` | Strictly local — no network calls. Grammar correction is disabled |

| Feature | Offline | Cloud (with token) |
| --- | --- | --- |
| Spellcheck / autocorrect | Yes (en, de, fr) | Yes |
| Sentence completion | Yes (English only) | Yes |
| Language detection | Yes | — |
| Grammar correction | No | Yes |

### Typewise AI setup (optional)

Marksense can use [Typewise](https://www.typewise.app) for grammar correction and as a cloud fallback for autocorrect and predictions. Without a token, spellcheck and predictions still work offline via the built-in WASM engine. To get an API key, contact [apikey@typewise.app](mailto:apikey@typewise.app).

**Option 1 — VS Code setting (recommended):**

Open Settings and search for `marksense.typewiseToken`, then paste your API token.

**Option 2 — `.env` file:**

Create a `.env` file in your project root:

```
TYPEWISE_TOKEN=your-typewise-api-token
```

The VS Code setting takes priority over the `.env` file.

### Table column types (TableConfig)

You can define typed columns for any Markdown table by placing a `<TableConfig>` tag directly above it. Configured columns get interactive controls — dropdowns, checkboxes, or multi-select chips — instead of plain text editing.

```markdown

<TableConfig
  Status={["Todo", "In Progress", "Done"]}
  Priority={{ options: ["High", "Medium", "Low"], nullable: true }}
  Tags={{ multi: ["bug", "feature", "docs"] }}
  "Internal only"="boolean"
/>

| Task       | Status | Priority | Tags    | Internal only |
| ---------- | ------ | -------- | ------- | ------------- |
| Fix login  | Done   | High     | bug     | true          |
| Add search | Todo   | Medium   | feature | false         |
```

Prop names are matched to column headers case-insensitively. Column names that contain spaces must be quoted (e.g. `"Internal only"`).

#### Column types

| Type | Syntax | Description |
| --- | --- | --- |
| **Single select** | `"Col"={["A", "B", "C"]}` | Dropdown with predefined options |
| **Single select (nullable)** | `"Col"={{ options: ["A", "B"], nullable: true }}` | Same as above, with a "Clear" action |
| **Multi-select** | `"Col"={{ multi: ["A", "B", "C"] }}` | Checkbox menu; values stored comma-separated |
| **Multi-select (nullable)** | `"Col"={{ options: ["A", "B"], multi: true, nullable: true }}` | Same as above, with a "Clear all" action |
| **Boolean** | `"Col"="boolean"` | Toggleable checkbox (`true` / `false`) |
| **Boolean (nullable)** | `"Col"={{ type: "boolean", nullable: true }}` | Cycles through empty → `true` → `false` |

The `<TableConfig>` tag is stored in the Markdown file and preserved across saves.

## License

MIT
