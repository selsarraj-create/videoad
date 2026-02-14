import * as React from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export interface BespokeInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

const BespokeInput = React.forwardRef<HTMLInputElement, BespokeInputProps>(
    ({ className, type, label, ...props }, ref) => {
        const [isFocused, setIsFocused] = React.useState(false)

        return (
            <div className="group relative space-y-2">
                {label && (
                    <label className={cn(
                        "block text-[10px] uppercase tracking-[0.2em] font-sans transition-colors duration-300",
                        isFocused ? "text-foreground" : "text-muted-foreground"
                    )}>
                        {label}
                    </label>
                )}
                <div className="relative">
                    <input
                        type={type}
                        className={cn(
                            "flex h-10 w-full bg-transparent border-b border-border px-0 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300",
                            className
                        )}
                        onFocus={(e) => { setIsFocused(true); props.onFocus?.(e) }}
                        onBlur={(e) => { setIsFocused(false); props.onBlur?.(e) }}
                        ref={ref}
                        {...props}
                    />
                    {isFocused && (
                        <motion.div
                            layoutId="input-glow"
                            className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground shadow-[0_0_15px_rgba(43,43,43,0.5)]"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                </div>
            </div>
        )
    }
)
BespokeInput.displayName = "BespokeInput"

export { BespokeInput }
