"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@workspace/ui/lib/utils"
import { neonAvatarColor } from "@workspace/ui/lib/avatar-color"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  seed,
  style,
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  /** Colour seed (email/id). Falls back to the initials text. */
  seed?: string
}) {
  // Initials get a deterministic neon tint (Teams-style) unless the caller
  // sets an explicit colour (a `bg-*` class or an inline background).
  const hasExplicitBg =
    /(^|\s)bg-\S/.test(className ?? "") ||
    Boolean(style && ("background" in style || "backgroundColor" in style))
  const seedText = seed ?? (typeof children === "string" ? children : undefined)
  const autoColor = hasExplicitBg ? undefined : neonAvatarColor(seedText ?? "")

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full",
        autoColor && "text-white",
        className
      )}
      style={autoColor ? { background: autoColor, ...style } : style}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
