import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <h2 className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3", className)}>
      {title}
    </h2>
  );
}
