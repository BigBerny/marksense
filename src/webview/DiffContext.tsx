import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { vscode } from "./vscodeApi"

interface DiffContextValue {
  /** Number of changed lines compared to HEAD */
  changeCount: number
  /** Whether the file is inside a git repository */
  isGitRepo: boolean
  /** Open VS Code's built-in diff editor */
  openDiffEditor: () => void
  /** Set the change count (called when extension host sends diffCount) */
  setChangeCount: (count: number) => void
}

const DiffContext = createContext<DiffContextValue | null>(null)

export function DiffProvider({
  isGitRepo = false,
  children,
}: {
  isGitRepo?: boolean
  children: ReactNode
}) {
  const [changeCount, setChangeCount] = useState(0)

  const openDiffEditor = useCallback(() => {
    vscode.postMessage({ type: "openBuiltinDiff" })
  }, [])

  return (
    <DiffContext.Provider
      value={{ changeCount, isGitRepo, openDiffEditor, setChangeCount }}
    >
      {children}
    </DiffContext.Provider>
  )
}

export function useDiff(): DiffContextValue {
  const ctx = useContext(DiffContext)
  if (!ctx) {
    throw new Error("useDiff must be used within a DiffProvider")
  }
  return ctx
}
