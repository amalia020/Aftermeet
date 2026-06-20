interface AvatarProps {
  initials: string;
  tone?: "cool" | "warm" | "signal" | "muted";
  size?: "sm" | "md" | "lg";
}

export function Avatar({ initials, tone = "cool", size = "md" }: AvatarProps) {
  return <span className={`avatar avatar-${tone} avatar-${size}`}>{initials}</span>;
}
