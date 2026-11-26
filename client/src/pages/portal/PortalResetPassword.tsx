import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CLIENT_LOGIN_PATH } from "@/lib/client-login";

export default function PortalResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const client = searchParams.get("client") === "1";
  const loginHref = client ? CLIENT_LOGIN_PATH : "/login?account=local";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or expired reset link.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetErr } = await resetPassword({ newPassword: password, token });
      if (resetErr) {
        setError("This reset link is invalid or has expired. Please request a new one.");
        return;
      }
      navigate(loginHref, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={token ? "Set new password" : "Reset link unavailable"}
      description={token ? "Choose a password with at least eight characters." : "Request a new password reset link to continue."}>
      {!token ? (
        <div className="space-y-3">
          <Button className="h-11 w-full" render={<Link to={client ? "/portal/forgot-password?client=1" : "/portal/forgot-password"} />}>Request a new reset link</Button>
          <Link to={loginHref} className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input id="new-password" type={showPw ? "text" : "password"} autoComplete="new-password" value={password}
                required placeholder="At least 8 characters" className="h-11 pr-11" onChange={(event) => setPassword(event.target.value)} />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw((value) => !value)}>
                {showPw ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} required
              placeholder="Repeat your password" className="h-11" onChange={(event) => setConfirm(event.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full">{loading ? "Saving…" : "Reset Password"}</Button>
          <Link to={loginHref} className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}
