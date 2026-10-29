import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-800 text-zinc-200",
        secondary:
          "border-zinc-800 bg-zinc-900/80 text-zinc-400",
        outline:
          "border-zinc-800 text-zinc-300 bg-transparent",
        success:
          "border-emerald-800/60 bg-emerald-950/60 text-emerald-400",
        warning:
          "border-amber-800/60 bg-amber-950/60 text-amber-400",
        danger:
          "border-rose-800/60 bg-rose-950/60 text-rose-400",
        emerald:
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
        terracotta:
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
