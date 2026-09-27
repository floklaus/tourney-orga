import Image from "next/image";
import { cn } from "@/lib/format";

/**
 * Bay State Bullets Lacrosse logo (transparent PNG with dark lettering: keep it on a light background).
 * Pass the width via className (e.g. "w-28"); cn() does not merge conflicting Tailwind classes.
 */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Bay State Bullets Lacrosse"
      width={600}
      height={315}
      priority={priority}
      className={cn("h-auto", className ?? "w-full")}
    />
  );
}
