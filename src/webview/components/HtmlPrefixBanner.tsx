import { useState } from "react"
import "./HtmlPrefixBanner.scss"

interface HtmlPrefixBannerProps {
  htmlPrefix: string | null
}

/**
 * Non-editable banner that indicates leading HTML blocks are preserved
 * but hidden from the rich-text editor.  Expandable to show the raw HTML.
 */
export function HtmlPrefixBanner({ htmlPrefix }: HtmlPrefixBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (!htmlPrefix) return null

  return (
    <div className="html-prefix-banner">
      <div className="html-prefix-banner-inner">
        <button
          className="html-prefix-toggle"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          <svg
            className="html-prefix-icon"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708L.94 8.224 4 5.164l.708.414zm6.584 0l2.647 2.646-2.647 2.646.708.708L15.06 8.224 12 5.164l-.708.414z" />
            <path d="M5.5 13h1l4-10h-1l-4 10z" />
          </svg>
          <span className="html-prefix-label">HTML header</span>
          <span className="html-prefix-hint">
            preserved but not shown in the editor
          </span>
          <svg
            className={`html-prefix-chevron ${expanded ? "expanded" : ""}`}
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M4.646 5.646a.5.5 0 01.708 0L8 8.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z"
            />
          </svg>
        </button>

        {expanded && (
          <pre className="html-prefix-code">{htmlPrefix}</pre>
        )}
      </div>
    </div>
  )
}
