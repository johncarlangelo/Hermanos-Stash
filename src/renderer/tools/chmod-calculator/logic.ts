/**
 * Unix file permissions (chmod) calculation and parser logic
 */

export interface ChmodState {
  // Owner (u)
  ownerRead: boolean
  ownerWrite: boolean
  ownerExecute: boolean

  // Group (g)
  groupRead: boolean
  groupWrite: boolean
  groupExecute: boolean

  // Others / Public (o)
  othersRead: boolean
  othersWrite: boolean
  othersExecute: boolean

  // Special bits
  suid: boolean // Setuid (4000)
  sgid: boolean // Setgid (2000)
  sticky: boolean // Sticky bit (1000)
}

export const DEFAULT_CHMOD_STATE: ChmodState = {
  ownerRead: true,
  ownerWrite: true,
  ownerExecute: true,
  groupRead: true,
  groupWrite: false,
  groupExecute: true,
  othersRead: true,
  othersWrite: false,
  othersExecute: true,
  suid: false,
  sgid: false,
  sticky: false
}

/**
 * Calculate 3-digit or 4-digit octal representation
 */
export function getOctalString(state: ChmodState, includeSpecial = false): string {
  const u = (state.ownerRead ? 4 : 0) + (state.ownerWrite ? 2 : 0) + (state.ownerExecute ? 1 : 0)
  const g = (state.groupRead ? 4 : 0) + (state.groupWrite ? 2 : 0) + (state.groupExecute ? 1 : 0)
  const o = (state.othersRead ? 4 : 0) + (state.othersWrite ? 2 : 0) + (state.othersExecute ? 1 : 0)

  const s = (state.suid ? 4 : 0) + (state.sgid ? 2 : 0) + (state.sticky ? 1 : 0)

  if (s > 0 || includeSpecial) {
    return `${s}${u}${g}${o}`
  }
  return `${u}${g}${o}`
}

/**
 * Calculate 9-character or 10-character symbolic representation (e.g. -rwxr-xr-x)
 */
export function getSymbolicString(state: ChmodState, isDirectory = false): string {
  let uExec = state.ownerExecute ? 'x' : '-'
  if (state.suid) uExec = state.ownerExecute ? 's' : 'S'

  let gExec = state.groupExecute ? 'x' : '-'
  if (state.sgid) gExec = state.groupExecute ? 's' : 'S'

  let oExec = state.othersExecute ? 'x' : '-'
  if (state.sticky) oExec = state.othersExecute ? 't' : 'T'

  const type = isDirectory ? 'd' : '-'
  const uStr = `${state.ownerRead ? 'r' : '-'}${state.ownerWrite ? 'w' : '-'}${uExec}`
  const gStr = `${state.groupRead ? 'r' : '-'}${state.groupWrite ? 'w' : '-'}${gExec}`
  const oStr = `${state.othersRead ? 'r' : '-'}${state.othersWrite ? 'w' : '-'}${oExec}`

  return `${type}${uStr}${gStr}${oStr}`
}

/**
 * Calculate binary representation (e.g. 111 101 101)
 */
export function getBinaryString(state: ChmodState): string {
  const u = `${state.ownerRead ? '1' : '0'}${state.ownerWrite ? '1' : '0'}${state.ownerExecute ? '1' : '0'}`
  const g = `${state.groupRead ? '1' : '0'}${state.groupWrite ? '1' : '0'}${state.groupExecute ? '1' : '0'}`
  const o = `${state.othersRead ? '1' : '0'}${state.othersWrite ? '1' : '0'}${state.othersExecute ? '1' : '0'}`
  return `${u} ${g} ${o}`
}

/**
 * Parse octal string (e.g. "755" or "0755" or "4755") into ChmodState
 */
export function parseOctal(octal: string): ChmodState | null {
  const clean = octal.trim()
  if (!/^[0-7]{3,4}$/.test(clean)) return null

  let special = 0
  let u: number
  let g: number
  let o: number

  if (clean.length === 4) {
    special = parseInt(clean[0], 10)
    u = parseInt(clean[1], 10)
    g = parseInt(clean[2], 10)
    o = parseInt(clean[3], 10)
  } else {
    u = parseInt(clean[0], 10)
    g = parseInt(clean[1], 10)
    o = parseInt(clean[2], 10)
  }

  return {
    ownerRead: (u & 4) === 4,
    ownerWrite: (u & 2) === 2,
    ownerExecute: (u & 1) === 1,

    groupRead: (g & 4) === 4,
    groupWrite: (g & 2) === 2,
    groupExecute: (g & 1) === 1,

    othersRead: (o & 4) === 4,
    othersWrite: (o & 2) === 2,
    othersExecute: (o & 1) === 1,

    suid: (special & 4) === 4,
    sgid: (special & 2) === 2,
    sticky: (special & 1) === 1
  }
}

/**
 * Generate human-readable English explanation
 */
export function getPermissionExplanation(state: ChmodState): string[] {
  const desc: string[] = []

  const uPerms = [
    state.ownerRead && 'Read',
    state.ownerWrite && 'Write',
    state.ownerExecute && 'Execute'
  ].filter(Boolean)
  desc.push(`Owner can: ${uPerms.length ? uPerms.join(', ') : 'No access'}`)

  const gPerms = [
    state.groupRead && 'Read',
    state.groupWrite && 'Write',
    state.groupExecute && 'Execute'
  ].filter(Boolean)
  desc.push(`Group can: ${gPerms.length ? gPerms.join(', ') : 'No access'}`)

  const oPerms = [
    state.othersRead && 'Read',
    state.othersWrite && 'Write',
    state.othersExecute && 'Execute'
  ].filter(Boolean)
  desc.push(`Public/Others can: ${oPerms.length ? oPerms.join(', ') : 'No access'}`)

  if (state.suid) desc.push('SUID enabled: Runs with owner privileges')
  if (state.sgid) desc.push('SGID enabled: Runs with group privileges')
  if (state.sticky) desc.push('Sticky Bit enabled: Only file owner can delete')

  return desc
}
