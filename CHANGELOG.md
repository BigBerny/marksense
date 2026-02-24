# Changelog

## 3.2.1 — 2026-02-24

### Fixed

- Fix image links in README to reflect new repository location

## 3.2.0 — 2026-02-24

### Added

- Add accept/reject buttons for managing individual diff chunks in the diff editor

### Improved

- Improve content synchronization when entering and exiting diff mode
- Improve DiffEditor responsiveness to content changes and external updates

## 3.1.0 — 2026-02-24

### Added

- Add in-editor diff view for comparing changes against the Git HEAD content

### Improved

- Improve line change detection accuracy with LCS-based diff algorithm
- Improve blank line handling in Markdown list output
- Update README documentation with direct image URLs and MDX file guidance

## 3.0.1 — 2026-02-23

### Improved

- Reduce extension file size by limiting bundled Typewise languages to English and German
- Optimize SDK asset copying with selective file inclusion

## 3.0.0 — 2026-02-23

### Added

- Add offline Typewise SDK integration for spell-check and sentence predictions in both rich and source editors
- Add AI provider settings to configure spell-check and prediction behavior per workspace
- Add multi-language support for Typewise corrections

### Improved

- Improve slash command dropdown menu with better styling, keyboard navigation, and usage tracking
- Improve TOC sidebar with fixed positioning on narrow screens and enhanced mouse-tracking navigation
- Improve editor header with segmented control and theme toggle
- Improve list blank-line normalization and JSX blank-line handling in Markdown output

### Fixed

- Fix non-breaking spaces appearing in Markdown output

## 2.0.0 — 2026-02-22

### Added

- Add Source mode with CodeMirror integration for direct Markdown editing alongside the rich editor
- Add MDX file support in table configuration workflows
- Add text highlighting support in Source mode editing

### Improved

- Improve table management with the new TableConfig component
- Improve TOC sidebar behavior and settings menu interactions for better document navigation
- Improve frontmatter panel interactions and overall Markdown editor layout

## 1.3.0 — 2026-02-21

### Added

- Add interactive table checkboxes — use `[ ]` / `[x]` inside table cells for toggleable checkboxes that round-trip to Markdown

## 1.2.1 — 2026-02-16

### Improved

- Update documentation to include new Typewise configuration settings

### Fixed

- Fix release script compatibility on macOS by replacing GNU sed with awk

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
