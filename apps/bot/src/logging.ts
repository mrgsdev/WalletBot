/**
 * Принудительно небуферизованный вывод.
 *
 * systemd забирает stdout через pipe, а Node буферизует запись в pipe
 * блоками. Из-за этого журнал долгоживущего процесса оставался пустым:
 * строки копились в буфере и не доходили до journalctl, пока процесс
 * не завершится. Для диагностики это бесполезно, поэтому переводим
 * потоки в блокирующий режим.
 */
export function enableUnbufferedLogs() {
  for (const stream of [process.stdout, process.stderr]) {
    const handle = (stream as unknown as { _handle?: { setBlocking?: (v: boolean) => void } })._handle;
    handle?.setBlocking?.(true);
  }
}

/** Метка времени в логе: без неё непонятно, когда что случилось. */
export function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

export function logError(...args: unknown[]) {
  console.error(new Date().toISOString(), ...args);
}
