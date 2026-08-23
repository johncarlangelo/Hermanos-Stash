import { describe, expect, it } from 'vitest'
import { ProgressBus } from './progress'
import type { ProgressEvent } from '../../shared/ipc'

function collect(bus: ProgressBus): ProgressEvent[] {
  const events: ProgressEvent[] = []
  bus.subscribe((e) => events.push(e))
  return events
}

describe('ProgressBus', () => {
  it('emits begin/report/done lifecycle events', () => {
    const bus = new ProgressBus()
    const events = collect(bus)
    const { id, handle } = bus.begin('starting')
    expect(id).toBeTruthy()

    handle.report(0.5, 'halfway')
    handle.done()
    expect(events.map((e) => e.status)).toEqual(['active', 'active', 'done'])
    expect(events[0]!.message).toBe('starting')
    expect(events[1]!.ratio).toBe(0.5)
    expect(events[2]!.ratio).toBe(1)
    expect(bus.activeCount).toBe(0)
  })

  it('ignores reports after completion', () => {
    const bus = new ProgressBus()
    const events = collect(bus)
    const { handle } = bus.begin()
    handle.done()
    handle.report(0.9)
    handle.fail(new Error('late'))
    // Only the initial "active" and the final "done" remain.
    expect(events.map((e) => e.status)).toEqual(['active', 'done'])
  })

  it('clamps ratios into 0..1', () => {
    const bus = new ProgressBus()
    const events = collect(bus)
    const { handle } = bus.begin()
    handle.report(1.7)
    handle.report(-0.3)
    const ratios = events
      .filter((e) => e.status === 'active' && e.ratio !== null)
      .map((e) => e.ratio)
    expect(ratios).toEqual([1, 0])
  })

  it('supports cooperative cancellation', () => {
    const bus = new ProgressBus()
    const events = collect(bus)
    const { id, handle } = bus.begin()
    expect(bus.isCancelled(id)).toBe(false)
    bus.cancel(id)
    expect(bus.isCancelled(id)).toBe(true)

    // Handler notices cancellation and stops without emitting further events.
    if (!bus.isCancelled(id)) handle.report(0.5)
    expect(events.map((e) => e.status)).toEqual(['active', 'cancelled'])
  })

  it('serializes failures into StashError payloads', () => {
    const bus = new ProgressBus()
    const events = collect(bus)
    const { handle } = bus.begin()
    handle.fail(new Error('disk exploded'))
    const last = events.at(-1)!
    expect(last.status).toBe('error')
    expect(last.error?.userMessage).not.toContain('disk exploded')
    expect(last.error?.technicalMessage).toContain('disk exploded')
  })

  it('fires cancel handlers exactly once on cancel', () => {
    const bus = new ProgressBus()
    const { id } = bus.begin()
    let calls = 0
    bus.onCancel(id, () => {
      calls += 1
    })
    bus.cancel(id)
    // Cancelling an already-finished operation must not re-fire handlers.
    bus.cancel(id)
    expect(calls).toBe(1)
    expect(bus.isCancelled(id)).toBe(true)
  })

  it('does not fire cancel handlers on done', () => {
    const bus = new ProgressBus()
    const { id, handle } = bus.begin()
    let calls = 0
    bus.onCancel(id, () => {
      calls += 1
    })
    handle.done()
    expect(calls).toBe(0)
  })
})
