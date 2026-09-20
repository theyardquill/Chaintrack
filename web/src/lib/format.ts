export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function fmtAmount(amount: number, currency: string): string {
  return `${amount} ${currency}`;
}

export function fmtAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}