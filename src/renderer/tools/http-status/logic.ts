/**
 * Pure filtering and classification helpers over the HTTP status table.
 */

import { HTTP_STATUSES, type HttpStatusEntry, type StatusClass } from './data'

/** The class (1–5) a status code belongs to; 0 for invalid input. */
export function classOf(code: number | string): StatusClass | 0 {
  const n = typeof code === 'string' ? Number(code) : code
  if (!Number.isInteger(n)) return 0
  if (n < 100 || n > 599) return 0
  return Math.floor(n / 100) as StatusClass
}

/** Filter statuses by a query matched against the code or any text. */
export function filterStatuses(
  list: HttpStatusEntry[],
  query: string
): { matches: HttpStatusEntry[]; byClass: Record<StatusClass, HttpStatusEntry[]> } {
  const q = query.trim().toLowerCase()
  const matches = q
    ? list.filter(
        ({ code, name, meaning }) =>
          String(code).includes(q) ||
          name.toLowerCase().includes(q) ||
          meaning.toLowerCase().includes(q)
      )
    : list

  return {
    matches,
    byClass: groupByClass(matches)
  }
}

export function groupByClass(list: HttpStatusEntry[]): Record<StatusClass, HttpStatusEntry[]> {
  const grouped: Record<StatusClass, HttpStatusEntry[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: []
  }
  for (const entry of list) {
    grouped[Math.floor(entry.code / 100) as StatusClass].push(entry)
  }
  return grouped
}

export { HTTP_STATUSES }
