import { useStaffSupportRole } from "@/hooks/useStaffSupportRole";
import { Link, useLocation } from "react-router-dom";
import { isStaffPage, staffSections } from "@/lib/staff-navigation";
import { useSession } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { data: session } = useSession();
  const supportRole = useStaffSupportRole(session?.user.id).data;
  const isAdmin = !supportRole && (session?.user as { role: UserRole } | undefined)?.role === ROLES.ADMIN;

  const sections = staffSections
    .filter((section) => section.allowTsa ? isAdmin || supportRole === "TSA" : isAdmin || !section.adminOnly)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.path !== "/internal/submit" || (supportRole !== "MEMBER" && supportRole !== "PROJECT_LEAD")),
    }));

  return (
    <aside
      className={cn(
        "fixed md:sticky top-[60px] left-0 z-40 md:z-auto",
        "h-[calc(100vh-60px)] overflow-y-auto",
        "transition-transform duration-300 ease-in-out",
        "w-[240px] shrink-0 px-3 py-4",
        "bg-[var(--rt-nav-bg)] border-r border-[var(--rt-nav-border)]",
        open ? "visible translate-x-0" : "invisible -translate-x-full md:visible md:translate-x-0"
      )}
    >
      <nav aria-label="Staff navigation" className="grid gap-5">
      {sections.map((section) => <div key={section.label} role="group" aria-label={section.label} className="grid gap-1">
      <p className="px-3 pb-1 text-xs font-medium text-[var(--rt-nav-muted)]">{section.label}</p>
      {section.items.map(({ path, label, icon: Icon, exact }) => {
        const active = isStaffPage(location.pathname, path, exact);
        return (
          <Link
            key={path}
            to={path}
            onClick={onClose}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-2.5 rounded-lg border-l-2 px-3 text-sm no-underline transition-colors",
              active
                ? "border-l-[var(--rt-active-indicator)] bg-[var(--rt-nav-active)] font-semibold text-[var(--rt-nav-active-text)]"
                : "border-l-transparent font-medium text-[var(--rt-nav-text)] hover:bg-[var(--rt-nav-hover)]"
            )}
          >
            <Icon size={17} aria-hidden="true" className={cn("shrink-0", !active && "text-[var(--rt-nav-muted)]")} />
            {label}
          </Link>
        );
      })}
      </div>)}
      </nav>
    </aside>
  );
}
