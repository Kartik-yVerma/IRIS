import { get, usePoll } from '../lib.js'

// three light 5s polls — the landing degrades to static copy when the
// backend is down (usePoll swallows failures and returns null)
export function useLandingStats() {
  const summary = usePoll(() => get('/analytics/summary'), 5000)
  const rovers = usePoll(() => get('/rovers'), 5000)
  const visionLatest = usePoll(() => get('/vision/latest'), 5000)
  return { summary, rovers, visionLatest }
}
