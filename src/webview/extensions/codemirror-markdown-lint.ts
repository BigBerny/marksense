/**
 * Lightweight Markdown linter for CodeMirror 6.
 *
 * Checks common markdown issues and reports them as CodeMirror diagnostics
 * with inline squiggly underlines and hover tooltips.
 */

import { linter, type Diagnostic } from "@codemirror/lint"

interface LintRule {
  id: string
  check: (text: string, lines: string[]) => LintResult[]
}

interface LintResult {
  line: number
  from: number
  to: number
  message: string
  severity: "warning" | "error" | "info"
}

const rules: LintRule[] = [
  {
    id: "MD009",
    check(_text, lines) {
      const results: LintResult[] = []
      let pos = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(/(\s+)$/)
        if (match && line.trim().length > 0) {
          results.push({
            line: i + 1,
            from: pos + line.length - match[1].length,
            to: pos + line.length,
            message: "Trailing whitespace",
            severity: "warning",
          })
        }
        pos += line.length + 1
      }
      return results
    },
  },
  {
    id: "MD012",
    check(_text, lines) {
      const results: LintResult[] = []
      let pos = 0
      let consecutiveBlanks = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim() === "") {
          consecutiveBlanks++
          if (consecutiveBlanks > 1) {
            results.push({
              line: i + 1,
              from: pos,
              to: pos + line.length || pos + 1,
              message: "Multiple consecutive blank lines",
              severity: "warning",
            })
          }
        } else {
          consecutiveBlanks = 0
        }
        pos += line.length + 1
      }
      return results
    },
  },
  {
    id: "MD022",
    check(_text, lines) {
      const results: LintResult[] = []
      let pos = 0
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const prevLine = lines[i - 1]
        if (/^#{1,6}\s/.test(line) && prevLine.trim() !== "" && !/^#{1,6}\s/.test(prevLine) && !/^---/.test(prevLine)) {
          results.push({
            line: i + 1,
            from: pos,
            to: pos + line.length,
            message: "Heading should be preceded by a blank line",
            severity: "warning",
          })
        }
        pos += lines[i - 1].length + 1
      }
      return results
    },
  },
  {
    id: "MD019",
    check(_text, lines) {
      const results: LintResult[] = []
      let pos = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(/^(#{1,6})\s{2,}/)
        if (match) {
          results.push({
            line: i + 1,
            from: pos + match[1].length,
            to: pos + match[0].length,
            message: "Multiple spaces after heading marker",
            severity: "warning",
          })
        }
        pos += line.length + 1
      }
      return results
    },
  },
  {
    id: "MD047",
    check(text, _lines) {
      if (text.length > 0 && !text.endsWith("\n")) {
        return [{
          line: text.split("\n").length,
          from: text.length,
          to: text.length,
          message: "File should end with a newline character",
          severity: "info",
        }]
      }
      return []
    },
  },
  {
    id: "MD032",
    check(_text, lines) {
      const results: LintResult[] = []
      let pos = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const isList = /^\s*([-*+]|\d+\.)\s/.test(line)

        if (isList && i > 0) {
          const prevLine = lines[i - 1]
          const prevIsList = /^\s*([-*+]|\d+\.)\s/.test(prevLine)
          if (prevLine.trim() !== "" && !prevIsList && !/^#{1,6}\s/.test(prevLine)) {
            results.push({
              line: i + 1,
              from: pos,
              to: pos + line.length,
              message: "List should be preceded by a blank line",
              severity: "info",
            })
          }
        }
        pos += line.length + 1
      }
      return results
    },
  },
]

export const markdownLinter = linter(
  (view) => {
    const text = view.state.doc.toString()
    const lines = text.split("\n")
    const diagnostics: Diagnostic[] = []

    for (const rule of rules) {
      const results = rule.check(text, lines)
      for (const r of results) {
        const from = Math.min(r.from, text.length)
        const to = Math.min(Math.max(r.to, from), text.length)
        if (from === to && from === text.length) {
          diagnostics.push({
            from: Math.max(0, from - 1),
            to: from,
            message: `${rule.id}: ${r.message}`,
            severity: r.severity,
          })
        } else {
          diagnostics.push({
            from,
            to,
            message: `${rule.id}: ${r.message}`,
            severity: r.severity,
          })
        }
      }
    }

    return diagnostics
  },
  { delay: 500 }
)
