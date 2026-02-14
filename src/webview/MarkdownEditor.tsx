import { useCallback, useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import { createPortal } from "react-dom"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Markdown } from "@tiptap/markdown"
import { Mention } from "@tiptap/extension-mention"
import { TaskList, TaskItem } from "@tiptap/extension-list"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import { Placeholder, Selection } from "@tiptap/extensions"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"
import { TextAlign } from "@tiptap/extension-text-align"
import { Mathematics } from "@tiptap/extension-mathematics"

import { UniqueID } from "@tiptap/extension-unique-id"
import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji"
import {
  getHierarchicalIndexes,
  TableOfContents,
} from "@tiptap/extension-table-of-contents"

// --- Hooks ---
import { useUiEditorState } from "@/hooks/use-ui-editor-state"
import { useScrollToHash } from "@/components/tiptap-ui/copy-anchor-link-button/use-scroll-to-hash"
import { useToc } from "@/components/tiptap-node/toc-node/context/toc-context"

// --- Custom Extensions ---
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { UiState } from "@/components/tiptap-extension/ui-state-extension"
import { Image } from "@/components/tiptap-node/image-node/image-node-extension"
import { NodeBackground } from "@/components/tiptap-extension/node-background-extension"
import { NodeAlignment } from "@/components/tiptap-extension/node-alignment-extension"
import { TocNode } from "@/components/tiptap-node/toc-node/extensions/toc-node-extension"
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { ListNormalizationExtension } from "@/components/tiptap-extension/list-normalization-extension"

// --- Table ---
import { TableKit } from "@/components/tiptap-node/table-node/extensions/table-node-extension"
import { TableHandleExtension } from "@/components/tiptap-node/table-node/extensions/table-handle"
import { TableHandle } from "@/components/tiptap-node/table-node/ui/table-handle/table-handle"
import { TableSelectionOverlay } from "@/components/tiptap-node/table-node/ui/table-selection-overlay"
import { TableCellHandleMenu } from "@/components/tiptap-node/table-node/ui/table-cell-handle-menu"
import { TableExtendRowColumnButtons } from "@/components/tiptap-node/table-node/ui/table-extend-row-column-button"
import "@/components/tiptap-node/table-node/styles/prosemirror-table.scss"
import "@/components/tiptap-node/table-node/styles/table-node.scss"

// --- Node Styles ---
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { EmojiDropdownMenu } from "@/components/tiptap-ui/emoji-dropdown-menu"
import { MentionDropdownMenu } from "@/components/tiptap-ui/mention-dropdown-menu"
import { SlashDropdownMenu } from "@/components/tiptap-ui/slash-dropdown-menu"
import { DragContextMenu } from "@/components/tiptap-ui/drag-context-menu"


// --- Template components ---
import { NotionEditorHeader, EditorActions } from "@/components/tiptap-templates/notion-like/notion-like-editor-header"
import { MobileToolbar } from "@/components/tiptap-templates/notion-like/notion-like-editor-mobile-toolbar"
import { NotionToolbarFloating } from "@/components/tiptap-templates/notion-like/notion-like-editor-toolbar-floating"
import { TocSidebar } from "@/components/tiptap-node/toc-node"

// --- Lib ---
import { MAX_FILE_SIZE } from "@/lib/tiptap-utils"


// --- Styles ---
import "@/components/tiptap-templates/notion-like/notion-like-editor.scss"

// --- Typewise ---
import { TypewiseIntegration } from "./extensions/TypewiseIntegration"
import { CorrectionPopup } from "./components/CorrectionPopup"

// --- VS Code bridge ---
import { vscode } from "./vscodeApi"

// --- Diff ---
import { DiffProvider, useDiff } from "./DiffContext"
import { DiffHighlight, diffHighlightKey } from "./extensions/DiffHighlightExtension"
import "./components/DiffView.scss"

