import type { AIPreviewPrompt, PreviewCodeFormat } from '@shared/types'

export type ManualTarget = 'claude-code' | 'lovable' | 'v0' | 'cursor' | 'generic'

const HEADER: Record<ManualTarget, string> = {
  'claude-code': '# Prompt für Claude Code\n\nFüge diesen Prompt in Claude Code ein, um die Kundenvorschau als Code zu erzeugen.\n',
  lovable: '# Prompt für Lovable\n\nFüge diesen Prompt in Lovable ein.\n',
  v0: '# Prompt für v0\n\nFüge diesen Prompt in v0 (v0.dev) ein.\n',
  cursor: '# Prompt für Cursor\n\nFüge diesen Prompt in den Cursor-Chat ein.\n',
  generic: '# KI-Prompt (universell)\n\nFür Claude Code, Lovable, v0 oder Cursor.\n'
}

/** Wandelt ein Zielformat in ein passendes manuelles Ziel um. */
export function targetFromFormat(format: PreviewCodeFormat): ManualTarget {
  if (format === 'v0-prompt') return 'v0'
  if (format === 'lovable-prompt') return 'lovable'
  if (format === 'claude-code-prompt') return 'claude-code'
  return 'generic'
}

/** Erzeugt den fertigen, kopierbaren Prompt-Text für die manuelle Nutzung in einer externen KI. */
export function buildManualExport(prompt: AIPreviewPrompt, target: ManualTarget = 'generic'): string {
  const head = HEADER[target] || HEADER.generic
  return [
    head,
    '## Rolle & Regeln',
    prompt.system,
    '',
    '## Aufgabe',
    prompt.user,
    '',
    '---',
    prompt.legalNote
  ].join('\n')
}
