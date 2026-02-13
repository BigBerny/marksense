/**
 * Frontmatter parsing / serialisation and MDX JSX-component wrapping.
 *
 * Frontmatter is the YAML block between two `---` lines at the very top of a
 * markdown / MDX file.  We separate it from the body so TipTap never sees it
 * and we can render a dedicated UI for it.
 *
 * JSX components (tags starting with an uppercase letter, e.g. `<Steps>`) are
 * converted into fenced code blocks before the content reaches TipTap, and
 * restored when we serialise back.
 */

// ─── Frontmatter ────────────────────────────────────────────────────────────

export interface FrontmatterEntry {
  key: string
  value: string
}

export interface ParsedContent {
  /** null when the file has no frontmatter block */
  frontmatter: FrontmatterEntry[] | null
  /** The raw YAML text (so we can round-trip comments / formatting) */
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
 */
export function serializeFrontmatter(
  frontmatter: FrontmatterEntry[] | null,
  body: string
): string {
  if (!frontmatter || frontmatter.length === 0) return body

  const yaml = frontmatter
    .map(({ key, value }) => {
      // Quote the value if it contains special YAML characters
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

  return `---\n${yaml}\n---\n${body}`
}

// ─── MDX JSX-component wrapping ─────────────────────────────────────────────

/**
 * Matches a top-level JSX component block.
 *
 * A "top-level" component is one that:
 *  - starts at the beginning of a line
 *  - opens with `<ComponentName` (uppercase first letter)
 *  - closes with `</ComponentName>`
 *
 * Self-closing tags (`<Foo />`) on a single line are also matched.
 */
const JSX_BLOCK_RE =
  /^(<([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?>[\s\S]*?<\/\2>|<([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?\/\s*>)/gm

const MDX_FENCE_OPEN = "```mdx-component"
const MDX_FENCE_CLOSE = "```"

/**
 * Wrap top-level JSX component blocks in fenced code blocks so TipTap can
 * display them as code.
 */
export function wrapJsxComponents(markdown: string): string {
  return markdown.replace(JSX_BLOCK_RE, (match) => {
    return `${MDX_FENCE_OPEN}\n${match}\n${MDX_FENCE_CLOSE}`
  })
}

/**
 * Restore JSX component blocks that were wrapped by `wrapJsxComponents`.
 */
export function unwrapJsxComponents(markdown: string): string {
  // Match code fences we inserted, being careful with the backtick escaping
  const fenceRe = new RegExp(
    "```mdx-component\\r?\\n([\\s\\S]*?)\\r?\\n```",
    "g"
  )
  return markdown.replace(fenceRe, (_match, inner: string) => inner)
}
