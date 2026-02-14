import * as React from "react"
import { cn } from "@/lib/utils"

export interface BespokeInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

const BespokeInput = React.forwardRef<HTMLInputElement, BespokeInputProps>(
    ({ className, type, label, ...props }, ref) => {
        return (
            <div className="group relative space-y-2">
                {label && (
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-sans text-muted-foreground transition-colors group-focus-within:text-foreground">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    className={cn(
                        "flex h-10 w-full bg-transparent border-b border-border px-0 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-b-2 focus-visible:border-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
            </div>
        )
    }
)
BespokeInput.displayName = "BespokeInput"

export { BespokeInput }
