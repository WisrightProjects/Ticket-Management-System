import { CLIENT_LOGIN_PATH } from "@/lib/client-login";
import { AuthLayout } from "@/components/AuthLayout";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ActivateAccount() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState(false);
  const token = params.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const invitation = useQuery({ queryKey: ["invitation", token], queryFn: async () => (await axios.get<{ email: string; organization: string }>("/api/onboarding/invitation", { params: { token } })).data, enabled: !!token, retry: false });
  const activate = useMutation({ mutationFn: () => axios.post("/api/onboarding/activate", { token, name, password }) });
  if (!token) {
    return (
      <AuthLayout clientSignIn title="Set your password" description="Paste the personal invitation link from your support team.">
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          try {
            const url = new URL(link.trim());
            const invitationToken = url.searchParams.get("token") ?? "";
            if (url.pathname !== "/activate" || !/^[a-f0-9]{64}$/.test(invitationToken)) throw new Error();
            navigate(`/activate?token=${invitationToken}`, { replace: true });
          } catch {
            setLinkError(true);
          }
        }}>
          <div className="space-y-2">
            <Label htmlFor="invitation-link">Invitation link</Label>
            <Input id="invitation-link" value={link} required autoComplete="off" onChange={(event) => {
              setLink(event.target.value);
              setLinkError(false);
            }} />
            {linkError && <p role="alert" className="text-sm text-destructive">Enter the full invitation link from your support team.</p>}
          </div>
          <Button type="submit" className="h-11 w-full">Open invitation</Button>
          <Link to={CLIENT_LOGIN_PATH} className="block text-center text-sm font-medium text-primary hover:underline">Back to client sign in</Link>
        </form>
      </AuthLayout>
    );
  }

  return <AuthLayout clientSignIn title="Set up your account">
      {invitation.isPending ? <p className="py-6">Checking your invitation…</p> : invitation.isError ? <div role="alert" className="mt-5 space-y-4"><p>This invitation has expired or is no longer available. Ask your administrator for a new link.</p><Link to={CLIENT_LOGIN_PATH} className="underline">Back to sign in</Link></div> : activate.isSuccess ? <div className="mt-6 space-y-4"><p>Your account is ready. Sign in with your email and new password.</p><Button render={<Link to={CLIENT_LOGIN_PATH} />}>Continue to sign in <ArrowRight className="size-4" /></Button></div> : <>
        <p className="text-sm text-muted-foreground mt-2 mb-6">Join {invitation.data?.organization} to submit requests and follow every update.</p>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (password === confirm) activate.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="activation-email">Email address</Label><Input id="activation-email" name="email" type="email" autoComplete="username" value={invitation.data?.email ?? ""} readOnly /></div>
          <div className="space-y-2"><Label htmlFor="activation-name">Your name</Label><Input id="activation-name" required maxLength={128} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
          <div className="space-y-2">
            <Label htmlFor="activation-password">Password</Label>
            <div className="relative">
              <Input id="activation-password" name="new-password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="pr-10" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activation-confirm">Confirm password</Label>
            <div className="relative">
              <Input id="activation-confirm" type={showConfirmation ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="pr-10" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowConfirmation((visible) => !visible)}>
                {showConfirmation ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </div>
          {confirm && confirm !== password && <p role="alert" className="text-sm text-destructive">Passwords do not match.</p>}
          {activate.isError && <p role="alert" className="text-sm text-destructive">{axios.isAxiosError(activate.error) ? activate.error.response?.data?.error : "Unable to activate your account."}</p>}
          <Button type="submit" className="w-full" disabled={activate.isPending || !name.trim() || !password || password !== confirm}>{activate.isPending && <Loader2 className="size-4 animate-spin" />} Create my account</Button>
        </form>
      </>}
  </AuthLayout>;
}
