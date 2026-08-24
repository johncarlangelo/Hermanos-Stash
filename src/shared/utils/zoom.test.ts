import { describe, expect, it } from 'vitest'
import {
  clampZoomFactor,
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  overlayHeightFor
} from './zoom'

describe('clampZoomFactor', () => {
  it('passes values inside the supported range through untouched', () => {
    expect(clampZoomFactor(1)).toBe(1)
    expect(clampZoomFactor(1.1)).toBe(1.1)
    expect(clampZoomFactor(1.25)).toBe(1.25)
    expect(clampZoomFactor(MIN_ZOOM_FACTOR)).toBe(MIN_ZOOM_FACTOR)
    expect(clampZoomFactor(MAX_ZOOM_FACTOR)).toBe(MAX_ZOOM_FACTOR)
  })

  it('clamps out-of-range values to the range bounds', () => {
    expect(clampZoomFactor(0.5)).toBe(MIN_ZOOM_FACTOR)
    expect(clampZoomFactor(2)).toBe(MAX_ZOOM_FACTOR)
    expect(clampZoomFactor(-3)).toBe(MIN_ZOOM_FACTOR)
  })

  it('falls back to the default for non-numeric or non-finite input', () => {
    expect(clampZoomFactor(undefined)).toBe(DEFAULT_ZOOM_FACTOR)
    expect(clampZoomFactor('1.4')).toBe(DEFAULT_ZOOM_FACTOR)
    expect(clampZoomFactor(null)).toBe(DEFAULT_ZOOM_FACTOR)
    expect(clampZoomFactor(Number.NaN)).toBe(DEFAULT_ZOOM_FACTOR)
    expect(clampZoomFactor(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ZOOM_FACTOR)
  })
})

describe('overlayHeightFor', () => {
  it('tracks 40 DIPs per zoom unit', () => {
    expect(overlayHeightFor(1)).toBe(40)
    expect(overlayHeightFor(1.1)).toBe(44)
    expect(overlayHeightFor(1.25)).toBe(50)
    expect(overlayHeightFor(0.8)).toBe(32)
  })

  it('clamps and falls back exactly like the factor itself', () => {
    expect(overlayHeightFor(5)).toBe(Math.round(40 * MAX_ZOOM_FACTOR))
    expect(overlayHeightFor(undefined)).toBe(Math.round(40 * DEFAULT_ZOOM_FACTOR))
  })
})
