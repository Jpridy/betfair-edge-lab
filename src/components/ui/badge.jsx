import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-body font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-danger/15 text-danger border-danger/25 hover:bg-danger/25",
        success:
          "border-transparent bg-success/15 text-success border-success/25 hover:bg-success/25",
        warning:
          "border-transparent bg-warning/15 text-warning border-warning/25 hover:bg-warning/25",
        info:
          "border-transparent bg-info/15 text-info border-info/25 hover:bg-info/25",
        outline: "text-foreground border-border",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }