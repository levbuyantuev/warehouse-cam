import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "xl" | "icon" | "massive";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          {
            "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30":
              variant === "default",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90":
              variant === "destructive",
            "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground":
              variant === "outline",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm":
              variant === "secondary",
            "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
            "h-12 px-6 py-2 text-base": size === "default",
            "h-10 rounded-xl px-4": size === "sm",
            "h-14 rounded-2xl px-8 text-lg": size === "lg",
            "h-16 rounded-2xl px-10 text-xl tracking-wide": size === "xl",
            "h-20 rounded-3xl px-10 text-2xl tracking-wide": size === "massive",
            "h-12 w-12": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
