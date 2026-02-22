/**
 * Frontmatter parsing / serialisation and MDX JSX-tag splitting.
 *
 * Frontmatter is the YAML block between two `---` lines at the very top of a
 * markdown / MDX file.  We separate it from the body so TipTap never sees it
 * and we can render a dedicated UI for it.
 *
 * JSX tags (lines starting with an uppercase component name, e.g. `<Steps>`,
 * `</Step>`) are replaced with HTML `<div>` markers that TipTap's custom
 * RawText atom node can parse and render as editable raw-text blocks.  The
 * markdown content *between* JSX tags passes through untouched so TipTap
 * renders it as normal editable content.
 */

// ─── Frontmatter ────────────────────────────────────────────────────────────

export interface FrontmatterEntry {
  key: string
  value: string
}

export interface ParsedContent {
  /** null when the file has no frontmatter block */
  frontmatter: FrontmatterEntry[] | null
  /** The raw YAML text between the `---` delimiters (preserves original formatting) */
  rawFrontmatter: string | null
  /** Everything after the closing `---` */
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * Split raw file content into frontmatter + body.
 */
export function parseFrontmatter(raw: string): ParsedContent {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) {
    return { frontmatter: null, rawFrontmatter: null, body: raw }
  }

  const yamlText = match[1]
  const body = raw.slice(match[0].length)

  const entries: FrontmatterEntry[] = []
  for (const line of yamlText.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue
    const key = trimmed.slice(0, colonIdx).trim()
    let value = trimmed.slice(colonIdx + 1).trim()
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    entries.push({ key, value })
  }

  return { frontmatter: entries, rawFrontmatter: yamlText, body }
}

/**
 * Re-serialise frontmatter entries + body into a full file string.
 *
 * When `rawYaml` is provided (and non-null), it is used verbatim between the
 * `---` delimiters so that the original formatting (quote style, comments,
 * spacing) is preserved.  Pass `null` to force re-serialisation from entries
 * (e.g. when the user has edited a value in the frontmatter panel).
 */
export function serializeFrontmatter(
  frontmatter: FrontmatterEntry[] | null,
  body: string,
  rawYaml?: string | null
): string {
  if (!frontmatter || frontmatter.length === 0) return body

  let yaml: string
  if (rawYaml != null) {
    // Preserve the original YAML verbatim
    yaml = rawYaml
  } else {
    // Re-serialise from entries
    yaml = frontmatter
      .map(({ key, value }) => {
        const needsQuotes =
          value.includes(":") ||
          value.includes("#") ||
          value.includes('"') ||
          value.includes("'") ||
          value.startsWith(" ") ||
          value.endsWith(" ")
        const escaped = needsQuotes
          ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
          : `"${value}"`
        return `${key}: ${escaped}`
      })
      .join("\n")
  }

  // Always include a blank line between frontmatter and body so TipTap's
  // leading-whitespace trimming doesn't collapse the gap.
  const separator = body.startsWith("\n") ? "" : "\n"
  return `---\n${yaml}\n---\n${separator}${body}`
}

// ─── Leading HTML block preservation ────────────────────────────────────────
//
// Many README-style markdown files open with raw HTML blocks (centered images,
// badges, titles with `align="center"`, etc.) that Tiptap cannot round-trip
// faithfully — HTML attributes like `align` and `width` are not understood by
// the ProseMirror schema and get lost during parse → serialise.
//
// We strip those blocks so Tiptap never sees them, store the extracted prefix,
// and splice it back on save via `restoreLeadingHtml`.

/**
 * Extract contiguous HTML blocks from the start of a markdown body.
 *
 * An "HTML block" is a group of consecutive non-blank lines whose first line
 * begins with an HTML tag (`<tag`, `</tag`, or `<!`).  Blank lines between
 * consecutive HTML blocks are included in the prefix.
 *
 * Returns `{ htmlPrefix, body }`.  `htmlPrefix` is `null` when the body does
 * not start with HTML blocks.
 */
/**
 * Returns true when a line (already trimmed) looks like markdown block-level
 * syntax rather than HTML content.  Used to stop HTML block consumption early
 * when there is no blank line between the HTML and the markdown that follows.
 */
