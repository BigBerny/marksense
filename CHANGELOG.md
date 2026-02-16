# Changelog

## 1.2.0 — 2026-02-16

### Added

- Add default full-width setting for the editor
- Add raw block handling to preserve and edit non-Markdown content (e.g. leading HTML) inline

### Improved

- Improve MarkdownEditor synchronization for raw prefix blocks

## 1.1.0 — 2026-02-16

### Added

- Detect Git repository status — the diff toggle button now only appears when the file is inside a Git repo
- Preserve leading HTML blocks in Markdown files during editor round-trips, with a visual banner showing the preserved content

### Improved

- Enhance file synchronization to better handle external changes and prevent stale edits

## 1.0.2 — 2026-02-16

### Improved

- Added Getting Started walkthrough to guide new users through opening files, enabling the editor, setting defaults, and configuring Typewise
- Added marketplace categories (Visualization, Formatters) and additional keywords for better discoverability
- Enhanced VS Code setting descriptions with rich Markdown formatting
- Added API key contact info for Typewise setup

### Fixed

- Updated Typewise URLs from typewise.ai to typewise.app

## 1.0.1 — 2026-02-14

### Fixed

- Image upload now saves files to disk. Previously the upload UI accepted files but only inserted a placeholder path without writing the image. Uploaded images are saved to an `images/` directory next to the Markdown file, and the editor displays them via webview resource URIs.
- Local images referenced in Markdown (e.g. `![alt](images/photo.jpg)`) now render correctly in the editor.

## 1.0.0 — 2026-02-14

- Notion-like block editor for Markdown files
- Slash commands, drag & drop blocks, floating toolbars
- Markdown round-trip: edit in rich text, save as clean Markdown
- Frontmatter editing panel (YAML key-value UI)
- Git diff viewer with inline change highlighting
- Autocorrect, grammar correction, and sentence completion via Typewise (optional)
- Configurable auto-save debounce
- Dark / light mode following VS Code theme
- Emoji picker, mentions, tables, task lists, code blocks, math
