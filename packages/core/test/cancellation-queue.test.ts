import { describe, expect, it } from 'vitest'
import { CancellationQueue } from '../src/use-cases/cancellation-queue.js'
import type { UnansweredRequest } from '../src/domain/types.js'

function request(username: string): UnansweredRequest {
  return { username, profileUrl: `https://www.instagram.com/${username}/` }
}

const requests = [request('ada'), request('grace'), request('alan')]

describe('CancellationQueue', () => {
  it('starts at the first request', () => {
    expect(CancellationQueue.start(requests).current?.username).toBe('ada')
  })

  it('advances as requests are cancelled', () => {
    const queue = CancellationQueue.start(requests).markCancelled()

    expect(queue.current?.username).toBe('grace')
    expect(queue.progress).toEqual({ total: 3, cancelled: 1, skipped: 0, remaining: 2 })
  })

  it('advances past skipped requests without counting them as cancelled', () => {
    const queue = CancellationQueue.start(requests).markSkipped()

    expect(queue.current?.username).toBe('grace')
    expect(queue.progress).toEqual({ total: 3, cancelled: 0, skipped: 1, remaining: 2 })
  })

  it('leaves the original queue untouched when advancing', () => {
    const queue = CancellationQueue.start(requests)
    queue.markCancelled()

    expect(queue.current?.username).toBe('ada')
  })

  it('reports completion once every request is resolved', () => {
    const queue = CancellationQueue.start(requests).markCancelled().markSkipped().markCancelled()

    expect(queue.isComplete).toBe(true)
    expect(queue.current).toBeUndefined()
    expect(queue.progress).toEqual({ total: 3, cancelled: 2, skipped: 1, remaining: 0 })
  })

  it('is a no-op when advancing a finished queue', () => {
    const queue = CancellationQueue.start([request('ada')]).markCancelled()

    expect(queue.markCancelled().progress.cancelled).toBe(1)
  })

  it('collapses duplicates so an account is never queued twice', () => {
    const queue = CancellationQueue.start([request('ada'), request('ADA')])

    expect(queue.progress.total).toBe(1)
  })

  it('exposes every item with its status for list rendering', () => {
    const queue = CancellationQueue.start(requests).markCancelled()

    expect(queue.items.map((item) => [item.request.username, item.status])).toEqual([
      ['ada', 'cancelled'],
      ['grace', 'pending'],
      ['alan', 'pending'],
    ])
  })

  describe('restore', () => {
    it('resumes where the previous session stopped', () => {
      const state = CancellationQueue.start(requests).markCancelled().toState()

      const resumed = CancellationQueue.restore(state, requests)

      expect(resumed.current?.username).toBe('grace')
      expect(resumed.progress.cancelled).toBe(1)
    })

    it('survives a round trip through JSON', () => {
      const state = CancellationQueue.start(requests).markCancelled().toState()
      const parsed = JSON.parse(JSON.stringify(state)) as typeof state

      expect(CancellationQueue.restore(parsed, requests).current?.username).toBe('grace')
    })

    it('drops accounts absent from the fresh list, since they are no longer pending', () => {
      const state = CancellationQueue.start(requests).toState()

      const resumed = CancellationQueue.restore(state, [request('grace')])

      expect(resumed.progress.total).toBe(1)
      expect(resumed.current?.username).toBe('grace')
    })

    it('adds newly discovered accounts as pending', () => {
      const state = CancellationQueue.start([request('ada')])
        .markCancelled()
        .toState()

      const resumed = CancellationQueue.restore(state, [request('ada'), request('newcomer')])

      expect(resumed.progress).toEqual({ total: 2, cancelled: 1, skipped: 0, remaining: 1 })
      expect(resumed.current?.username).toBe('newcomer')
    })

    it('matches prior progress case-insensitively', () => {
      const state = CancellationQueue.start([request('Ada')])
        .markCancelled()
        .toState()

      expect(CancellationQueue.restore(state, [request('ada')]).isComplete).toBe(true)
    })
  })
})
