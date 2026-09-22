/** Status-bar clock from the frame's `nowMs`, in UTC, so a checkpoint does not follow the host timezone or the live clock. */
export function statusClock(nowMs: number): string {
  const date = new Date(nowMs);
  const hour24 = date.getUTCHours();
  const hour = hour24 % 12 || 12;
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}
