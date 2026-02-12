/**
 * Block-level diff engine for comparing two markdown documents.
 * Uses a Longest Common Subsequence (LCS) algorithm to produce
 * a merged list of added, removed, modified, and unchanged blocks.
 */

export interface Block {
  /** Raw markdown text of this block */
  text: string
  /** Normalized text for comparison (trimmed, collapsed whitespace) */
  key: string
}

export type DiffType = "added" | "removed" | "unchanged" | "modified"

export interface DiffResult {
  type: DiffType
  /** The old block (present for 'removed', 'unchanged', 'modified') */
  oldBlock?: Block
  /** The new block (present for 'added', 'unchanged', 'modified') */
  newBlock?: Block
}

/**
 * Parse a markdown string into logical blocks.
 * Splits on double newlines (blank lines) which is the standard
 * markdown block separator for paragraphs, headings, etc.
 */
export function parseBlocks(markdown: string): Block[] {
  if (!markdown || !markdown.trim()) return []

  // Split on one or more blank lines
  const rawBlocks = markdown.split(/\n{2,}/)

  return rawBlocks
    .map((text) => {
      const trimmed = text.trim()
      if (!trimmed) return null
      return {
        text: trimmed,
        key: trimmed.replace(/\s+/g, " ").toLowerCase(),
      }
    })
    .filter((b): b is Block => b !== null)
}

/**
 * Compute the LCS (Longest Common Subsequence) table between two arrays of blocks.
 * Returns a 2D array where dp[i][j] = length of LCS of oldBlocks[0..i-1] and newBlocks[0..j-1].
 */
function lcsTable(oldBlocks: Block[], newBlocks: Block[]): number[][] {
  const m = oldBlocks.length
  const n = newBlocks.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldBlocks[i - 1].key === newBlocks[j - 1].key) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

/**
 * Diff two arrays of blocks using LCS backtracking.
 * Produces a list of DiffResult entries in document order.
 */
export function diffBlocks(oldBlocks: Block[], newBlocks: Block[]): DiffResult[] {
  const dp = lcsTable(oldBlocks, newBlocks)
  const result: DiffResult[] = []

  let i = oldBlocks.length
  let j = newBlocks.length

  // Backtrack through the LCS table to build the diff
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldBlocks[i - 1].key === newBlocks[j - 1].key) {
      // Blocks match — unchanged
      result.unshift({
        type: "unchanged",
        oldBlock: oldBlocks[i - 1],
        newBlock: newBlocks[j - 1],
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // New block was added
      result.unshift({
        type: "added",
        newBlock: newBlocks[j - 1],
      })
      j--
    } else if (i > 0) {
      // Old block was removed
      result.unshift({
        type: "removed",
        oldBlock: oldBlocks[i - 1],
      })
      i--
    }
  }

  // Post-process: merge adjacent removed+added pairs into "modified" entries
  return mergeModifiedBlocks(result)
}

/**
 * Merge adjacent removed+added pairs into "modified" entries when they
 * likely represent the same block being edited rather than separate add/remove.
 */
function mergeModifiedBlocks(results: DiffResult[]): DiffResult[] {
  const merged: DiffResult[] = []

  let idx = 0
  while (idx < results.length) {
    const current = results[idx]

    // Look for removed immediately followed by added
    if (
      current.type === "removed" &&
      idx + 1 < results.length &&
      results[idx + 1].type === "added"
    ) {
      merged.push({
        type: "modified",
        oldBlock: current.oldBlock,
        newBlock: results[idx + 1].newBlock,
      })
      idx += 2
    } else {
      merged.push(current)
      idx++
    }
  }

  return merged
}

/**
 * High-level diff function: takes two markdown strings and returns the diff.
 */
export function diffMarkdown(oldMarkdown: string, newMarkdown: string): DiffResult[] {
  const oldBlocks = parseBlocks(oldMarkdown)
  const newBlocks = parseBlocks(newMarkdown)
  return diffBlocks(oldBlocks, newBlocks)
}
