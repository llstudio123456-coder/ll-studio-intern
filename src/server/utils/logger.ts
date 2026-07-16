/** Minimaler Logger mit Zeitstempel. */
function ts(): string {
  return new Date().toISOString().split('T')[1]?.replace('Z', '') ?? ''
}

export const log = {
  info: (...args: unknown[]) => console.log(`[${ts()}] [i]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${ts()}] [!]`, ...args),
  error: (...args: unknown[]) => console.error(`[${ts()}] [x]`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.INSPECTOR_DEBUG) console.log(`[${ts()}] [d]`, ...args)
  }
}