// --- Frontmatter & MDX ---
import {
  parseFrontmatter,
  serializeFrontmatter,
  wrapJsxComponents,
  unwrapJsxComponents,
  type FrontmatterEntry,
} from "./frontmatterUtils"
import { FrontmatterPanel } from "./components/FrontmatterPanel"
import { MdxTag } from "./extensions/MdxTagExtension"

// ─── Image helpers ───────────────────────────────────────────────────────────

/** The webview URI for the document's directory (set by the extension host). */
const documentDirWebviewUri: string =
  (window as any).__SETTINGS__?.documentDirWebviewUri || ""

/**
 * Replace relative image paths in a markdown string with absolute webview URIs
 * so that `<img>` elements in the Tiptap editor can display local files.
 */
function resolveImageUrls(markdown: string, baseUri: string): string {
  if (!baseUri) return markdown
  return markdown.replace(
    /!\[([^\]]*)\]\((\s*)([^)"\s]+)(\s*(?:"[^"]*")?\s*)\)/g,
    (match, alt, leading, url, rest) => {
      // Skip URLs that are already absolute
      if (/^(https?:|data:|vscode-webview:|vscode-resource:|file:)/.test(url))
        return match
      if (url.startsWith("/")) return match
      return `![${alt}](${leading}${baseUri}/${url}${rest})`
    }
  )
}

/**
 * Replace absolute webview URIs in a markdown string with relative paths
 * so that the stored markdown is portable and doesn't contain webview-specific URLs.
 */
function unresolveImageUrls(markdown: string, baseUri: string): string {
  if (!baseUri) return markdown
  const escaped = baseUri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return markdown.replace(new RegExp(escaped + "/", "g"), "")
}

/**
 * Create an image upload handler that sends files to the extension host
 * for saving to disk, and returns the webview-displayable URL.
 */
