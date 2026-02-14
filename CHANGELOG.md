# Changelog

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
