type LogFields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", msg: string, fields?: LogFields): void {
  const ts = new Date().toISOString();
  const payload = fields ? ` ${JSON.stringify(fields)}` : "";
  process.stderr.write(`${ts} [${level}] ${msg}${payload}\n`);
}

export const log = {
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};
