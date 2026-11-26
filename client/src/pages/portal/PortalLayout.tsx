import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { LogOut, Inbox, UserRound, Menu, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/portal/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { path: "/portal/tickets",   label: "My Tickets", icon: Inbox           },
];

export default function PortalLayout() {
  const { data: session } = useSession();
  const location  = useLocation();
  const navigate  = useNavigate();
  const userName =
    (session?.user as unknown as { name?: string } | undefined)?.name ?? "Customer";

  const handleSignOut = async () => {
    await signOut();
    const slug = localStorage.getItem("portal-slug") ?? "";
    navigate(slug ? `/portal/${slug}/login` : "/");
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path.includes("?")) return false; // action links never show as active
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* ── Top navbar ── */}
      <header
        style={{
          background: "var(--rt-header-gradient)",
          position:   "sticky",
          top:        0,
          zIndex:     50,
          flexShrink: 0,
        }}
      >
        <div className="flex items-center px-4" style={{ height: "60px" }}>
          {/* Hamburger — mobile only */}
          <button
            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg mr-1 flex-shrink-0 text-white border border-white/20 bg-black/10 hover:bg-black/20 transition-colors"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <Menu className="h-3.5 w-3.5" />
          </button>
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-1 flex-shrink-0">
            <img
              src="/right-tracker-logo.png"
              alt="Right Tracker"
              className="h-9 w-auto rounded-md bg-white object-contain sm:h-10"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Divider */}
            <div className="w-px h-5 bg-white/25" />

            {/* User avatar + name */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-black/15 border border-white/30">
                <UserRound className="h-4 w-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-tight max-w-[110px] truncate text-white">
                  {userName}
                </p>
                <p className="text-[10px] leading-tight text-white/65">
                  Customer
                </p>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ml-1 text-white border border-white/25 bg-transparent hover:bg-black/20"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed md:sticky top-[60px] left-0 z-40 md:z-auto",
            "h-[calc(100vh-60px)] overflow-y-auto",
            "transition-transform duration-300 ease-in-out",
            "w-[220px] flex-shrink-0 flex flex-col gap-0.5 p-2.5",
            "bg-[var(--rt-surface)] border-r border-[var(--rt-border)] shadow-[2px_0_16px_var(--rt-accent-bg)]",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 py-2.5 pl-2.5 pr-3 rounded-lg text-sm no-underline transition-colors duration-150",
                  "border-l-[3px]",
                  active
                    ? "font-semibold text-[var(--rt-accent)] bg-[var(--rt-accent-bg)] border-l-[var(--rt-active-indicator)]"
                    : "font-medium text-[var(--rt-text-2)] bg-transparent border-l-transparent hover:bg-[var(--rt-accent-bg)] hover:text-[var(--rt-accent)]"
                )}
              >
                <Icon size={18} className="flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </aside>

        {/* Main content */}
        <main
          style={{
            flex:      1,
            background: "var(--rt-bg)",
            overflowY: "auto",
            minWidth:  0,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
