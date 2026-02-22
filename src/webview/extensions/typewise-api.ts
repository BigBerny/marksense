/**
 * Shared Typewise API helpers used by both the Tiptap and CodeMirror integrations.
 *
 * The cloud API (`typewisePost`) is only used for grammar correction now.
 * Spell-check and predictions use the local SDK (see typewise-sdk-service.ts).
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CorrectionSuggestion {
  correction: string
  score: number
}

export interface CorrectionEntry {
  id: string
  from: number
  to: number
  type: "auto" | "manual"
  source: "word" | "grammar"
  originalValue: string
  currentValue: string
  suggestions: CorrectionSuggestion[]
}

// ─── API helper ───────────────────────────────────────────────────────────────

export async function typewisePost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Typewise API ${path}: ${res.status}`)
  return res.json()
}

// ─── Correction ID generator ─────────────────────────────────────────────────

let correctionIdCounter = 0

export function nextCorrectionId(): string {
  return `tw-c-${++correctionIdCounter}`
}

// ─── User dictionary (never-correct list) ─────────────────────────────────────

const DICT_STORAGE_KEY = "typewise-user-dictionary"

function loadDictionary(): Set<string> {
  try {
    const stored = localStorage.getItem(DICT_STORAGE_KEY)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch {
    return new Set()
  }
}

let userDictionary = loadDictionary()

export function addToDictionary(word: string): void {
  userDictionary.add(word.toLowerCase())
  try {
    localStorage.setItem(DICT_STORAGE_KEY, JSON.stringify([...userDictionary]))
  } catch { /* quota exceeded — ignore */ }

  // Sync the full dictionary into the local SDK so its autocorrector
  // skips user-approved words too.
  import("./typewise-sdk-service").then(({ typewiseSdk }) => {
    typewiseSdk.setUserDictionaryWords([...userDictionary])
  }).catch(() => {})
}

/** Return all user dictionary words (for syncing with the SDK on init). */
export function getUserDictionaryWords(): string[] {
  return [...userDictionary]
}

export function isInDictionary(word: string): boolean {
  return userDictionary.has(word.toLowerCase())
}

// ─── Sentence helpers ─────────────────────────────────────────────────────────

export const SENTENCE_END_PUNCTUATION = [".", "!", "?"]

export function isSentenceComplete(text: string): boolean {
  const trimmed = text.trimEnd()
  return SENTENCE_END_PUNCTUATION.some(p => trimmed.endsWith(p))
}
