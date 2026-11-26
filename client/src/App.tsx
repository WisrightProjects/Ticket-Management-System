import { useEffect } from "react";
import { StaffAccessEnded, useStaffSupportRole } from "@/hooks/useStaffSupportRole";
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useSearchParams } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";
import Login from "@/pages/Login";
import WiseWorkSignIn from "@/pages/WiseWorkSignIn";
import Dashboard from "@/pages/Dashboard";
import Tickets from "@/pages/Tickets";
import TicketDetailPage from "@/pages/TicketDetailPage";
import Users from "@/pages/Users";
import AgentDetail from "@/pages/AgentDetail";
import Clients from "@/pages/Clients";
import AppLayout from "@/components/AppLayout";
import Analytics from "@/pages/Analytics";
import Portal404 from "@/pages/portal/Portal404";
import PortalTicketDetail from "@/pages/portal/PortalTicketDetail";
import { CustomerShell, CustomerOverview, CustomerRequests, CustomerNewRequest, CustomerProfile } from "@/pages/portal/CustomerWorkspace";
import ActivateAccount from "@/pages/ActivateAccount";
import Organizations from "@/pages/Organizations";
import StaffQueues from "@/pages/StaffQueues";
import Teams from "@/pages/Teams";
import PortalForgotPassword from "@/pages/portal/PortalForgotPassword";
import PortalResetPassword from "@/pages/portal/PortalResetPassword";
import InternalSubmit from "@/pages/internal/InternalSubmit";
import InternalTickets from "@/pages/internal/InternalTickets";
import InternalTicketDetail from "@/pages/internal/InternalTicketDetail";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { CLIENT_LOGIN_PATH, clientPortalDestination } from "@/lib/client-login";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  const access = useStaffSupportRole(session?.user.id);
  const accessEnded = access.error instanceof StaffAccessEnded;
  useEffect(() => {
    if (!accessEnded) return;
    sessionStorage.removeItem("tms_active");
    void signOut().finally(() => window.location.replace("/login"));
  }, [accessEnded]);

  if (isPending || (session && access.isPending)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (accessEnded) return <p role="status" className="p-6">Returning to sign-in…</p>;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Browser was closed and reopened — sessionStorage cleared, force re-login
  if (!sessionStorage.getItem("tms_active")) {
    void signOut();
    return <Navigate to="/login" replace />;
  }

  // CUSTOMER accounts belong in the portal, not the internal app
  const role = (session.user as unknown as { role?: string }).role;
  if (role === "CUSTOMER") {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children, allowTsa = false }: { children: React.ReactNode; allowTsa?: boolean }) {
  const { data: session, isPending } = useSession();
  const supportRole = useStaffSupportRole(session?.user.id);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (supportRole.isPending) return <p role="status" className="p-6">Loading access…</p>;
  const platformAdmin = supportRole.data === null && (session.user as { role?: UserRole }).role === ROLES.ADMIN;
  if (!platformAdmin && !(allowTsa && supportRole.data === "TSA")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RaiseTicketRoute() {
  const { data: session } = useSession();
  const supportRole = useStaffSupportRole(session?.user.id);
  if (supportRole.isPending) return <p role="status" className="p-6">Loading access…</p>;
  if (supportRole.isError || supportRole.data === "MEMBER" || supportRole.data === "PROJECT_LEAD") {
    return <Navigate to="/internal/tickets" replace />;
  }
  return <InternalSubmit />;
}

function GuestRoute({ children, client = false }: { children: React.ReactNode; client?: boolean }) {
  const { data: session, isPending } = useSession();
  const [params] = useSearchParams();
  const role = (session?.user as unknown as { role?: string })?.role;

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (session) {
    // Customer session on admin login page — go to portal instead
    if (role === "CUSTOMER") {
      return <Navigate to={clientPortalDestination(params.get("returnTo"))} replace />;
    }
    if (client) {
      return <AuthLayout clientSignIn title="Client sign in" description="This browser is signed in to the Right Tracker staff workspace. Open this client link in a private window to sign in with a client account.">
        {sessionStorage.getItem("tms_active") && <Button className="w-full" render={<Link to="/" />}>Return to staff workspace</Button>}
      </AuthLayout>;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function CustomerRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`${CLIENT_LOGIN_PATH}?${new URLSearchParams({ returnTo: window.location.pathname + window.location.search })}`} replace />;
  }

  const role = (session.user as unknown as { role?: string }).role;
  if (role !== "CUSTOMER") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<GuestRoute><Login /></GuestRoute>}
        />
        <Route path="/staff/wisework" element={<WiseWorkSignIn />} />
        <Route path="/staff/wisework/complete" element={<WiseWorkSignIn complete />} />
        <Route path={CLIENT_LOGIN_PATH} element={<GuestRoute client><Login client /></GuestRoute>} />

        {/* Portal — no AppLayout, no sidebar */}
        <Route path="/portal/404" element={<Portal404 />} />
        <Route path="/activate" element={<ActivateAccount />} />
        <Route path="/portal/auth/signup" element={<Navigate to="/" replace />} />
        <Route path="/portal/forgot-password" element={<PortalForgotPassword />} />
        <Route path="/portal/reset-password" element={<PortalResetPassword />} />
        <Route path="/portal/:slug/login" element={<Navigate to={CLIENT_LOGIN_PATH} replace />} />
        <Route path="/portal/:slug/submit" element={<Navigate to="/portal/new" replace />} />
        <Route path="/portal/:slug" element={<Navigate to={CLIENT_LOGIN_PATH} replace />} />
        <Route element={<CustomerRoute />}>
          <Route element={<CustomerShell />}>
            <Route path="/portal/dashboard" element={<CustomerOverview />} />
            <Route path="/portal/tickets" element={<CustomerRequests />} />
            <Route path="/portal/new" element={<CustomerNewRequest />} />
            <Route path="/portal/profile" element={<CustomerProfile />} />
            <Route path="/portal/tickets/:id" element={<PortalTicketDetail />} />
          </Route>
        </Route>

        {/* All authenticated pages share AppLayout (header + sidebar) */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/"            element={<Dashboard />} />
          <Route path="/tickets"     element={<Tickets />} />
          <Route path="/work"        element={<StaffQueues />} />
          <Route path="/teams"       element={<AdminRoute><Teams /></AdminRoute>} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/users"       element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="/users/:id"   element={<AdminRoute><AgentDetail /></AdminRoute>} />
          <Route path="/clients"     element={<AdminRoute allowTsa><Clients /></AdminRoute>} />
          <Route path="/clients/:organizationId" element={<AdminRoute allowTsa><Organizations /></AdminRoute>} />
          <Route path="/organizations" element={<AdminRoute><Organizations /></AdminRoute>} />
          <Route path="/analytics"   element={<AdminRoute allowTsa><Analytics /></AdminRoute>} />
          <Route path="/internal/submit"      element={<RaiseTicketRoute />} />
          <Route path="/internal/tickets"     element={<InternalTickets />} />
          <Route path="/internal/tickets/:id" element={<InternalTicketDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
