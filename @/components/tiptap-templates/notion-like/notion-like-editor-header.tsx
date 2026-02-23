import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useWidthToggle } from "@/components/tiptap-templates/notion-like/notion-like-editor-width-toggle"
import { useThemeToggle, type ThemePreference } from "@/components/tiptap-templates/notion-like/notion-like-editor-theme-toggle"

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

// ─── Segmented control ───────────────────────────────────────────────────────

interface SegmentOption<T extends string> {
  value: T
  label: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  const activeIndex = options.findIndex((opt) => opt.value === value)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const prevIndexRef = useRef(activeIndex)

  // Position indicator immediately on mount (no animation)
  useLayoutEffect(() => {
    const el = indicatorRef.current
    if (!el) return
    el.style.transform = `translateX(${activeIndex * 100}%)`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animate to new position using Web Animations API with explicit keyframes
  useEffect(() => {
    const el = indicatorRef.current
    if (!el) return
    const prev = prevIndexRef.current
    prevIndexRef.current = activeIndex
    if (prev === activeIndex) return
    el.animate(
      [
        { transform: `translateX(${prev * 100}%)` },
        { transform: `translateX(${activeIndex * 100}%)` },
      ],
      { duration: 250, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
    )
    el.style.transform = `translateX(${activeIndex * 100}%)`
  }, [activeIndex])

  return (
    <div
      className="segmented-control"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      <div
        ref={indicatorRef}
        className="segmented-control-indicator"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className="segmented-control-segment"
          data-active={value === opt.value ? "" : undefined}
          onClick={() => value !== opt.value && onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Settings menu (custom dropdown, portaled to body) ───────────────────────

let globalSettingsOpen = false

function SettingsMenu({
  sourceMode,
  onToggleSourceMode,
}: {
  sourceMode: boolean
  onToggleSourceMode?: () => void
}) {
  const { isWide, toggle: toggleWidth } = useWidthToggle()
  const { theme, setTheme } = useThemeToggle()
  const [open, setOpen] = useState(globalSettingsOpen)
  const [wasAlreadyOpen] = useState(globalSettingsOpen)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    globalSettingsOpen = open
  }, [open])

  // Calculate menu position from button rect
  const updateMenuPos = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPos()
    window.addEventListener("resize", updateMenuPos)
    return () => window.removeEventListener("resize", updateMenuPos)
  }, [open, updateMenuPos])

  useEffect(() => {
    if (!open) return

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
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

  const menu = open && menuPos && createPortal(
    <div
      ref={menuRef}
      className="editor-settings-menu tiptap-popover"
      style={{
        position: "fixed",
        top: menuPos.top,
        right: menuPos.right,
        zIndex: 10000,
        transformOrigin: "top right",
        animation: wasAlreadyOpen
          ? "none"
          : "fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1), zoomIn 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {onToggleSourceMode && (
        <div className="editor-settings-row">
          <span className="editor-settings-label">Mode</span>
          <SegmentedControl
            options={[
              { value: "visual", label: "Visual" },
              { value: "markdown", label: "Markdown" },
            ]}
            value={sourceMode ? "markdown" : "visual"}
            onChange={(v) => {
              if ((v === "markdown") !== sourceMode) handleModeToggle()
            }}
            ariaLabel="Editor mode"
          />
        </div>
      )}
      <div className="editor-settings-row">
        <span className="editor-settings-label">Theme</span>
        <SegmentedControl
          options={[
            { value: "light" as ThemePreference, label: "Light" },
            { value: "dark" as ThemePreference, label: "Dark" },
            { value: "auto" as ThemePreference, label: "Auto" },
          ]}
          value={theme}
          onChange={setTheme}
          ariaLabel="Theme preference"
        />
      </div>
      <div className="editor-settings-row">
        <span className="editor-settings-label">Width</span>
        <SegmentedControl
          options={[
            { value: "default", label: "Default" },
            { value: "wide", label: "Wide" },
          ]}
          value={isWide ? "wide" : "default"}
          onChange={(v) => {
            if ((v === "wide") !== isWide) toggleWidth()
          }}
          ariaLabel="Editor width"
        />
      </div>
    </div>,
    document.body,
  )

  return (
    <>
      <Button
        ref={buttonRef}
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
      {menu}
    </>
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
