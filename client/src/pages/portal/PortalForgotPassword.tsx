import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CLIENT_LOGIN_PATH } from "@/lib/client-login";
import { requestPasswordReset } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

export default function PortalForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [params] = useSearchParams();
  const client = params.get("client") === "1";
  const loginHref = client ? CLIENT_LOGIN_PATH : "/login?account=local";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/portal/reset-password${client ? "?client=1" : ""}`,
      });
      if (resetError) {
        setError("Couldn’t request a reset link. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={sent ? "Check your inbox" : "Forgot password?"}
      description={sent ? "If an account exists for that address, you’ll receive a reset link." : "Enter the email address you use to sign in."}>
      {sent ? (
        <div className="space-y-5">
          <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Open the reset link in your email to choose a new password. Check your spam folder if you don’t see it.</p>
          <Link to={loginHref} className="text-sm font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email address</Label>
            <Input id="reset-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} required
              className="h-11" onChange={(event) => setEmail(event.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full">{loading ? "Sending…" : "Send Reset Link"}</Button>
          <Link to={loginHref} className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}
