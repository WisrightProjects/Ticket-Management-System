import { useStaffSupportRole } from "@/hooks/useStaffSupportRole";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu as AccountMenu } from "@base-ui/react/menu";
import { useSession, signOut } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";
import { ChevronDown, ChevronRight, LogOut, UserRound, Menu } from "lucide-react";
import { clearStaffDrafts } from "@/hooks/useReplyDraft";
import { isStaffPage, staffSections } from "@/lib/staff-navigation";
import { ticketReturnPath } from "@/lib/ticket-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { data: session } = useSession();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  const isAdmin = (session?.user as { role: UserRole } | undefined)?.role === ROLES.ADMIN;
  const section = staffSections.find(({ items }) => items.some(({ path, exact }) => isStaffPage(pathname, path, exact)));
  const current = section?.items.find(({ path, exact }) => isStaffPage(pathname, path, exact));
  const ticketRef = pathname.match(/^\/(?:internal\/)?tickets\/(TKT-\d+)$/i)?.[1];
  const detail = ticketRef ?? (current?.path === "/users" && pathname !== "/users" ? "Employee details" : undefined);
  const parentPath = ticketRef && current?.path === "/tickets" ? ticketReturnPath(search) : current?.path;
  const parentLabel = parentPath?.split("?")[0] === "/work" ? "Work queues" : current?.label;
  const { data: supportRole } = useStaffSupportRole(session?.user.id);
  const roleLabels = { TSA: "Technical Support Admin", PROJECT_LEAD: "Project Lead", MEMBER: "Member" };
  const accountRole = (supportRole && roleLabels[supportRole]) ?? (isAdmin ? "Administrator" : "Agent");

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const result = await signOut();
      if (result?.error) throw new Error("Sign-out failed");
      sessionStorage.removeItem("tms_active");
      clearStaffDrafts();
      navigate("/login", { replace: true });
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header
      style={{
        background:   "var(--rt-surface)",
        borderBottom: "1px solid var(--rt-border)",
        position:     "sticky",
        top:          0,
        zIndex:       50,
        flexShrink:   0,
      }}
    >
      <div className="flex h-[60px] items-center">

        {/* Hamburger — mobile only */}
        <button
          className="ml-3 mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg border text-foreground transition-colors hover:bg-muted md:hidden"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Logo — flex-1 pushes right side to far edge */}
        <Link
          to="/"
          className="flex h-full min-w-0 flex-1 items-center gap-3 no-underline md:w-[240px] md:flex-none md:border-b md:border-[var(--rt-nav-border)] md:bg-[var(--rt-nav-bg)] md:px-4"
        >
          <img
            src="/right-tracker-logo.png"
            alt="Right Tracker"
            className="h-9 max-w-full rounded-md bg-white object-contain sm:h-11"
          />
        </Link>

        {current && <nav aria-label="Current location" className="hidden min-w-0 flex-1 items-center gap-2 px-6 text-sm md:flex">
          <span className="shrink-0 text-muted-foreground">{section?.label}</span>
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          {detail && parentPath ? <Link to={parentPath} className="truncate rounded-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {parentLabel}
          </Link> : <span aria-current="page" className="truncate font-semibold">{current.label}</span>}
          {detail && <>
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <span aria-current="page" className={ticketRef ? "truncate font-mono text-xs font-semibold text-primary" : "truncate font-semibold"}>{detail}</span>
          </>}
        </nav>}

        <div className="ml-auto shrink-0 px-3 sm:px-5">
          <AccountMenu.Root modal={false}>
            <AccountMenu.Trigger type="button" aria-label="Account menu" className="flex min-h-10 items-center gap-2.5 rounded-lg border px-2.5 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <span className="hidden min-w-0 sm:grid">
                <span className="max-w-32 truncate text-xs font-semibold leading-tight">{session?.user?.name || "Account"}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{accountRole}</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </AccountMenu.Trigger>
            <AccountMenu.Portal>
              <AccountMenu.Positioner align="end" sideOffset={8} className="z-[55]">
                <AccountMenu.Popup className="w-60 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none">
                  <div className="space-y-1 border-b px-4 py-3">
                    <p className="truncate text-sm font-semibold">{session?.user?.name || "Account"}</p>
                    <p className="break-all text-xs text-muted-foreground">{session?.user?.email}</p>
                  </div>
                  <div className="p-1.5">
                    <AccountMenu.Item onClick={() => { setSignOutError(false); setConfirmSignOut(true); }}
                      className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-medium text-destructive outline-none data-highlighted:bg-destructive/10">
                      <LogOut className="size-4" aria-hidden="true" />Sign out
                    </AccountMenu.Item>
                  </div>
                </AccountMenu.Popup>
              </AccountMenu.Positioner>
            </AccountMenu.Portal>
          </AccountMenu.Root>
        </div>
      </div>
      <Dialog open={confirmSignOut} onOpenChange={(open) => { if (!signingOut) setConfirmSignOut(open); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Sign out of Right Tracker?</DialogTitle>
            <DialogDescription>Signing out clears unsent reply drafts in this browser tab.</DialogDescription>
          </DialogHeader>
          {signOutError && <p role="alert" className="text-sm text-destructive">Unable to sign out. Please try again.</p>}
          <DialogFooter>
            <Button variant="outline" disabled={signingOut} onClick={() => setConfirmSignOut(false)}>Cancel</Button>
            <Button variant="destructive" disabled={signingOut} onClick={handleSignOut}>{signingOut ? "Signing out…" : "Sign out"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export default Navbar;
