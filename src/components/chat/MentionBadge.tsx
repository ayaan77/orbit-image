"use client";

interface MentionBadgeProps {
  readonly count: number;
  readonly className?: string;
}

export function MentionBadge({ count, className }: MentionBadgeProps) {
  if (count === 0) return null;
  return <span className={className}>{count > 99 ? "99+" : count}</span>;
}
