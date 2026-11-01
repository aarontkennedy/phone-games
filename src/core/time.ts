/** 125000 ms -> "2:05". Caps at 99:59. */
export function formatTime(ms: number): string {
  const total = Math.min(99 * 60 + 59, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
