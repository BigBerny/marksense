/**
 * Diff Highlight Extension
 *
 * Shows inline diffs in the Tiptap editor using ProseMirror decorations.
 * - Changed/added blocks get a green node decoration (CSS class)
 * - Old versions of changed/removed blocks are shown as non-editable
 *   widget decorations with a red background, rendered as rich HTML
 * - Character-level changes are highlighted within modified blocks
 * - The editor remains fully editable
 * - Decorations auto-refresh on every document change
 */

import { Extension } from "@tiptap/core"
import type { Editor } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  DOMSerializer,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model"
import { diffMarkdown, diffChars, type DiffResult } from "../diffEngine"

export const diffHighlightKey = new PluginKey("diffHighlight")

// ─── Plugin state ──────────────────────────────────────────────────────────

interface DiffPluginState {
  active: boolean
  headContent: string | null
  decorations: DecorationSet
}

// ─── Render a markdown block to DOM using the editor's markdown parser ─────

function renderMarkdownToDOM(
  editor: Editor,
  schema: Schema,
  markdownText: string
): DocumentFragment | null {
  try {
    const manager = (editor as any).markdown
    if (!manager || typeof manager.parse !== "function") return null

    const json = manager.parse(markdownText)
    if (!json || !json.content || json.content.length === 0) return null

    const doc = schema.nodeFromJSON(json)
    const serializer = DOMSerializer.fromSchema(schema)
    return serializer.serializeFragment(doc.content)
  } catch {
    return null
  }
}

/**
 * Get the plain text from a markdown block by parsing it to DOM then
 * reading textContent. This strips markdown syntax for accurate char diff.
 */
function getPlainTextFromMarkdown(
  editor: Editor,
  schema: Schema,
  markdownText: string
): string {
  const fragment = renderMarkdownToDOM(editor, schema, markdownText)
  if (fragment) {
    const div = document.createElement("div")
    div.appendChild(fragment.cloneNode(true))
    return div.textContent || ""
  }
  // Fallback: strip common markdown syntax
  return markdownText
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
}

// ─── Highlight character-level changes in a DOM tree ───────────────────────

/**
 * Walk all text nodes in a DOM tree, wrapping characters in the given
 * offset ranges with a highlight <span>.
 */
function highlightCharRangesInDOM(
  root: HTMLElement,
  ranges: { from: number; to: number }[],
  className: string
): void {
  if (ranges.length === 0) return

  // Collect all text nodes in order
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node)
  }

  // Map global char offsets → (textNode, localOffset)
  let globalOffset = 0
  const nodeMap: { node: Text; start: number; end: number }[] = []
  for (const tn of textNodes) {
    const len = tn.textContent?.length || 0
    nodeMap.push({ node: tn, start: globalOffset, end: globalOffset + len })
    globalOffset += len
  }

  // Process ranges in reverse order so DOM mutations don't shift offsets
  for (let r = ranges.length - 1; r >= 0; r--) {
    const { from, to } = ranges[r]

    for (let n = nodeMap.length - 1; n >= 0; n--) {
      const { node: tn, start, end } = nodeMap[n]
      // Does this range overlap with this text node?
      const overlapStart = Math.max(from, start)
      const overlapEnd = Math.min(to, end)
      if (overlapStart >= overlapEnd) continue

      const localStart = overlapStart - start
      const localEnd = overlapEnd - start
      const text = tn.textContent || ""

      // Split: [before][highlight][after]
      const before = text.slice(0, localStart)
      const highlighted = text.slice(localStart, localEnd)
      const after = text.slice(localEnd)

      const parent = tn.parentNode
      if (!parent) continue

      const frag = document.createDocumentFragment()
      if (before) frag.appendChild(document.createTextNode(before))

      const span = document.createElement("span")
      span.className = className
      span.textContent = highlighted
      frag.appendChild(span)

      if (after) frag.appendChild(document.createTextNode(after))

      parent.replaceChild(frag, tn)
    }
  }
}

// ─── Create a DOM widget for an "old" block ────────────────────────────────

function createOldBlockWidget(
  editor: Editor,
  schema: Schema,
  markdownText: string,
  charHighlightRanges?: { from: number; to: number }[]
): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.className = "diff-old-block"
  wrapper.contentEditable = "false"
  wrapper.setAttribute("data-diff-role", "old")

  const content = document.createElement("div")
  content.className = "diff-old-block-content"

  const fragment = renderMarkdownToDOM(editor, schema, markdownText)
  if (fragment) {
    content.appendChild(fragment)
  } else {
    content.textContent = markdownText
  }

  // Apply character-level highlights on the rendered DOM
  if (charHighlightRanges && charHighlightRanges.length > 0) {
    highlightCharRangesInDOM(content, charHighlightRanges, "diff-char-removed")
  }

  wrapper.appendChild(content)
  return wrapper
}

// ─── Map text offset to ProseMirror position inside a node ─────────────────

/**
 * For a block node at `nodePos`, map a plain-text offset to a ProseMirror
 * document position. Works for inline content (paragraphs, headings, etc.)
 * where marks don't consume positions.
 */
function textOffsetToPMPos(
  doc: ProseMirrorNode,
  node: ProseMirrorNode,
  nodePos: number,
  textOffset: number
): number {
  // Walk the node tree depth-first, tracking text offset
  let remaining = textOffset
  let pos = nodePos + 1 // inside the node

  function walk(n: ProseMirrorNode, startPos: number): number | null {
    if (n.isText) {
      const len = n.text?.length || 0
      if (remaining <= len) {
        return startPos + remaining
      }
      remaining -= len
      return null
    }

    let childPos = startPos
    if (!n.isLeaf) childPos += 1 // open tag

    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i)
      const result = walk(child, childPos)
      if (result !== null) return result
      childPos += child.nodeSize
    }
    return null
  }

  // For top-level block node, iterate children directly
  let childPos = pos
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    const result = walk(child, childPos)
    if (result !== null) return result
    childPos += child.nodeSize
  }

  // Fallback: end of node
  return nodePos + node.nodeSize - 1
}

