/**
 * In-editor CodeMirror diff view using @codemirror/merge.
 * Shows a unified diff between HEAD content and the current working copy.
 */

import { useEffect, useRef } from "react"
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { html } from "@codemirror/lang-html"
import { unifiedMergeView } from "@codemirror/merge"
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"
import { marksenseTheme, marksenseSyntaxHighlighting } from "./source-editor-theme"
import { useDiff } from "../DiffContext"

const diffTheme = EditorView.theme({
  // Inserted lines (present in working copy, absent in HEAD)
  ".cm-changedLine": {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  ".cm-changedText": {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  // Deleted chunks (present in HEAD, absent in working copy)
  ".cm-deletedChunk": {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  // Hide cursor and active line in read-only diff
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
})

interface DiffEditorProps {
  currentContent: string
  headContent: string
}

export function DiffEditor({ currentContent, headContent }: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { closeDiffEditor } = useDiff()

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: currentContent,
      extensions: [
        marksenseTheme,
        marksenseSyntaxHighlighting,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        diffTheme,
        lineNumbers(),
        highlightSpecialChars(),
        drawSelection(),
        markdown({ base: markdownLanguage, addKeymap: false, extensions: [{ props: [] }] }),
        EditorView.lineWrapping,
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        unifiedMergeView({
          original: headContent,
          syntaxHighlightDeletions: true,
          mergeControls: false,
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [currentContent, headContent])

  return (
    <div className="diff-editor-wrapper">
      <div className="diff-editor-toolbar">
        <span className="diff-editor-title">Changes vs HEAD</span>
        <button
          type="button"
          className="diff-editor-close"
          onClick={closeDiffEditor}
          aria-label="Close diff"
        >
          Close
        </button>
      </div>
      <div ref={containerRef} className="diff-editor-container" />
    </div>
  )
}
