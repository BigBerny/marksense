import { useEffect, useRef, useState } from "react"
import { useWidthToggle } from "@/components/tiptap-templates/notion-like/notion-like-editor-width-toggle"

// --- UI Primitives ---
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Diff ---
import { useDiff } from "../../../../src/webview/DiffContext"

// --- Styles ---
import "@/components/tiptap-templates/notion-like/notion-like-editor-header.scss"

// ─── Icons ───────────────────────────────────────────────────────────────────

function EllipsisIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Mode toggle (segmented control) ─────────────────────────────────────────

function ModeToggle({ sourceMode, onToggle }: { sourceMode: boolean; onToggle: () => void }) {
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Editor mode">
      <button
        type="button"
        role="radio"
        aria-checked={!sourceMode}
        className="mode-toggle-segment"
        data-active={!sourceMode ? "" : undefined}
        onClick={() => sourceMode && onToggle()}
      >
        Visual
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={sourceMode}
        className="mode-toggle-segment"
        data-active={sourceMode ? "" : undefined}
        onClick={() => !sourceMode && onToggle()}
      >
        Markdown
      </button>
    </div>
  )
}

// ─── Settings menu (custom dropdown) ─────────────────────────────────────────

let globalSettingsOpen = false

function SettingsMenu({
  sourceMode,
  onToggleSourceMode,
}: {
  sourceMode: boolean
  onToggleSourceMode?: () => void
}) {
  const { isWide, toggle: toggleWidth } = useWidthToggle()
  const [open, setOpen] = useState(globalSettingsOpen)
  const [wasAlreadyOpen] = useState(globalSettingsOpen)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    globalSettingsOpen = open
  }, [open])

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleDocumentClick)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const handleModeToggle = () => {
    if (!onToggleSourceMode) return
    globalSettingsOpen = true
    onToggleSourceMode()
  }

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <Button
        type="button"
        data-style="ghost"
        aria-label="Editor settings"
        tooltip="Settings"
        showTooltip={!open}
        onClick={() => setOpen(!open)}
        data-active-state={open ? "on" : undefined}
      >
        <EllipsisIcon className="tiptap-button-icon" />
      </Button>

      {open && (
        <div
          className="editor-settings-menu tiptap-popover"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "6px",
            zIndex: 100,
            transformOrigin: "top right",
            animation: wasAlreadyOpen 
              ? "none" 
              : "fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1), zoomIn 150ms cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          {onToggleSourceMode && (
            <div className="editor-settings-row">
              <span className="editor-settings-label">Mode</span>
              <ModeToggle sourceMode={sourceMode} onToggle={handleModeToggle} />
            </div>
          )}
          <div className="editor-settings-row">
            <span className="editor-settings-label">Full width</span>
            <button
              type="button"
              className="editor-settings-check"
              role="switch"
              aria-checked={isWide}
              onClick={toggleWidth}
            >
              {isWide && <CheckIcon />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Public components ───────────────────────────────────────────────────────

export interface EditorActionsProps {
  sourceMode?: boolean
  onToggleSourceMode?: () => void
}

export function EditorActions({ sourceMode, onToggleSourceMode }: EditorActionsProps) {
  const { changeCount, isGitRepo, openDiffEditor } = useDiff()

  return (
    <>
      {isGitRepo && changeCount > 0 && (
        <button
          type="button"
          className="changes-link"
          onClick={openDiffEditor}
          aria-label="Show changes"
        >
          {changeCount} {changeCount === 1 ? "change" : "changes"}
        </button>
      )}

      <SettingsMenu sourceMode={!!sourceMode} onToggleSourceMode={onToggleSourceMode} />
    </>
  )
}

interface NotionEditorHeaderProps {
  sourceMode?: boolean
  onToggleSourceMode?: () => void
}

export function NotionEditorHeader({ sourceMode, onToggleSourceMode }: NotionEditorHeaderProps) {
  return (
    <header className="notion-like-editor-header" data-source-mode={sourceMode ? "true" : undefined}>
      <Spacer />
      <div className="notion-like-editor-header-actions">
        <EditorActions sourceMode={sourceMode} onToggleSourceMode={onToggleSourceMode} />
      </div>
    </header>
  )
}
