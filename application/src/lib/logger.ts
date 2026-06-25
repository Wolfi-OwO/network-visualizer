// Tiny structured logger — swap for pino/winston later without touching callers.
type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, message: string, meta?: unknown): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}`
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (meta !== undefined) sink(line, meta)
  else sink(line)
}

export const logger = {
  debug: (m: string, meta?: unknown) => emit('debug', m, meta),
  info: (m: string, meta?: unknown) => emit('info', m, meta),
  warn: (m: string, meta?: unknown) => emit('warn', m, meta),
  error: (m: string, meta?: unknown) => emit('error', m, meta),
}
