interface TicketPillProps {
  label: string;
  cfg: { dot: string; text: string; bg: string };
}

export function TicketPill({ label, cfg }: TicketPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {label}
    </span>
  );
}
