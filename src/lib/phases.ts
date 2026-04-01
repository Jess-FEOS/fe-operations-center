export type SimplifiedPhase = 'Build' | 'Market' | 'Launch & Run'

const PHASE_MAP: Record<string, SimplifiedPhase> = {
  'Planning':         'Build',
  'Setup':            'Build',
  'Build':            'Build',
  'Delivery Prep':    'Build',
  'Marketing Launch': 'Market',
  'Pre-Launch':       'Market',
  'Launch':           'Launch & Run',
  'Wrap Up':          'Launch & Run',
}

export function getSimplifiedPhase(phaseName: string): SimplifiedPhase {
  return PHASE_MAP[phaseName] ?? 'Build'
}

export const SIMPLIFIED_PHASE_ORDER: SimplifiedPhase[] = ['Build', 'Market', 'Launch & Run']

export const SIMPLIFIED_PHASE_COLORS: Record<SimplifiedPhase, string> = {
  'Build':        '#1B365D', // fe-navy
  'Market':       '#0762C8', // fe-blue
  'Launch & Run': '#046A38', // fe-green
}
