/**
 * Correction suggestion popup.
 *
 * - For "manual" (red underline): shows suggestions with 1-9 shortcuts.
 * - For "auto" (blue underline): shows original word to revert + alternatives.
 * - "Never correct" option to add word to dictionary (future).
 * - Positioned below the underlined word using its DOM rect.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/core"
import {
  typewisePluginKey,
  type CorrectionEntry,
  type TypewisePluginState,
} from "../extensions/TypewiseIntegration"

// ─── Types ───────────────────────────────────────────────────────────────────

interface CorrectionPopupProps {
  editor: Editor
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CorrectionPopup({ editor }: CorrectionPopupProps) {
  const [activeCorrection, setActiveCorrection] = useState<CorrectionEntry | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Subscribe to plugin state changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const handleUpdate = () => {
      const ps = typewisePluginKey.getState(editor.state) as TypewisePluginState | undefined
      const corr = ps?.activeCorrection || null
      setActiveCorrection(corr)

      if (corr) {
        // Find the DOM element for the underline
        const el = editor.view.dom.querySelector(
          `[data-tw-correction-id="${corr.id}"]`
        )
        if (el) {
          const rect = el.getBoundingClientRect()
          setPosition({ top: rect.bottom + 4, left: rect.left })
        } else {
          setPosition(null)
        }
      } else {
        setPosition(null)
      }
    }

    editor.on("transaction", handleUpdate)
    return () => {
      editor.off("transaction", handleUpdate)
    }
  }, [editor])

  // Close popup on click outside
  useEffect(() => {
    if (!activeCorrection) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        editor.view.dispatch(
          editor.state.tr.setMeta(typewisePluginKey, { type: "close-popup" })
        )
      }
    }

    // Delay to avoid catching the click that opened the popup
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 50)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [activeCorrection, editor])

  // Handle keyboard shortcuts (1-9 to select, Esc handled by extension)
  useEffect(() => {
    if (!activeCorrection) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = parseInt(e.key)
      if (key >= 1 && key <= 9) {
        const items = getMenuItems(activeCorrection)
        const item = items[key - 1]
        if (item) {
          e.preventDefault()
          e.stopPropagation()
          applyItem(item)
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [activeCorrection])

  // ── Menu items ──

  interface MenuItem {
    label: string
    value: string
    isRecommended?: boolean
    isRevert?: boolean
  }

  const getMenuItems = useCallback(
    (corr: CorrectionEntry): MenuItem[] => {
      if (corr.type === "auto") {
        // Blue underline: show original to revert + alternatives
        const items: MenuItem[] = [
          {
            label: corr.currentValue,
            value: corr.currentValue,
            isRecommended: true,
          },
          {
            label: corr.originalValue,
            value: corr.originalValue,
            isRevert: true,
          },
        ]
        // Add remaining suggestions that aren't the current or original
        for (const s of corr.suggestions.slice(1)) {
          if (s.correction !== corr.currentValue && s.correction !== corr.originalValue) {
            items.push({ label: s.correction, value: s.correction })
          }
        }
        return items.slice(0, 9)
      } else {
        // Red underline: show suggestions
        const items: MenuItem[] = corr.suggestions.map((s, i) => ({
          label: s.correction,
          value: s.correction,
          isRecommended: i === 0,
        }))
        return items.slice(0, 9)
      }
    },
    []
  )

  const applyItem = useCallback(
    (item: MenuItem) => {
      if (!activeCorrection || editor.isDestroyed) return

      const corr = activeCorrection
      const { tr } = editor.state

      // Replace the correction text, preserving formatting
      tr.insertText(item.value, corr.from, corr.to)

      // Remove the correction from plugin state
      tr.setMeta(typewisePluginKey, { type: "apply-suggestion", id: corr.id })

      editor.view.dispatch(tr)
      editor.view.focus()
    },
    [activeCorrection, editor]
  )

  // ── Render ──

  const menuItems = useMemo(
    () => (activeCorrection ? getMenuItems(activeCorrection) : []),
    [activeCorrection, getMenuItems]
  )

  if (!activeCorrection || !position || menuItems.length === 0) return null

  const isAuto = activeCorrection.type === "auto"

  return createPortal(
    <div
      ref={popupRef}
      className="typewise-popup"
      style={{ top: position.top, left: position.left }}
    >
      <div className="typewise-popup-header">
        {isAuto ? "Auto-corrected" : "Recommended spelling"}
      </div>
      <div className="typewise-popup-items">
        {menuItems.map((item, i) => (
          <button
            key={`${item.value}-${i}`}
            className={`typewise-popup-item ${item.isRecommended ? "is-recommended" : ""} ${item.isRevert ? "is-revert" : ""}`}
            onClick={() => applyItem(item)}
          >
            <span className="typewise-popup-item-label">{item.label}</span>
            <span className="typewise-popup-item-shortcut">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="typewise-popup-footer">
        <span className="typewise-popup-footer-hint">
          <kbd>Esc</kbd> to close
        </span>
      </div>
    </div>,
    document.body
  )
}
