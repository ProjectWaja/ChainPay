export function formatUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toLocaleString()}.${fracStr}`;
}

export function truncateBytes32(hex: string): string {
  if (!hex || hex === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return "—";
  }
  return `${hex.slice(0, 10)}...${hex.slice(-6)}`;
}

export function formatFrequency(seconds: number): string {
  if (seconds === 0) return "—";
  const days = seconds / 86400;
  if (days === 7) return "Weekly";
  if (days === 14) return "Biweekly";
  if (days >= 28 && days <= 31) return "Monthly";
  return `${days}d`;
}

export function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
