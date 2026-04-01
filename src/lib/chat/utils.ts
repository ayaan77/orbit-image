/**
 * Format a date as a relative "time ago" string.
 * e.g. "just now", "5m ago", "2h ago", "3d ago"
 */
export function formatTimeAgo(date: Date | string): string {
  const dateStr = typeof date === "string" ? date : date.toISOString();
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}
