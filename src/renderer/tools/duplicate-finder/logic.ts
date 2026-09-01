/**
 * Duplicate file grouping, SHA-256 hash matching, and storage reclaim calculations
 */

export interface CandidateFile {
  id: string
  name: string
  size: number
  lastModified: number
  hash?: string
  buffer?: ArrayBuffer
}

export interface DuplicateGroup {
  hash: string
  size: number
  wastedBytes: number // (count - 1) * size
  files: CandidateFile[]
}

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Compute SHA-256 hash for an ArrayBuffer using Web Crypto
 */
export async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Find exact duplicates among candidate files
 */
export async function findDuplicateGroups(files: CandidateFile[]): Promise<{
  groups: DuplicateGroup[]
  totalDuplicateCount: number
  totalWastedBytes: number
}> {
  if (files.length <= 1) {
    return { groups: [], totalDuplicateCount: 0, totalWastedBytes: 0 }
  }

  // Group by size first
  const sizeBuckets: Record<number, CandidateFile[]> = {}
  for (const file of files) {
    if (!sizeBuckets[file.size]) {
      sizeBuckets[file.size] = []
    }
    sizeBuckets[file.size].push(file)
  }

  // Filter buckets with 2+ files
  const potentialDuplicates = Object.values(sizeBuckets).filter((bucket) => bucket.length > 1)

  // Compute hash for files in collision buckets
  const hashBuckets: Record<string, CandidateFile[]> = {}

  for (const bucket of potentialDuplicates) {
    for (const file of bucket) {
      let hash = file.hash
      if (!hash && file.buffer) {
        hash = await computeFileHash(file.buffer)
        file.hash = hash
      }

      if (hash) {
        if (!hashBuckets[hash]) {
          hashBuckets[hash] = []
        }
        hashBuckets[hash].push(file)
      }
    }
  }

  const duplicateGroups: DuplicateGroup[] = []
  let totalDuplicateCount = 0
  let totalWastedBytes = 0

  for (const [hash, groupFiles] of Object.entries(hashBuckets)) {
    if (groupFiles.length > 1) {
      const size = groupFiles[0].size
      const wasted = (groupFiles.length - 1) * size
      duplicateGroups.push({
        hash,
        size,
        wastedBytes: wasted,
        files: groupFiles
      })
      totalDuplicateCount += groupFiles.length - 1
      totalWastedBytes += wasted
    }
  }

  // Sort groups by wasted space descending
  duplicateGroups.sort((a, b) => b.wastedBytes - a.wastedBytes)

  return {
    groups: duplicateGroups,
    totalDuplicateCount,
    totalWastedBytes
  }
}
