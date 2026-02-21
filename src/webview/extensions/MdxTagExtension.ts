import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { MdxTagBlock } from "../components/MdxTagBlock"

/**
 * MdxTag — a non-editable atom node that represents a single JSX tag line
 * (opening, closing, or self-closing) in an MDX file.
 *
 * The content between JSX tags is regular markdown handled by TipTap as usual.
 * Only the tag lines themselves are rendered as styled, non-editable chips.
 */
export const MdxTag = Node.create({
  name: "mdxTag",

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
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mdx-tag"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "mdx-tag" }, HTMLAttributes),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MdxTagBlock)
  },

  renderMarkdown(node: any) {
    const tag = node.attrs?.tag || ""
    const encoded = tag
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    return `<div data-type="mdx-tag" data-tag="${encoded}"></div>\n\n`
  },
})
