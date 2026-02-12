import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"

interface DiffContextValue {
  /** Whether diff mode is currently active */
  isDiffMode: boolean
  /** The HEAD content received from git (null = not yet loaded or unavailable) */
  headContent: string | null
  /** Toggle diff mode on/off */
  toggleDiffMode: () => void
  /** Set the HEAD content received from the extension host */
  setHeadContent: (content: string | null) => void
  /** Exit diff mode */
  exitDiffMode: () => void
}

const DiffContext = createContext<DiffContextValue | null>(null)

export function DiffProvider({ children }: { children: ReactNode }) {
  const [isDiffMode, setIsDiffMode] = useState(false)
  const [headContent, setHeadContent] = useState<string | null>(null)

  const toggleDiffMode = useCallback(() => {
    setIsDiffMode((prev) => !prev)
  }, [])

  const exitDiffMode = useCallback(() => {
    setIsDiffMode(false)
    setHeadContent(null)
  }, [])

  return (
    <DiffContext.Provider
      value={{
        isDiffMode,
        headContent,
        toggleDiffMode,
        setHeadContent,
        exitDiffMode,
      }}
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
