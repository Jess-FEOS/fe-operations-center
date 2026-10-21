/** A Vercel preview is ALWAYS read-only, even if a production write flag is inherited. */
export function allowedOrigin(origin: string | null, host: string | null) {
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.host === host
  } catch { return false }
}

export function isReadOnly(env: Record<string,string | undefined>) {
  return env.VERCEL_ENV === 'preview' || env.OPS_WRITES_ENABLED !== 'true'
}
export function isReadRequest(method: string, path: string) {
  return ['GET','HEAD','OPTIONS'].includes(method) ||
    (method === 'POST' && (path === '/api/projects/prepare' || /^\/api\/projects\/[^/]+\/schedule$/.test(path)))
}
export function allowedEmail(email: string | undefined, allowlist: string | undefined) {
  return !!email && !!allowlist?.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())
}
