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
import { Button } from "@/components/tiptap-ui-primitive/button"
import { XIcon } from "@/components/tiptap-icons/x-icon"

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

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

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
        <div className="diff-editor-title">
          <GitBranchIcon className="diff-editor-title-icon" />
          <span>Changes vs HEAD</span>
        </div>
        <Button
          type="button"
          data-style="ghost"
          onClick={closeDiffEditor}
          aria-label="Close diff"
          tooltip="Close diff view"
        >
          <XIcon className="tiptap-button-icon" />
        </Button>
      </div>
      <div ref={containerRef} className="diff-editor-container" />
    </div>
  )
}