const MD_BLOCK_RE = /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```|~~~|\|)/

export function extractLeadingHtml(body: string): {
  htmlPrefix: string | null
  body: string
} {
  const lines = body.split("\n")
  let i = 0
  let lastHtmlBlockEnd = 0

  while (i < lines.length) {
    // Skip blank lines between HTML blocks
    while (i < lines.length && lines[i].trim() === "") {
      i++
    }
    if (i >= lines.length) break

    // Check if this line starts an HTML block
    if (/^<[a-zA-Z/!]/.test(lines[i].trim())) {
      // Consume lines that belong to this HTML block.  Stop at a blank line
      // OR at a line that looks like markdown block-level content (handles
      // files where there is no blank line between </tag> and ## Heading).
      while (i < lines.length && lines[i].trim() !== "") {
        const t = lines[i].trim()
        if (!/^<[a-zA-Z/!]/.test(t) && MD_BLOCK_RE.test(t)) break
        i++
      }
      lastHtmlBlockEnd = i
    } else {
      break
    }
  }

  if (lastHtmlBlockEnd === 0) {
    return { htmlPrefix: null, body }
  }

  const htmlPrefix = lines.slice(0, lastHtmlBlockEnd).join("\n")
  const remaining = lines.slice(lastHtmlBlockEnd).join("\n")

  return { htmlPrefix, body: remaining }
}

/**
 * Prepend a previously extracted HTML prefix back onto a markdown body.
 */
export function restoreLeadingHtml(
  htmlPrefix: string | null,
  body: string
): string {
  if (!htmlPrefix) return body
  return htmlPrefix + "\n" + body
}

// ─── TableConfig tag handling ────────────────────────────────────────────────
//
// `<TableConfig ... />` tags (possibly multi-line) are handled first so they
// are captured as a single raw-text block before the per-line JSX splitter runs.

/**
 * Matches a self-closing `<TableConfig ... />` tag, possibly spanning
 * multiple lines.  Must appear at the start of a line.
 */
const TABLE_CONFIG_RE = /^[ \t]*<TableConfig\b[\s\S]*?\/\s*>[ \t]*$/gm

// ─── MDX JSX tag splitting ──────────────────────────────────────────────────
//
// Instead of wrapping entire JSX blocks, we split them into individual tag
// lines.  Each tag becomes a `<div data-type="raw-text">` that TipTap's
// RawText atom node can parse.  The markdown content *between* tags passes
// through untouched so TipTap renders it as normal editable content.

/**
 * Matches a single JSX tag line (opening, closing, or self-closing) where the
 * component name starts with an uppercase letter.
 *
 * Captures (on a single line, possibly with leading whitespace):
 *   - Opening:      <Component ...>
 *   - Closing:      </Component>
 *   - Self-closing: <Component ... />
 */
const JSX_TAG_LINE_RE =
  /^([ \t]*<\/?[A-Z][A-Za-z0-9.]*(?:\s[^>]*)?>[ \t]*|[ \t]*<[A-Z][A-Za-z0-9.]*(?:\s[^>]*)?\/\s*>[ \t]*)$/gm

/** HTML-encode a string for safe use in an attribute value. */
function htmlEncode(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;")
}

/** Decode HTML entities back to their original characters. */
function htmlDecode(str: string): string {
  return str
    .replace(/&#13;/g, "\r")
    .replace(/&#10;/g, "\n")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
}

/**
 * Replace individual JSX tag lines with `<div data-type="raw-text">` markers
 * that TipTap's RawText atom node will parse.
 *
 * `<TableConfig ... />` tags are handled first (may span multiple lines).
 * All markers use the same `raw-text` data-type.
 *
 * Content between tags is left as-is (normal markdown).
 */
export function wrapJsxComponents(markdown: string): string {
  // Handle <TableConfig /> tags first (may span multiple lines)
  let result = markdown.replace(TABLE_CONFIG_RE, (match) => {
    const trimmed = match.trim()
    const encoded = htmlEncode(trimmed)
    return `<div data-type="raw-text" data-tag="${encoded}"></div>`
  })
  // Then handle all remaining JSX tags
  result = result.replace(JSX_TAG_LINE_RE, (match) => {
    const trimmed = match.trim()
    const encoded = htmlEncode(trimmed)
    return `<div data-type="raw-text" data-tag="${encoded}"></div>`
  })
  return result
}

/**
 * Pattern matching the `<div data-type="raw-text" ...>` markers in the
 * serialised markdown output from TipTap.
 */
const RAW_TEXT_DIV_RE =
  /<div data-type="raw-text" data-tag="([^"]*)">\s*<\/div>/g

/**
 * Restore JSX tag lines from the `<div data-type="raw-text">` markers
 * that TipTap's markdown serialiser produces.
 */
export function unwrapJsxComponents(markdown: string): string {
  return markdown.replace(RAW_TEXT_DIV_RE, (_match, encoded: string) => {
    return htmlDecode(encoded)
  })
}
