"use client";

interface MentionBadgeProps {
  count: number;
  className?: string;
}

export function MentionBadge({ count, className }: MentionBadgeProps) {
  if (count === 0) return null;
  return <span className={className}>{count > 99 ? "99+" : count}</span>;
}
