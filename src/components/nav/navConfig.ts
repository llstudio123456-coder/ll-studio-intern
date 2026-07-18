import {
  LayoutDashboard, Link2, Sparkles, Eye, Users, FileText, Wand2, Settings,
  Save, Layers, LogOut, HardDrive, MailPlus, StickyNote, CheckSquare, MessageSquare,
  ShieldCheck, Home, FolderKanban
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { roleAtLeast, type Role } from '@shared/auth'

/**
 * Eine einzige Quelle für die Navigation — Desktop-Sidebar UND mobiles Menü lesen sie.
 * So können die beiden Menüs nicht auseinanderlaufen, und ein neuer Punkt taucht überall auf.
 */

export interface NavCounts {
  gespeichert: number
  pipeline: number
  chatUnread: number
}

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  /** Aktiv-Erkennung; bekommt Pfad + ?view=. */
  active: (path: string, view: string) => boolean
  count?: (c: NavCounts) => number | undefined
  /** Sichtbar ab dieser Rolle (sonst für alle). Serverseitig wird zusätzlich geprüft. */
  minRole?: Role
}

export interface NavGroup {
  title: string
  links: NavLink[]
}

const startsWith = (p: string) => (path: string) => path.startsWith(p)
const exact = (p: string) => (path: string) => path === p

/** Die vollständige, gruppierte Navigation (fürs Drawer und die Desktop-Sidebar). */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Arbeitsbereich',
    links: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard, active: exact('/') }]
  },
  {
    title: 'Analyse',
    links: [
      { href: '/url-analyse', label: 'URL-Analyse', icon: Link2, active: startsWith('/url-analyse') },
      { href: '/inspiration', label: 'Inspirationssuche', icon: Sparkles, active: startsWith('/inspiration') },
      { href: '/design-preview', label: 'Stil-Vorschau', icon: Eye, active: startsWith('/design-preview') }
    ]
  },
  {
    title: 'Kundengewinnung',
    links: [
      { href: '/kundenfinder', label: 'Kundenfinder', icon: Users, active: (p, v) => p === '/kundenfinder' && v !== 'gespeichert' && v !== 'pipeline' },
      { href: '/kundenfinder?view=gespeichert', label: 'Gespeicherte Kunden', icon: Save, active: (p, v) => p === '/kundenfinder' && v === 'gespeichert', count: (c) => c.gespeichert || undefined },
      { href: '/kundenfinder?view=pipeline', label: 'Kontakt-Pipeline', icon: Layers, active: (p, v) => p === '/kundenfinder' && v === 'pipeline', count: (c) => c.pipeline || undefined },
      { href: '/reports', label: 'Reports', icon: FileText, active: startsWith('/reports') }
    ]
  },
  {
    title: 'Werkzeuge',
    links: [{ href: '/prompt-generator', label: 'Prompt-Generator', icon: Wand2, active: startsWith('/prompt-generator') }]
  },
  {
    title: 'Workspace',
    links: [
      { href: '/workspace', label: 'Dateien', icon: HardDrive, active: exact('/workspace') },
      { href: '/workspace/projekte', label: 'Projekte', icon: FolderKanban, active: startsWith('/workspace/projekte') },
      { href: '/workspace/notizen', label: 'Notizen', icon: StickyNote, active: startsWith('/workspace/notizen') },
      { href: '/workspace/aufgaben', label: 'Aufgaben', icon: CheckSquare, active: startsWith('/workspace/aufgaben') },
      { href: '/workspace/chat', label: 'Chat', icon: MessageSquare, active: startsWith('/workspace/chat'), count: (c) => c.chatUnread || undefined }
    ]
  },
  {
    title: 'System',
    links: [
      { href: '/settings', label: 'Einstellungen', icon: Settings, active: startsWith('/settings') },
      { href: '/admin', label: 'Benutzer & Sicherheit', icon: ShieldCheck, active: exact('/admin'), minRole: 'admin' },
      { href: '/admin/freigaben', label: 'E-Mail-Freigaben', icon: MailPlus, active: startsWith('/admin/freigaben'), minRole: 'admin' }
    ]
  }
]

/** Nur die für diese Rolle sichtbaren Gruppen/Links. */
export function visibleGroups(role: Role | undefined): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    links: g.links.filter((l) => !l.minRole || roleAtLeast(role, l.minRole))
  })).filter((g) => g.links.length > 0)
}

/**
 * Bottom-Navigation fürs Smartphone: höchstens fünf Punkte (Spezifikation).
 * „Mehr" öffnet das vollständige Menü.
 */
export interface BottomItem {
  href?: string
  label: string
  icon: LucideIcon
  active?: (path: string, view: string) => boolean
  isMore?: boolean
}

export const BOTTOM_NAV: BottomItem[] = [
  { href: '/', label: 'Start', icon: Home, active: exact('/') },
  { href: '/kundenfinder', label: 'Kunden', icon: Users, active: startsWith('/kundenfinder') },
  { href: '/workspace', label: 'Ablage', icon: HardDrive, active: (p) => p === '/workspace' || p.startsWith('/workspace/notizen') || p.startsWith('/workspace/aufgaben') },
  { href: '/workspace/chat', label: 'Chat', icon: MessageSquare, active: startsWith('/workspace/chat') },
  { label: 'Mehr', icon: LayoutDashboard, isMore: true }
]

export { LogOut }
