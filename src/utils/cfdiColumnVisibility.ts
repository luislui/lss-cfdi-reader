const STORAGE_KEY = 'lss-cfdi-reader-hidden-columns'

export function getHiddenColumnIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? parsed : []
  } catch {
    return []
  }
}

export function setHiddenColumnIds(hiddenIds: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenIds))
  } catch {
    // localStorage full or disabled
  }
}
