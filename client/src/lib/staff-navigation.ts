import { LayoutDashboard, Inbox, Users, UsersRound, BarChart2, Building2, Ticket, Plus, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { path: "/",        label: "Dashboard", icon: LayoutDashboard, exact: true  },
  { path: "/work",    label: "Work queues", icon: Inbox, exact: false },
  { path: "/tickets", label: "Tickets",   icon: Ticket,          exact: false },
];

const INTERNAL_ITEMS = [
  { path: "/internal/tickets", label: "My Tickets", icon: UserRound, exact: false },
  { path: "/internal/submit", label: "Raise Ticket", icon: Plus, exact: false },
];

const ADMIN_ITEMS = [
  { path: "/users",            label: "Employee directory", icon: Users, exact: false },
  { path: "/teams",            label: "Teams",        icon: UsersRound, exact: false },
];

export const staffSections = [
  { label: "Workspace", items: NAV_ITEMS },
  { label: "Internal requests", items: INTERNAL_ITEMS },
  { label: "Reports", items: [{ path: "/analytics", label: "Analytics", icon: BarChart2, exact: false }], allowTsa: true },
  { label: "Client support", items: [{ path: "/clients", label: "Clients", icon: Building2, exact: false }], allowTsa: true },
  { label: "Administration", items: ADMIN_ITEMS, adminOnly: true },
];

export function isStaffPage(pathname: string, path: string, exact: boolean) {
  return pathname === path || (!exact && pathname.startsWith(`${path}/`));
}
