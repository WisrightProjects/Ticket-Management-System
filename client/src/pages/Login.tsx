import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { authClient, signIn } from "@/lib/auth-client";
import { ROLES } from "@tms/core";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { CLIENT_LOGIN_PATH, clientPortalDestination } from "@/lib/client-login";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const rememberedClientEmailKey = "right-tracker:remembered-client-email";

function readRememberedClientEmail() {
  try {
    return localStorage.getItem(rememberedClientEmailKey) ?? "";
  } catch {
    return "";
  }
}

function saveRememberedClientEmail(email: string) {
  try {
    if (email) localStorage.setItem(rememberedClientEmailKey, email);
    else localStorage.removeItem(rememberedClientEmailKey);
  } catch {
    // Sign-in also works when the browser blocks storage.
  }
}

function Login({ client = false }: { client?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const showAccountForm = client || params.get("account") === "local";
  const accountParams = new URLSearchParams(params);
  if (showAccountForm) accountParams.delete("account");
  else accountParams.set("account", "local");
  const accountHref = accountParams.size ? `/login?${accountParams}` : "/login";
  const cache = useQueryClient();
  const [rememberedEmail] = useState(() => client ? readRememberedClientEmail() : "");
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: rememberedEmail },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError("");

    const { error } = await signIn.email({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setServerError(error.message || "Invalid email or password");
      return;
    }

    sessionStorage.setItem("tms_active", "1");
    cache.clear();
    const { data: session } = await authClient.getSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    const returnTo = params.get("returnTo");
    if (role === ROLES.CUSTOMER) {
      if (client && rememberEmail) saveRememberedClientEmail(data.email);
      navigate(clientPortalDestination(returnTo), { replace: true });
    } else if (!client) {
      navigate(returnTo && /^\/(?:tickets(?:\/TKT-\d+)?)?(?:\?[^#]*)?$/.test(returnTo) ? returnTo : "/", { replace: true });
    }
  };

  return (
    <AuthLayout clientSignIn={client} title={client ? "Client sign in" : showAccountForm ? "Right Tracker sign in" : "Welcome back"}
      description={client ? "Sign in with the work email that received your invitation." : "Sign in to your Right Tracker workspace."}>
      {!showAccountForm && (
        <div className="mb-5 space-y-4">
          <Button className="h-11 w-full" render={<Link to="/staff/wisework" />}>Continue with WiseWork</Button>
          <p className="text-center text-sm text-muted-foreground">
            Have a separate Right Tracker account?{" "}
            <Link to={accountHref} className="font-medium text-primary underline-offset-4 hover:underline">Sign in</Link>
          </p>
        </div>
      )}
      {showAccountForm && <>
      {serverError && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="username" placeholder="you@company.com" className="h-11" {...register("email")}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "login-email-error" : undefined} />
          {errors.email && <p id="login-email-error" className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link to={client ? "/portal/forgot-password?client=1" : "/portal/forgot-password"} className="text-xs font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password"
              className="h-11 pr-11" {...register("password")} aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          {errors.password && <p id="login-password-error" className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        {client && (
          <div className="space-y-1.5">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={rememberEmail} aria-describedby="remember-email-help"
                className="size-4 accent-primary" onChange={(event) => {
                  setRememberEmail(event.target.checked);
                  if (!event.target.checked) saveRememberedClientEmail("");
                }} />
              Remember my email
            </label>
            <p id="remember-email-help" className="text-xs leading-relaxed text-muted-foreground">Your browser can fill your password if you save it in its password manager.</p>
          </div>
        )}
        <Button type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full font-semibold">
          {isSubmitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
      {!client && (
        <Link to={accountHref} onClick={() => { setServerError(""); setShowPassword(false); }}
          className="mt-4 block text-center text-xs font-medium text-primary hover:underline">
          Back to staff sign-in options
        </Link>
      )}
      </>}
      {client && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          First time signing in?{" "}
          <Link to="/activate" className="font-medium text-primary underline-offset-4 hover:underline">Set your password</Link>
        </p>
      )}
      {!client && <Link to={CLIENT_LOGIN_PATH} className="mt-4 block text-center text-xs font-medium text-primary hover:underline">Client sign in</Link>}
    </AuthLayout>
  );
}

export default Login;
