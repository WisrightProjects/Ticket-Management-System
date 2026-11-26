import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  message?: string;
  children?: ReactNode;
  className?: string;
}

export function ErrorBanner({ message, children, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm",
        className
      )}
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children ?? message}</div>
    </div>
  );
}
