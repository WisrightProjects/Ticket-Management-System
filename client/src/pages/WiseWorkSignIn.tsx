import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { authClient, useSession } from "@/lib/auth-client";
import { ROLES } from "@tms/core";

export default function WiseWorkSignIn({ complete = false }: { complete?: boolean }) {
  const { data: session, isPending } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [failed, setFailed] = useState(params.has("error"));
  const user = session?.user as { role?: string; isActive?: boolean } | undefined;
  const staff = user?.isActive === true && (user.role === ROLES.AGENT || user.role === ROLES.ADMIN);

  useEffect(() => {
    if (isPending || failed) return;
    if (staff) {
      sessionStorage.setItem("tms_active", "1");
      navigate("/", { replace: true });
      return;
    }
    if (complete || session || started.current) return;
    started.current = true;
    const callbackURL = new URL("/staff/wisework/complete", window.location.origin);
    const errorCallbackURL = new URL(callbackURL);
    errorCallbackURL.searchParams.set("error", "wisework");
    void authClient.signIn.oauth2({
      providerId: "wisework",
      callbackURL: callbackURL.href,
      errorCallbackURL: errorCallbackURL.href,
    }).then(({ error }) => {
      if (error) setFailed(true);
    }).catch(() => setFailed(true));
  }, [complete, failed, isPending, navigate, session, staff]);

  const unavailable = failed || (!isPending && !staff && (complete || Boolean(session)));
  return (
    <AuthLayout title="WiseWork sign in">
      {unavailable ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-muted-foreground">Couldn’t sign in with WiseWork. Use a linked staff account or contact your Right Tracker administrator.</p>
          <Link className="text-sm font-medium text-primary hover:underline" to="/login">Back to staff sign-in</Link>
        </div>
      ) : <p role="status" className="text-sm text-muted-foreground">Opening your staff workspace…</p>}
    </AuthLayout>
  );
}
