# Marksense

A VS Code / Cursor extension that lets you view and edit Markdown files in a rich, Notion-like editor powered by [Tiptap](https://tiptap.dev).

## Features

- **Notion-like editing** — full block-based editor with slash commands, drag & drop, floating toolbars, and rich formatting
- **Markdown round-trip** — opens `.md` files, edits in rich text, saves back as clean Markdown.
- **Instant auto-save** — every edit syncs to the file automatically (configurable debounce)
- **Inline predictions** — sentence completion powered by [Typewise](https://www.typewise.ai) (optional, requires API token)
- **Spellcheck & grammar** — autocorrect and grammar correction powered by [Typewise](https://www.typewise.ai)
- **Image upload** — drag & drop or click to upload images; files are saved to an `images/` folder next to the Markdown file and rendered inline
- **Git diff viewer** — inline change highlighting against the last commit
- **Frontmatter panel** — edit YAML frontmatter as key-value pairs
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

Open any `.md` file, then right-click the editor tab and choose **Reopen Editor With… > Marksense Editor**.

### Making Marksense the default editor

#### For a single file type

Right-click the editor tab → **Reopen Editor With…** → **Marksense Editor** → click **Configure default editor for '*.md'…** at the bottom of the picker and select **Marksense Editor**.

#### For a project

Add to `.vscode/settings.json` in your project:

```json
{
  "workbench.editorAssociations": {
    "*.md": "marksense.editor"
  }
}
```

#### Globally (all projects)

Open your **User** settings (`Ctrl+Shift+P` / `Cmd+Shift+P` → **Preferences: Open User Settings (JSON)**) and add:

```json
{
  "workbench.editorAssociations": {
    "*.md": "marksense.editor"
  }
}
```

> To revert back to the built-in text editor, change the value to `"default"` or remove the entry.

## Configuration

| Setting                      | Default | Description                                                     |
| ---------------------------- | ------- | --------------------------------------------------------------- |
| `marksense.autoSaveDelay`    | `300`   | Debounce delay (ms) before syncing edits to the file            |
| `marksense.typewiseToken`    | `""`    | Typewise API token for autocorrect, grammar, and predictions    |

### Typewise AI setup (optional)

Marksense can use [Typewise](https://www.typewise.ai) for autocorrect, grammar correction, and sentence completion. Without a token, these features are disabled and the extension works as a pure offline editor.

**Option 1 — VS Code setting (recommended):**

Open Settings and search for `marksense.typewiseToken`, then paste your API token.

**Option 2 — `.env` file:**

Create a `.env` file in your project root:

```
TYPEWISE_TOKEN=your-typewise-api-token
```

The VS Code setting takes priority over the `.env` file.

## License

MIT
