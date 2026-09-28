export function enableUnbufferedLogs() {
  for (const stream of [process.stdout, process.stderr]) {
    const handle = (stream as unknown as { _handle?: { setBlocking?: (v: boolean) => void } })._handle;
    handle?.setBlocking?.(true);
  }
}

export function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

export function logError(...args: unknown[]) {
  console.error(new Date().toISOString(), ...args);
}
