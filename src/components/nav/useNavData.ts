'use client'
import { useCallback, useEffect, useState } from 'react'
import type { NavCounts } from './navConfig'

export interface NavUser {
  name?: string
  email?: string
  role?: string
}
export interface NavMe {
  configured: boolean
  authenticated: boolean
  user?: NavUser | null
}

/**
 * Lädt Benutzer, Zähler und den Ungelesen-Stand — einmalig, damit Desktop-Sidebar und mobiles
 * Menü dieselben Zahlen zeigen und die Requests nicht doppelt laufen.
 *
 * Der Chat-Ungelesen-Stand kommt über denselben Echtzeit-Strom wie der Chat selbst und
 * aktualisiert sich ohne Neuladen.
 */
export function useNavData(path: string) {
  const [me, setMe] = useState<NavMe | null>(null)
  const [counts, setCounts] = useState<NavCounts>({ gespeichert: 0, pipeline: 0, chatUnread: 0 })

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then(setMe).catch(() => {})
  }, [])

  const loadCounts = useCallback(() => {
    fetch('/api/kundenfinder/companies?stats=1&limit=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stats) setCounts((c) => ({ ...c, gespeichert: d.stats.gespeichert ?? 0, pipeline: d.stats.gespeichert ?? 0 }))
      })
      .catch(() => {})
  }, [])
  useEffect(() => { loadCounts() }, [loadCounts, path])

  const loadChatUnread = useCallback(() => {
    fetch('/api/workspace/chat/channels')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.channels) {
          const n = d.channels.reduce((sum: number, ch: { unread?: number }) => sum + (ch.unread || 0), 0)
          setCounts((c) => ({ ...c, chatUnread: n }))
        }
      })
      .catch(() => {})
  }, [])
  useEffect(() => { loadChatUnread() }, [loadChatUnread, path])

  useEffect(() => {
    if (!me?.authenticated) return
    const es = new EventSource('/api/workspace/chat/stream')
    const onAny = () => loadChatUnread()
    es.addEventListener('message', onAny)
    es.addEventListener('delete', onAny)
    return () => es.close()
  }, [me?.authenticated, loadChatUnread])

  return { me, counts }
}
