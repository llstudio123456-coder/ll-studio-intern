import { guardApi } from '@/server/auth/guard'
import { listTrash, storageUsed, isExpired } from '@/server/services/workspace/filesRepo'
import { TRASH_RETENTION_DAYS } from '@shared/workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Papierkorb + Speicherbelegung. */
export async function GET() {
  const g = await guardApi({ role: 'viewer' })
  if (!g.ok) return g.response

  const t = listTrash()
  return Response.json({
    ok: true,
    retentionDays: TRASH_RETENTION_DAYS,
    folders: t.folders.map((f) => ({ ...f, expired: isExpired(f.deletedAt) })),
    files: t.files.map((f) => ({ ...f, expired: isExpired(f.deletedAt) })),
    storageUsed: storageUsed()
  })
}
