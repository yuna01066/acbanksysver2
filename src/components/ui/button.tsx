import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary-dark text-primary-foreground shadow-smooth hover:shadow-depth hover:scale-105 border border-primary/20",
        destructive:
          "bg-gradient-to-r from-destructive to-red-600 text-destructive-foreground shadow-smooth hover:shadow-depth hover:scale-105",
        outline:
          "border-2 border-border/30 bg-background/50 backdrop-blur-sm hover:bg-accent/50 hover:text-accent-foreground hover:border-primary/30 shadow-smooth hover:shadow-depth hover:scale-105",
        secondary:
          "bg-gradient-to-r from-secondary to-slate-200 text-secondary-foreground shadow-smooth hover:shadow-depth hover:scale-105",
        ghost: "hover:bg-accent/30 hover:text-accent-foreground hover:scale-105 backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-dark",
        minimal: "bg-background/60 backdrop-blur-sm border border-border/30 hover:bg-accent/40 hover:border-primary/30 shadow-smooth hover:shadow-depth hover:scale-105",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-8 px-3 py-1.5 text-xs",
        lg: "h-12 px-6 py-3 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
