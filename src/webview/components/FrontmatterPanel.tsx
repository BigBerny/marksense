import { useCallback, useRef, useEffect } from "react"
import type { FrontmatterEntry } from "../frontmatterUtils"
import "./FrontmatterPanel.scss"

interface FrontmatterPanelProps {
  entries: FrontmatterEntry[]
  onChange: (entries: FrontmatterEntry[]) => void
}

/**
 * Renders frontmatter key-value pairs in a structured panel.
 * Keys are shown as labels on the left; values are editable on the right.
 */
export function FrontmatterPanel({ entries, onChange }: FrontmatterPanelProps) {
  const handleChange = useCallback(
    (index: number, newValue: string) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, value: newValue } : entry
      )
      onChange(updated)
    },
    [entries, onChange]
  )

  if (entries.length === 0) return null

  return (
    <div className="frontmatter-panel">
      <div className="frontmatter-panel-inner">
        <div className="frontmatter-header">
          <svg
            className="frontmatter-header-icon"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zM3.5 3a.5.5 0 00-.5.5V5h10V3.5a.5.5 0 00-.5-.5h-9zM13 6H3v6.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V6z" />
          </svg>
          <span className="frontmatter-header-label">Metadata</span>
        </div>

        <div className="frontmatter-rows">
          {entries.map((entry, i) => (
            <FrontmatterRow
              key={entry.key}
              label={entry.key}
              value={entry.value}
              onChange={(val) => handleChange(i, val)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Individual row ──────────────────────────────────────────────────────────

interface FrontmatterRowProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function FrontmatterRow({ label, value, onChange }: FrontmatterRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [value, autoResize])

  return (
    <div className="frontmatter-row">
      <div className="frontmatter-key">{label}</div>
      <textarea
        ref={textareaRef}
        className="frontmatter-value"
        value={value}
        rows={1}
        placeholder="Empty"
        onChange={(e) => {
          onChange(e.target.value)
          autoResize()
        }}
      />
    </div>
  )
}
