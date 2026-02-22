/**
 * Table of Contents sidebar for the CodeMirror source editor.
 * Parses headings from raw markdown text, displays a clickable TOC,
 * and highlights the active heading based on scroll position.
 */

import { useCallback, useMemo, useEffect, useRef, useState } from "react"
import { EditorView } from "@codemirror/view"
import { cn } from "@/lib/tiptap-utils"

import "@/components/tiptap-node/toc-node/ui/toc-sidebar/toc-sidebar.scss"

export interface SourceHeading {
  id: string
  textContent: string
  level: number
  lineNumber: number
  from: number
}

function parseHeadings(text: string): SourceHeading[] {
  const headings: SourceHeading[] = []
  const lines = text.split("\n")
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const textContent = match[2].replace(/\s*#+\s*$/, "").trim()
      headings.push({
        id: `source-h-${i}`,
        textContent,
        level,
        lineNumber: i + 1,
        from: pos,
      })
    }
    pos += line.length + 1
  }
  return headings
}

function normalizeDepths(headings: SourceHeading[]): number[] {
  if (headings.length === 0) return []
  const minLevel = Math.min(...headings.map(h => h.level))
  return headings.map(h => h.level - minLevel + 1)
}

export interface SourceTocSidebarProps {
  sourceContent: string
  editorView: EditorView | null
  actions?: React.ReactNode
}

export function SourceTocSidebar({ sourceContent, editorView, actions }: SourceTocSidebarProps) {
  const headings = useMemo(() => parseHeadings(sourceContent), [sourceContent])
  const normalizedDepths = useMemo(() => normalizeDepths(headings), [headings])
  const [activeId, setActiveId] = useState<string | null>(null)
  const lastNavTimeRef = useRef(0)

  const depthById = useMemo(() => {
    const map = new Map<string, number>()
    headings.forEach((h, i) => {
      map.set(h.id, normalizedDepths[i] ?? 1)
    })
    return map
  }, [headings, normalizedDepths])

  // Track active heading based on scroll position
  useEffect(() => {
    if (!editorView || headings.length === 0) return

    const checkActiveHeading = () => {
      if (Date.now() - lastNavTimeRef.current < 200) return

      const scrollTop = editorView.scrollDOM.scrollTop
      const viewportTop = editorView.documentTop

      let current: SourceHeading | null = null
      for (const heading of headings) {
        try {
          const line = editorView.state.doc.line(heading.lineNumber)
          const coords = editorView.coordsAtPos(line.from)
          if (coords && coords.top - viewportTop <= scrollTop + 60) {
            current = heading
          }
        } catch { /* line may not exist */ }
      }

      setActiveId(current?.id ?? headings[0]?.id ?? null)
    }

    checkActiveHeading()

    const scroller = editorView.scrollDOM
    scroller.addEventListener("scroll", checkActiveHeading, { passive: true })
    return () => scroller.removeEventListener("scroll", checkActiveHeading)
  }, [editorView, headings])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, heading: SourceHeading) => {
      e.preventDefault()
      if (!editorView) return

      lastNavTimeRef.current = Date.now()
      setActiveId(heading.id)

      try {
        const line = editorView.state.doc.line(heading.lineNumber)

        editorView.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 48 }),
        })

        // Force a second scroll pass after CodeMirror finishes layout
        requestAnimationFrame(() => {
          try {
            const coords = editorView.coordsAtPos(line.from)
            if (coords) {
              const scrollerRect = editorView.scrollDOM.getBoundingClientRect()
              const targetTop = coords.top - scrollerRect.top + editorView.scrollDOM.scrollTop - 48
              editorView.scrollDOM.scrollTo({ top: Math.max(0, targetTop), behavior: "instant" })
            }
          } catch { /* ignore */ }
        })

        editorView.focus()
      } catch { /* line may not exist */ }
    },
    [editorView]
  )

  // Need to import EditorView effects at module scope
  const hasHeadings = headings.length > 0

  return (
    <div className="toc-sidebar">
      <div className="toc-sidebar-wrapper">
        <div className="toc-sidebar-inner">
          {/* Progress rail */}
          <div className="toc-sidebar-progress">
            {headings.map((item) => {
              const depth = depthById.get(item.id) ?? 1
              const isActive = activeId === item.id
              return (
                <div
                  key={item.id}
                  className={cn(
                    "toc-sidebar-progress-line",
                    isActive && "toc-sidebar-progress-line--active"
                  )}
                  data-depth={depth}
                  style={{ "--toc-depth": depth } as React.CSSProperties}
                />
              )
            })}
          </div>

          {actions && (
            <div className="toc-sidebar-actions">
              {actions}
            </div>
          )}

          <nav
            className={cn(
              "toc-sidebar-nav",
              !hasHeadings && "toc-sidebar-nav--hidden"
            )}
            aria-label="Table of contents"
          >
            <div className="toc-sidebar-popover">
              {headings.map((item) => {
                const depth = depthById.get(item.id) ?? 1
                const isActive = activeId === item.id
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    rel="noopener noreferrer"
                    className={cn(
                      "toc-sidebar-item notranslate",
                      isActive && "toc-sidebar-item--active"
                    )}
                    data-depth={depth}
                    style={{ "--toc-depth": depth } as React.CSSProperties}
                    onClick={(e) => handleClick(e, item)}
                    aria-current={isActive ? "location" : undefined}
                  >
                    {item.textContent}
                  </a>
                )
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  )
}
