import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import type { ParsedTableConfig } from "../extensions/tableConfigUtils"
import "./TableConfigBlock.scss"

/**
 * Renders a `<TableConfig>` atom node as a compact, non-editable summary chip.
 * Shows the column names and their types.
 */
export function TableConfigBlock({ node }: NodeViewProps) {
  const configJson = node.attrs.config || "{}"
  let config: ParsedTableConfig = {}
  try {
    config = JSON.parse(configJson)
  } catch {
    // Invalid config — show fallback
  }

  const columns = Object.entries(config)
  const summary = columns
    .map(([name, cfg]) => {
      const nullable = cfg.nullable ? "?" : ""
      switch (cfg.type) {
        case "singleSelect":
          return `${name} (select${nullable})`
        case "multiSelect":
          return `${name} (multi${nullable})`
        case "boolean":
          return `${name} (bool${nullable})`
        default:
          return name
      }
    })
    .join("  \u00b7  ")

  return (
    <NodeViewWrapper className="table-config-block" contentEditable={false}>
      <code className="table-config-code">
        <span className="table-config-icon">{"\u2699"}</span>
        {summary || "TableConfig"}
      </code>
    </NodeViewWrapper>
  )
}