function createImageUploadHandler(): (
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal
) => Promise<string> {
  return (file, onProgress, abortSignal) => {
    return new Promise<string>((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided"))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        reject(
          new Error(
            `File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`
          )
        )
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (abortSignal?.aborted) {
          reject(new Error("Upload cancelled"))
          return
        }

        const base64Data = (reader.result as string).split(",")[1]
        const requestId = crypto.randomUUID()

        onProgress?.({ progress: 30 })

        // Listen for the extension host response
        const handler = (event: MessageEvent) => {
          const msg = event.data
          if (msg.type === "uploadImageResult" && msg.id === requestId) {
            window.removeEventListener("message", handler)
            if (msg.error) {
              reject(new Error(msg.error))
            } else {
              onProgress?.({ progress: 100 })
              // Return the webview URI so the image renders in the editor.
              // When the editor serialises to markdown the URL will be
              // converted back to a relative path by unresolveImageUrls.
              const webviewUrl = documentDirWebviewUri
                ? `${documentDirWebviewUri}/${msg.relativePath}`
                : msg.relativePath
              resolve(webviewUrl)
            }
          }
        }
        window.addEventListener("message", handler)

        vscode.postMessage({
          type: "uploadImage",
          id: requestId,
          data: base64Data,
          filename: file.name,
        })
        onProgress?.({ progress: 50 })

        // Safety timeout
        setTimeout(() => {
          window.removeEventListener("message", handler)
          reject(new Error("Image upload timed out"))
        }, 30_000)
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }
}

/** Singleton upload handler (created once, reused across uploads). */
const handleImageUpload = createImageUploadHandler()

/**
 * Content area that renders the editor with all menus and toolbars.
 * Expects to be inside an EditorContext.Provider.
 */
function MarkdownEditorContent({ editor }: { editor: any }) {
  const {
    isDragging,
  } = useUiEditorState(editor)

  useScrollToHash()

  if (!editor) return null

  return (
    <EditorContent
      editor={editor}
      role="presentation"
      className="notion-like-editor-content"
      style={{ cursor: isDragging ? "grabbing" : "auto" }}
    >
      <DragContextMenu />
      <EmojiDropdownMenu />
      <MentionDropdownMenu />
      <SlashDropdownMenu />
      <NotionToolbarFloating />
      {createPortal(<MobileToolbar />, document.body)}
    </EditorContent>
  )
}

// ─── Loading Spinner ─────────────────────────────────────────────────────────

function LoadingSpinner({ text = "Loading editor..." }: { text?: string }) {
  return (
    <div className="spinner-container">
      <div className="spinner-content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <div className="spinner-loading-text">{text}</div>
      </div>
    </div>
  )
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export function MarkdownEditor() {
  return (
    <DiffProvider>
      <MarkdownEditorInner />
    </DiffProvider>
  )
}

function MarkdownEditorInner() {
  const isExternalUpdate = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setTocContent } = useToc()
  const { isDiffMode, headContent, setHeadContent, exitDiffMode } = useDiff()

  // --- Parse the initial file content into frontmatter + body (once) ---
  const [initialParsed] = useState(() => {
    const raw = window.__INITIAL_CONTENT__ || ""
    const parsed = parseFrontmatter(raw)
    const wrapped = wrapJsxComponents(parsed.body)
    return {
      ...parsed,
      processedBody: resolveImageUrls(wrapped, documentDirWebviewUri),
    }
  })

  const [currentMarkdown, setCurrentMarkdown] = useState(
    window.__INITIAL_CONTENT__ || ""
  )
  const [frontmatter, setFrontmatter] = useState<FrontmatterEntry[] | null>(
    initialParsed.frontmatter
  )
  // Ref so the editor onUpdate callback always has the latest frontmatter
  const frontmatterRef = useRef(initialParsed.frontmatter)
  // Preserve the raw YAML so we can round-trip without changing quote style etc.
  // Set to null when the user edits frontmatter values (forces re-serialisation).
  const rawFrontmatterRef = useRef(initialParsed.rawFrontmatter)

  const [rawMode, setRawMode] = useState(false)
  const [rawContent, setRawContent] = useState("")
  const rawContentOriginal = useRef("")

  const typewiseToken = window.__SETTINGS__?.typewiseToken || ""

  // Buffer of recently sent content so we can detect echoed updates
  // (VS Code sends the content back after writing it to disk).
  // A Set rather than a single ref because the user may keep typing,
  // causing multiple sends before the first echo arrives.
  const sentToHostBufferRef = useRef(new Set<string>())

  const editor = useEditor({
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "notion-like-editor",
        spellcheck: "true",
        autocorrect: "on",
      },
    },
    extensions: [
      StarterKit.configure({
        // Keep undo/redo enabled (template disables it for collab)
        horizontalRule: false,
        dropcursor: { width: 2 },
        link: { openOnClick: false },
      }),
      // --- Markdown bidirectional support ---
      Markdown,
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: 'Type "/" for commands...',
        emptyNodeClass: "is-empty with-slash",
      }),
      Mention,
      Emoji.configure({
        emojis: gitHubEmojis.filter(
          (emoji) => !emoji.name.includes("regional")
        ),
        forceFallbackImages: true,
      }),
      TableKit.configure({
        table: { resizable: true, cellMinWidth: 120 },
      }),
      NodeBackground.configure({
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "taskList",
          "bulletList",
          "orderedList",
          "tableCell",
          "tableHeader",
          "tocNode",
        ],
      }),
      NodeAlignment,
      TextStyle,
      Mathematics,
      Superscript,
      Subscript,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Selection,
      Image,
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate(content) {
          setTocContent(content)
        },
      }),
      TableHandleExtension,
      ListNormalizationExtension,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error: Error) => console.error("Upload failed:", error),
      }),
      UniqueID.configure({
        types: [
          "table",
          "paragraph",
          "bulletList",
          "orderedList",
          "taskList",
          "heading",
          "blockquote",
          "codeBlock",
          "tocNode",
        ],
      }),
      Typography,
      UiState,
      TocNode.configure({ topOffset: 48 }),
      // --- Diff highlight (inline decorations) ---
      DiffHighlight,
      // --- MDX tag atoms (non-editable JSX tag chips) ---
      MdxTag,
      // --- Typewise: autocorrection + inline predictions ---
      TypewiseIntegration.configure({
        apiToken: typewiseToken,
        languages: ["en", "de", "fr"],
        autocorrect: true,
        predictions: true,
      }),
    ],
    // --- Initial content: body only (frontmatter is handled separately) ---
    content: initialParsed.processedBody,
    // @ts-ignore — contentType available via @tiptap/markdown
    contentType: "markdown",
    // --- Sync edits back to VS Code ---
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdate.current) return

      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        // @ts-ignore — getMarkdown available via @tiptap/markdown
        const md = ed.getMarkdown()
        // Restore JSX blocks, convert webview URIs to relative paths,
        // and prepend frontmatter before syncing.
        const restoredBody = unresolveImageUrls(
          unwrapJsxComponents(md),
          documentDirWebviewUri
        )
        const full = serializeFrontmatter(
          frontmatterRef.current,
          restoredBody,
          rawFrontmatterRef.current
        )
        setCurrentMarkdown(full)
        sentToHostBufferRef.current.add(full)
        if (sentToHostBufferRef.current.size > 10) {
          sentToHostBufferRef.current.delete(sentToHostBufferRef.current.values().next().value)
        }
        vscode.postMessage({ type: "edit", content: full })
      }, 150)
    },
  })

  // --- Triple-click to select block (DOM-level handler) ----
  // ProseMirror tracks its own click counter on mousedown, but React
  // re-renders between clicks can disrupt it. This handler runs in the
  // capture phase before ProseMirror sees the event, tracks clicks
  // manually, and forces the block selection on the third click.
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom

    let clickCount = 0
    let lastTime = 0
    let lastX = 0
    let lastY = 0

    const onMouseDown = (e: MouseEvent) => {
      const now = Date.now()
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      const isNear = dx * dx + dy * dy < 100

      if (now - lastTime < 500 && isNear && e.button === 0) {
        clickCount++
      } else {
        clickCount = 1
      }
      lastTime = now
      lastX = e.clientX
      lastY = e.clientY

      if (clickCount >= 3) {
        // Prevent ProseMirror from processing this as a single click
        e.stopPropagation()
        e.preventDefault()

        const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
        if (pos) {
          const $pos = editor.state.doc.resolve(pos.pos)
          editor.view.dispatch(
            editor.state.tr.setSelection(
              TextSelection.create(editor.state.doc, $pos.start(), $pos.end())
            )
          )
        }
        // Reset counter so further rapid clicks don't keep firing
        clickCount = 0
      }
    }

    // Capture phase so we run BEFORE ProseMirror's bubble-phase listener
    dom.addEventListener("mousedown", onMouseDown, { capture: true })
    return () => dom.removeEventListener("mousedown", onMouseDown, { capture: true })
  }, [editor])

  // --- Place a collapsed cursor at the start without visually focusing ---
  // This avoids accidentally creating a node selection that highlights
  // the first block (e.g. a heading) when nothing is selected.
  useEffect(() => {
    if (!editor) return
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return
      try {
        const { doc } = editor.state
        // Find the first valid text cursor position (usually pos 1)
        const sel = TextSelection.near(doc.resolve(1))
        const tr = editor.state.tr.setSelection(sel)
        tr.setMeta("addToHistory", false)
        editor.view.dispatch(tr)
      } catch {
        // ignore — editor may not have focusable content
      }
    })
  }, [editor])

  // --- Listen for external content updates from VS Code ---
  //
  // VS Code sends "update" messages in two scenarios:
  //   1. Echo: the webview edited content → VS Code wrote it to disk →
  //      file watcher detected the change → VS Code sends it back.
  //   2. External change: another process (git, formatter, user editing
  //      the raw file) modified the file on disk.
  //
  // For case 1 we must skip setContent — it replaces the entire ProseMirror
  // document, destroying the cursor position and any in-flight autocorrections.
  // We detect echoes by checking sentToHostBufferRef (a Set of recently sent
  // content strings). When the user types fast or autocorrections fire between
  // sends, multiple versions may be in flight simultaneously; the Set ensures
  // we recognise any of them.
  //
  // For case 2 we apply setContent and restore the cursor to its previous
  // position (clamped to the new document size).
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const message = event.data
      if (message.type === "update" && editor && !editor.isDestroyed) {
        // Re-parse frontmatter from the incoming full-file content
        const parsed = parseFrontmatter(message.content)
        setFrontmatter(parsed.frontmatter)
        frontmatterRef.current = parsed.frontmatter
        rawFrontmatterRef.current = parsed.rawFrontmatter

        // Skip setContent when this is just an echo of our own edit —
        // VS Code writes the file and sends the content back, but the
        // document already has this content. Replacing it would destroy
        // the cursor position and cause a visible flicker.
        if (sentToHostBufferRef.current.has(message.content)) {
          sentToHostBufferRef.current.delete(message.content)
          setCurrentMarkdown(message.content)
          return
        }

        const processedBody = resolveImageUrls(
          wrapJsxComponents(parsed.body),
          documentDirWebviewUri
        )

        isExternalUpdate.current = true
        const cursorBefore = editor.state.selection.anchor
        // Temporarily wrap dispatch so the setContent transaction is
        // marked as non-undoable (external syncs shouldn't pollute undo stack)
        const origDispatch = editor.view.dispatch.bind(editor.view)
        editor.view.dispatch = (tr: any) => {
          tr.setMeta("addToHistory", false)
          origDispatch(tr)
        }
        // @ts-ignore — contentType option provided by @tiptap/markdown
        editor.commands.setContent(processedBody, {
          contentType: "markdown",
          emitUpdate: false,
        })
        setCurrentMarkdown(message.content)
        editor.view.dispatch = origDispatch

        // Restore cursor position — setContent replaces the whole document
        // and loses the selection. Clamp to new doc size in case it shrank.
        try {
          const newDoc = editor.state.doc
          const clampedPos = Math.min(cursorBefore, newDoc.content.size)
          const sel = TextSelection.near(newDoc.resolve(clampedPos))
          const restoreTr = editor.state.tr.setSelection(sel)
          restoreTr.setMeta("addToHistory", false)
          editor.view.dispatch(restoreTr)
        } catch { /* doc structure may differ too much — accept the jump */ }
        console.debug("[Typewise] external content sync (real change) — cursor:", { before: cursorBefore, after: editor.state.selection.anchor, docSize: editor.state.doc.content.size })
        requestAnimationFrame(() => {
          isExternalUpdate.current = false
        })
      }

      // --- Diff: receive HEAD content from extension host ---
      if (message.type === "diffContent") {
        setHeadContent(message.content ?? null)
      }
    },
    [editor, setHeadContent]
  )

  // --- Request diff content when diff mode is toggled on ---
  useEffect(() => {
    if (isDiffMode) {
      vscode.postMessage({ type: "requestDiff" })
    } else if (editor && !editor.isDestroyed) {
      // Deactivate diff decorations
      editor.view.dispatch(
        editor.state.tr.setMeta(diffHighlightKey, { type: "deactivate" })
      )
    }
  }, [isDiffMode, editor])

  // --- Activate diff decorations when HEAD content arrives ---
  useEffect(() => {
    if (isDiffMode && headContent !== null && editor && !editor.isDestroyed) {
      // @ts-ignore — getMarkdown available via @tiptap/markdown
      const md = editor.getMarkdown()
      editor.view.dispatch(
        editor.state.tr.setMeta(diffHighlightKey, {
          type: "activate",
          headContent,
          currentMarkdown: md,
        })
      )
    }
  }, [isDiffMode, headContent, editor])

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // ── Raw markdown toggle ────────────────────────────────────────────
  const handleToggleRawMode = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    if (!rawMode) {
      // Diff view is not supported in raw mode, so exit it first
      if (isDiffMode) exitDiffMode()

      // Entering raw mode: show the full file content (frontmatter + body)
      // with relative image paths (not webview URIs).
      // @ts-ignore — getMarkdown available via @tiptap/markdown
      const md = editor.getMarkdown()
      const restoredBody = unresolveImageUrls(
        unwrapJsxComponents(md),
        documentDirWebviewUri
      )
      const full = serializeFrontmatter(
        frontmatterRef.current,
        restoredBody,
        rawFrontmatterRef.current
      )
      setRawContent(full)
      rawContentOriginal.current = full
    } else {
      // Leaving raw mode: re-parse frontmatter + JSX and update editor
      if (rawContent !== rawContentOriginal.current) {
        const parsed = parseFrontmatter(rawContent)
        const processedBody = resolveImageUrls(
          wrapJsxComponents(parsed.body),
          documentDirWebviewUri
        )
        setFrontmatter(parsed.frontmatter)
        frontmatterRef.current = parsed.frontmatter
        rawFrontmatterRef.current = parsed.rawFrontmatter

        isExternalUpdate.current = true
        // @ts-ignore — contentType option provided by @tiptap/markdown
        editor.commands.setContent(processedBody, {
          contentType: "markdown",
          emitUpdate: false,
        })
        requestAnimationFrame(() => {
          isExternalUpdate.current = false
        })
      }
    }
    setRawMode((prev) => !prev)
  }, [editor, rawMode, rawContent, isDiffMode, exitDiffMode])

  // ── Frontmatter change handler ─────────────────────────────────────
  const handleFrontmatterChange = useCallback(
    (entries: FrontmatterEntry[]) => {
      setFrontmatter(entries)
      frontmatterRef.current = entries
      // User edited frontmatter → discard raw YAML, force re-serialisation
      rawFrontmatterRef.current = null

      // Sync the full file content to VS Code (frontmatter + body)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        // @ts-ignore — getMarkdown available via @tiptap/markdown
        const md = editor && !editor.isDestroyed ? editor.getMarkdown() : ""
        const restoredBody = unresolveImageUrls(
          unwrapJsxComponents(md),
          documentDirWebviewUri
        )
        const full = serializeFrontmatter(entries, restoredBody, null)
        setCurrentMarkdown(full)
        sentToHostBufferRef.current.add(full)
        if (sentToHostBufferRef.current.size > 10) {
          sentToHostBufferRef.current.delete(sentToHostBufferRef.current.values().next().value)
        }
        vscode.postMessage({ type: "edit", content: full })
      }, 150)
    },
    [editor]
  )

  if (!editor) {
    return <LoadingSpinner />
  }

  const showRaw = rawMode

  return (
    <div className="notion-like-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <NotionEditorHeader rawMode={rawMode} onToggleRawMode={handleToggleRawMode} />

        {showRaw ? (
          <div className="raw-markdown-container">
            <textarea
              className="raw-markdown-editor"
              value={rawContent}
              onChange={(e) => {
                const val = e.target.value
                setRawContent(val)

                // Sync back to VS Code with debounce
                if (debounceTimer.current) clearTimeout(debounceTimer.current)
                debounceTimer.current = setTimeout(() => {
                  vscode.postMessage({ type: "edit", content: val })
                }, 150)
              }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
        ) : (
          <>
            <div className="notion-like-editor-layout">
              <div className="notion-like-editor-content-column">
                {/* Frontmatter key-value panel (only if file has frontmatter) */}
                {frontmatter && frontmatter.length > 0 && (
                  <FrontmatterPanel
                    entries={frontmatter}
                    onChange={handleFrontmatterChange}
                  />
                )}

                <MarkdownEditorContent editor={editor} />
              </div>
              <TocSidebar topOffset={48} actions={<EditorActions rawMode={rawMode} onToggleRawMode={handleToggleRawMode} />} />
            </div>

            <TableExtendRowColumnButtons />
            <TableHandle />
            <TableSelectionOverlay
              showResizeHandles={true}
              cellMenu={(props: any) => (
                <TableCellHandleMenu
                  editor={props.editor}
                  onMouseDown={(e: any) => props.onResizeStart?.("br")(e)}
                />
              )}
            />
          </>
        )}
      </EditorContext.Provider>
      {!rawMode && <CorrectionPopup editor={editor} />}
    </div>
  )
}