// ─── Build decorations from diff results ───────────────────────────────────

function buildDecorations(
  doc: ProseMirrorNode,
  editor: Editor,
  schema: Schema,
  diffResults: DiffResult[]
): DecorationSet {
  const topLevelNodes: { node: ProseMirrorNode; pos: number }[] = []
  doc.forEach((node, offset) => {
    topLevelNodes.push({ node, pos: offset })
  })

  const decorations: Decoration[] = []
  let nodeIdx = 0

  for (const result of diffResults) {
    switch (result.type) {
      case "unchanged":
        nodeIdx++
        break

      case "added": {
        if (nodeIdx < topLevelNodes.length) {
          const { node, pos } = topLevelNodes[nodeIdx]
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: "diff-node-added",
            })
          )
        }
        nodeIdx++
        break
      }

      case "removed": {
        const insertPos =
          nodeIdx < topLevelNodes.length
            ? topLevelNodes[nodeIdx].pos
            : doc.content.size
        if (result.oldBlock) {
          decorations.push(
            Decoration.widget(
              insertPos,
              createOldBlockWidget(editor, schema, result.oldBlock.text),
              {
                side: -1,
                key: `diff-removed-${insertPos}-${result.oldBlock.key}`,
              }
            )
          )
        }
        break
      }

      case "modified": {
        if (nodeIdx < topLevelNodes.length) {
          const { node, pos } = topLevelNodes[nodeIdx]

          // Compute character-level diff between old and new plain text
          const oldPlain = result.oldBlock
            ? getPlainTextFromMarkdown(
                editor,
                schema,
                result.oldBlock.text
              )
            : ""
          const newPlain = node.textContent
          const charDiff = diffChars(oldPlain, newPlain)

          // Widget for the old version with char highlights
          if (result.oldBlock) {
            decorations.push(
              Decoration.widget(
                pos,
                createOldBlockWidget(
                  editor,
                  schema,
                  result.oldBlock.text,
                  charDiff.oldRanges
                ),
                {
                  side: -1,
                  key: `diff-old-${pos}-${result.oldBlock.key}`,
                }
              )
            )
          }

          // Node decoration for green background
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: "diff-node-modified",
            })
          )

          // Inline decorations for changed characters in the green block
          for (const range of charDiff.newRanges) {
            const from = textOffsetToPMPos(doc, node, pos, range.from)
            const to = textOffsetToPMPos(doc, node, pos, range.to)
            if (from < to && from >= pos && to <= pos + node.nodeSize) {
              decorations.push(
                Decoration.inline(from, to, {
                  class: "diff-char-added",
                })
              )
            }
          }
        }
        nodeIdx++
        break
      }
    }
  }

  return DecorationSet.create(doc, decorations)
}

// ─── Serialize a ProseMirror doc to markdown ───────────────────────────────

function serializeDocToMarkdown(
  editor: Editor,
  doc: ProseMirrorNode
): string {
  try {
    const manager = (editor as any).markdown
    if (manager && typeof manager.serialize === "function") {
      return manager.serialize(doc.toJSON()) || ""
    }
  } catch {
    // ignore
  }
  return ""
}

// ─── Extension ─────────────────────────────────────────────────────────────

export interface DiffHighlightOptions {
  /**
   * Optional function to normalize Tiptap-serialized markdown before diffing.
   * Used to convert internal representations (e.g. raw-text div wrappers,
   * resolved image URLs) back to their original form so the diff matches
   * the HEAD content format.
   */
  normalizeMarkdown?: (md: string) => string
}

export const DiffHighlight = Extension.create<DiffHighlightOptions>({
  name: "diffHighlight",

  addOptions() {
    return {}
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const normalize = this.options.normalizeMarkdown ?? ((md: string) => md)

    return [
      new Plugin({
        key: diffHighlightKey,

        state: {
          init(): DiffPluginState {
            return {
              active: false,
              headContent: null,
              decorations: DecorationSet.empty,
            }
          },

          apply(
            tr: Transaction,
            value: DiffPluginState,
            _oldState: EditorState,
            newState: EditorState
          ): DiffPluginState {
            const meta = tr.getMeta(diffHighlightKey) as
              | {
                  type: "activate"
                  headContent: string
                  currentMarkdown: string
                }
              | { type: "deactivate" }
              | undefined

            if (meta?.type === "activate") {
              const diffResults = diffMarkdown(
                meta.headContent,
                meta.currentMarkdown
              )
              const decorations = buildDecorations(
                newState.doc,
                editor,
                newState.schema,
                diffResults
              )
              return {
                active: true,
                headContent: meta.headContent,
                decorations,
              }
            }

            if (meta?.type === "deactivate") {
              return {
                active: false,
                headContent: null,
                decorations: DecorationSet.empty,
              }
            }

            // Auto-refresh on document change
            if (value.active && value.headContent && tr.docChanged) {
              const rawMarkdown = serializeDocToMarkdown(
                editor,
                newState.doc
              )
              const currentMarkdown = normalize(rawMarkdown)
              const diffResults = diffMarkdown(
                value.headContent,
                currentMarkdown
              )
              const decorations = buildDecorations(
                newState.doc,
                editor,
                newState.schema,
                diffResults
              )
              return { ...value, decorations }
            }

            return value
          },
        },

        props: {
          decorations(state: EditorState) {
            const pluginState = diffHighlightKey.getState(
              state
            ) as DiffPluginState | undefined
            return pluginState?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
