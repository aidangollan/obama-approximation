"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange }, ref) => {
    return (
      <SwitchPrimitives.Root
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        style={{
          all: 'unset',
          width: '44px',
          height: '24px',
          backgroundColor: checked ? '#6366f1' : '#444',
          borderRadius: '12px',
          position: 'relative',
          boxSizing: 'border-box',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
        }}
      >
        <SwitchPrimitives.Thumb
          style={{
            display: 'block',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '10px',
            transition: 'transform 0.2s ease',
            transform: checked ? 'translateX(22px)' : 'translateX(2px)',
            willChange: 'transform',
          }}
        />
      </SwitchPrimitives.Root>
    )
  }
)

Switch.displayName = "Switch"
