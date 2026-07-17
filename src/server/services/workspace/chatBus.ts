/**
 * Echtzeit-Verteiler für den Chat (Server-Sent Events).
 *
 * Bewusst im Arbeitsspeicher: Der Dienst läuft auf einer einzelnen Railway-Instanz, ein
 * Nachrichtenbroker wäre hier reine Komplexität. Sollte je horizontal skaliert werden, muss
 * das hier durch Redis/Postgres-LISTEN ersetzt werden — sonst sehen Benutzer auf verschiedenen
 * Instanzen einander nicht mehr.
 */

export type ChatEvent =
  | { type: 'message'; channelId: string; messageId: string }
  | { type: 'update'; channelId: string; messageId: string }
  | { type: 'delete'; channelId: string; messageId: string }
  | { type: 'typing'; channelId: string; userId: string; name: string }
  // Benachrichtigungen laufen bewusst über denselben Strom: ein zweiter Kanal wäre eine
  // zweite Rechteprüfung und damit eine zweite Fehlerquelle.
  | { type: 'notification' }

type Listener = (e: ChatEvent) => void

/** Abonnenten je Benutzer-ID. Ein Benutzer kann mehrere Tabs offen haben. */
const listeners = new Map<string, Set<Listener>>()

export function subscribe(userId: string, fn: Listener): () => void {
  let set = listeners.get(userId)
  if (!set) {
    set = new Set()
    listeners.set(userId, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) listeners.delete(userId)
  }
}

/**
 * Ereignis an bestimmte Benutzer senden.
 *
 * Der Aufrufer übergibt die Empfängerliste — sie wird aus der Kanal-Mitgliedschaft ermittelt.
 * So verlässt kein Ereignis den berechtigten Kreis, auch nicht als bloßer Hinweis „es gibt
 * Neues in Kanal X".
 */
export function publish(userIds: string[], e: ChatEvent): void {
  for (const uid of userIds) {
    const set = listeners.get(uid)
    if (!set) continue
    for (const fn of set) {
      try {
        fn(e)
      } catch {
        // Ein hängender Client darf die Zustellung an alle anderen nicht verhindern.
      }
    }
  }
}

/** Nur für Diagnose. */
export function connectionCount(): number {
  let n = 0
  for (const set of listeners.values()) n += set.size
  return n
}
