import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"

type BadgeVariant = "default" | "secondary" | "outline" | "ghost"

interface BadgeButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode
  className?: string | undefined
  style?: CSSProperties | undefined
  variant?: BadgeVariant | undefined
}

const badgeBaseClassName =
  "treem-badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[999px] border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-white/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/15"

const badgeVariantClassName: Record<BadgeVariant, string> = {
  default: "treem-badge--default",
  secondary: "treem-badge--secondary",
  outline: "treem-badge--outline",
  ghost: "treem-badge--ghost"
}

export function BadgeButton({
  children,
  className,
  variant = "default",
  ...props
}: BadgeButtonProps) {
  return (
    <button
      {...props}
      className={[
        badgeBaseClassName,
        badgeVariantClassName[variant],
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  )
}
