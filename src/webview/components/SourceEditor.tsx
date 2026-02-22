/**
 * CodeMirror 6 Markdown source editor component.
 *
 * Features: syntax highlighting, line numbers, active line, bracket matching,
 * code folding, search/replace, auto-indent, list continuation, word wrap,
 * and markdown formatting shortcuts (Cmd+B/I/K).
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars, type ViewUpdate } from "@codemirror/view"
import { EditorState, type Extension } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { html } from "@codemirror/lang-html"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, foldKeymap } from "@codemirror/language"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { closeBrackets, closeBracketsKeymap, autocompletion } from "@codemirror/autocomplete"
import { lintKeymap } from "@codemirror/lint"
import { marksenseTheme, marksenseSyntaxHighlighting } from "./source-editor-theme"

export interface SourceEditorHandle {
  view: EditorView | null
}

interface SourceEditorProps {
  value: string
  onChange: (value: string) => void
  extensions?: Extension[]
  onViewReady?: (view: EditorView | null) => void
}

function wrapWithMarkers(view: EditorView, marker: string): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  if (from === to) {
    view.dispatch({
      changes: { from, to, insert: `${marker}${marker}` },
      selection: { anchor: from + marker.length },
    })
  } else {
    const selected = state.sliceDoc(from, to)
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
      view.dispatch({
        changes: { from, to, insert: selected.slice(marker.length, -marker.length) },
        selection: { anchor: from, head: to - marker.length * 2 },
      })
    } else {
      view.dispatch({
        changes: { from, to, insert: `${marker}${selected}${marker}` },
        selection: { anchor: from + marker.length, head: to + marker.length },
      })
    }
  }
  return true
}

function insertLink(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  if (selected) {
    view.dispatch({
      changes: { from, to, insert: `[${selected}](url)` },
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: "[text](url)" },
      selection: { anchor: from + 1, head: from + 5 },
    })
  }
  return true
}

const markdownKeymap = keymap.of([
  { key: "Mod-b", run: (view) => wrapWithMarkers(view, "**") },
  { key: "Mod-i", run: (view) => wrapWithMarkers(view, "*") },
  { key: "Mod-k", run: (view) => insertLink(view) },
  { key: "Mod-Shift-x", run: (view) => wrapWithMarkers(view, "~~") },
  { key: "Mod-e", run: (view) => wrapWithMarkers(view, "`") },
])

function handleEnterForLists(view: EditorView): boolean {
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)
  const lineText = line.text

  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s/)
  if (!listMatch) return false

  const indent = listMatch[1]
  const marker = listMatch[2]
  const contentAfterMarker = lineText.slice(listMatch[0].length)

  if (contentAfterMarker.trim() === "") {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "" },
    })
    return true
  }

  let nextMarker = marker
  const numMatch = marker.match(/^(\d+)\./)
  if (numMatch) {
    nextMarker = `${parseInt(numMatch[1]) + 1}.`
  }

  const insert = `\n${indent}${nextMarker} `
  view.dispatch({
    changes: { from, to: from, insert },
    selection: { anchor: from + insert.length },
  })
  return true
}

const listContinuationKeymap = keymap.of([
  { key: "Enter", run: handleEnterForLists },
])

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ value, onChange, extensions: extraExtensions = [], onViewReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onViewReadyRef = useRef(onViewReady)
    const isExternalUpdate = useRef(false)
    onChangeRef.current = onChange
    onViewReadyRef.current = onViewReady

    useImperativeHandle(ref, () => ({
      get view() { return viewRef.current },
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged && !isExternalUpdate.current) {
          onChangeRef.current(update.state.doc.toString())
        }
      })

      const state = EditorState.create({
        doc: value,
        extensions: [
          marksenseTheme,
          marksenseSyntaxHighlighting,
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          rectangularSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightSelectionMatches(),
          markdown({ htmlTagLanguage: html() }),
          EditorView.lineWrapping,
          listContinuationKeymap,
          markdownKeymap,
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...lintKeymap,
            indentWithTab,
          ]),
          updateListener,
          ...extraExtensions,
        ],
      })

      const view = new EditorView({
        state,
        parent: containerRef.current,
      })

      viewRef.current = view
      onViewReadyRef.current?.(view)

      return () => {
        view.destroy()
        viewRef.current = null
        onViewReadyRef.current?.(null)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return

      const currentContent = view.state.doc.toString()
      if (currentContent === value) return

      isExternalUpdate.current = true
      const cursorPos = Math.min(view.state.selection.main.head, value.length)
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
        selection: { anchor: cursorPos },
      })
      isExternalUpdate.current = false
    }, [value])

    return <div ref={containerRef} className="source-editor-container" />
  }
)
