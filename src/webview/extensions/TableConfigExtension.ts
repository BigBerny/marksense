import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { TableConfigBlock } from "../components/TableConfigBlock"
import { parseTableConfigTag } from "./tableConfigUtils"
import { createTableConfigPlugin } from "./TableConfigPlugin"

/**
 * Decode HTML entities produced by `htmlEncode` in frontmatterUtils.ts.
 */
function htmlDecode(str: string): string {
  return str
    .replace(/&#13;/g, "\r")
    .replace(/&#10;/g, "\n")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
}

/**
 * TableConfig — a non-editable atom node representing a `<TableConfig ... />`
 * MDX tag.  It defines column types (select, multiselect, boolean) for the
 * immediately following table.
 *
 * The raw JSX tag string is stored in the `tag` attribute for round-trip
 * fidelity.  The parsed config is stored as a JSON string in the `config`
 * attribute for efficient runtime access.
 */
export const TableConfig = Node.create({
  name: "tableConfig",

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      tag: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-tag") || "",
        renderHTML: (attrs: { tag: string }) => ({
          "data-tag": attrs.tag,
        }),
      },
      config: {
        default: "{}",
        parseHTML: (element: HTMLElement) => {
          const encoded = element.getAttribute("data-tag") || ""
          const decoded = htmlDecode(encoded)
          const config = parseTableConfigTag(decoded)
          return JSON.stringify(config)
        },
        renderHTML: () => ({}), // Not rendered in HTML — derived from tag
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="table-config"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "table-config" }, HTMLAttributes),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableConfigBlock)
  },

  renderMarkdown(node: any) {
    const tag = node.attrs?.tag || ""
    const encoded = tag
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "&#10;")
      .replace(/\r/g, "&#13;")
    return `<div data-type="table-config" data-tag="${encoded}"></div>\n\n`
  },

  addProseMirrorPlugins() {
    return [createTableConfigPlugin(this.editor)]
  },
})
