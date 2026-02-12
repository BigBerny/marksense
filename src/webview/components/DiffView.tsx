import { useMemo } from "react"
import { diffMarkdown } from "../diffEngine"
import type { DiffResult } from "../diffEngine"

import "./DiffView.scss"

interface DiffViewProps {
  /** Current editor markdown content */
  currentContent: string
  /** Content from HEAD (last commit) */
  headContent: string
}

/**
 * Renders a block-level diff view between the HEAD version and the current version.
 * Shows removed blocks with red background, added blocks with green background,
 * and modified blocks with both old (red) and new (green) stacked.
 */
export function DiffView({ currentContent, headContent }: DiffViewProps) {
  const diffResults = useMemo(
    () => diffMarkdown(headContent, currentContent),
    [headContent, currentContent]
  )

  const hasChanges = diffResults.some((r) => r.type !== "unchanged")

  if (!hasChanges) {
    return (
      <div className="diff-view">
        <div className="diff-empty">
          <div className="diff-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p>No changes since last commit</p>
        </div>
      </div>
    )
  }

  return (
    <div className="diff-view">
      {diffResults.map((result, index) => (
        <DiffBlock key={index} result={result} />
      ))}
    </div>
  )
}

function DiffBlock({ result }: { result: DiffResult }) {
  switch (result.type) {
    case "unchanged":
      return (
        <div className="diff-block diff-block--unchanged">
          <pre className="diff-block-content">{result.newBlock?.text || result.oldBlock?.text}</pre>
        </div>
      )

    case "added":
      return (
        <div className="diff-block diff-block--added">
          <div className="diff-block-indicator">+</div>
          <pre className="diff-block-content">{result.newBlock?.text}</pre>
        </div>
      )

    case "removed":
      return (
        <div className="diff-block diff-block--removed">
          <div className="diff-block-indicator">&minus;</div>
          <pre className="diff-block-content">{result.oldBlock?.text}</pre>
        </div>
      )

    case "modified":
      return (
        <div className="diff-block diff-block--modified">
          <div className="diff-block diff-block--removed diff-block--nested">
            <div className="diff-block-indicator">&minus;</div>
            <pre className="diff-block-content">{result.oldBlock?.text}</pre>
          </div>
          <div className="diff-block diff-block--added diff-block--nested">
            <div className="diff-block-indicator">+</div>
            <pre className="diff-block-content">{result.newBlock?.text}</pre>
          </div>
        </div>
      )

    default:
      return null
  }
}
