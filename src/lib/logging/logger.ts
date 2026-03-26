type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const level = process.env.LOG_LEVEL as LogLevel | undefined;
  return level && level in LEVEL_ORDER ? level : "info";
}

interface LogContext {
  readonly requestId?: string;
  readonly clientId?: string;
  readonly [key: string]: unknown;
}

interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getConfiguredLevel()];
}

function emit(
  level: LogLevel,
  message: string,
  context: LogContext,
  extra?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
    ...extra,
  };

  const json = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    default:
      console.log(json);
  }
}

/**
 * Create a structured logger with bound context.
 * Context fields (requestId, clientId, etc.) are included in every log entry.
 */
export function createLogger(context: LogContext = {}): Logger {
  return {
    debug: (message, extra) => emit("debug", message, context, extra),
    info: (message, extra) => emit("info", message, context, extra),
    warn: (message, extra) => emit("warn", message, context, extra),
    error: (message, extra) => emit("error", message, context, extra),
  };
}
