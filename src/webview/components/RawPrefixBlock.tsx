import "./RawPrefixBlock.scss"

interface RawPrefixBlockProps {
  rawPrefix: string | null
}

/**
 * Non-editable block that shows content stripped from the top of the file
 * before Tiptap parses it (HTML blocks, MDX, or anything the editor can't
 * round-trip faithfully).  Always visible as a labelled code block.
 */
export function RawPrefixBlock({ rawPrefix }: RawPrefixBlockProps) {
  if (!rawPrefix) return null

  return (
    <div className="raw-prefix-block">
      <div className="raw-prefix-block-inner">
        <div className="raw-prefix-header">
          <svg
            className="raw-prefix-icon"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z" />
          </svg>
          <span className="raw-prefix-label">Raw Markdown</span>
        </div>

        <pre className="raw-prefix-code">{rawPrefix}</pre>
      </div>
    </div>
  )
}
