/** Origin checks reduce cross-site browser submissions; they are not authentication. */
export function allowedOrigin(origin: string | null, host: string | null) {
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.host === host
  } catch { return false }
}

export function isReadOnly(env: Record<string,string | undefined>) {
  // Approved release policy: retain open production access; previews never write.
  if (env.VERCEL_ENV === 'preview' || env.OPS_LOCAL_REVIEW === 'true' || env.OPS_WRITES_ENABLED === 'false') return true
  return env.VERCEL_ENV !== 'production' && env.OPS_WRITES_ENABLED !== 'true'
}
export function isReadRequest(method: string, path: string) {
  return ['GET','HEAD','OPTIONS'].includes(method) ||
    (method === 'POST' && (path === '/api/projects/prepare' || path === '/api/updates/prepare' || /^\/api\/projects\/[^/]+\/schedule$/.test(path)))
}
