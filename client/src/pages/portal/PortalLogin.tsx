import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useSession, signIn } from "@/lib/auth-client";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginState {
  ticketId?:  string;
  name?:      string;
  email?:     string;
  isNewUser?: boolean;
}

interface PortalInfo {
  customerName: string;
  slug:         string;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email:    z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z.object({
  name:     z.string().min(1, "Name is required").max(128),
  email:    z.string().email("Valid email required"),
  password: z.string().min(8, "At least 8 characters").max(128),
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

// ─── Sub-forms ────────────────────────────────────────────────────────────────

function SignInForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: "onBlur",
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = async (data: SignInFormData) => {
    setServerError("");
    const { error } = await signIn.email({
      email:       data.email,
      password:    data.password,
      callbackURL: "/portal/dashboard",
    });

    if (error) {
      setServerError("Invalid email or password");
      return;
    }

    // Bind this customer to the portal they're signing into
    const clientId = localStorage.getItem("portal-client-id");
    if (clientId) {
      await axios.patch("/api/portal/me/client", { clientId }, { withCredentials: true }).catch(() => null);
    }

    navigate("/portal/dashboard", { replace: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="you@example.com"
          {...register("email")}
          className={errors.email ? "border-red-400" : ""}
        />
        {errors.email && (
          <p className="text-red-500 text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <Link
            to="/portal/forgot-password"
            className="text-xs text-blue-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="signin-password"
            type={showPw ? "text" : "password"}
            placeholder="Your password"
            {...register("password")}
            className={errors.password ? "border-red-400 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-500 text-xs">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}

function SignUpForm({ defaultName = "", defaultEmail = "", clientId = "" }: { defaultName?: string; defaultEmail?: string; clientId?: string }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
    defaultValues: { name: defaultName, email: defaultEmail },
  });

  const onSubmit = async (data: SignUpFormData) => {
    setServerError("");

    try {
      await axios.post("/api/portal/auth/signup", {
        name:     data.name,
        email:    data.email,
        password: data.password,
        ...(clientId ? { clientId } : {}),
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setServerError("An account with this email already exists");
      } else {
        setServerError("Failed to create account. Please try again.");
      }
      return;
    }

    const { error } = await signIn.email({
      email:       data.email,
      password:    data.password,
      callbackURL: "/portal/dashboard",
    });

    if (error) {
      setServerError("Account created but sign-in failed. Please sign in manually.");
      return;
    }

    // Bind this customer to the portal they signed up through
    if (clientId) {
      await axios.patch("/api/portal/me/client", { clientId }, { withCredentials: true }).catch(() => null);
    }

    navigate("/portal/dashboard", { replace: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Name</Label>
        <Input
          id="signup-name"
          placeholder="Your full name"
          {...register("name")}
          className={errors.name ? "border-red-400" : ""}
        />
        {errors.name && (
          <p className="text-red-500 text-xs">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          {...register("email")}
          className={errors.email ? "border-red-400" : ""}
        />
        {errors.email && (
          <p className="text-red-500 text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPw ? "text" : "password"}
            placeholder="At least 8 characters"
            {...register("password")}
            className={errors.password ? "border-red-400 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-500 text-xs">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "signin" | "signup";

export default function PortalLogin() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session, isPending } = useSession();
  const location   = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const navigate   = useNavigate();
  const fromSubmit = (location.state ?? {}) as LoginState;

  const [activeTab, setActiveTab] = useState<Tab>(
    fromSubmit.isNewUser ? "signup" : "signin"
  );

  // Fetch portal info to show client name and redirect to name-based URL
  const { data: portalInfo } = useQuery<PortalInfo>({
    queryKey: ["portal", slug],
    queryFn:  async () => {
      const res = await axios.get<PortalInfo>(`/api/portal/${slug}`);
      return res.data;
    },
    enabled:  Boolean(slug),
    retry:    false,
    staleTime: 5 * 60 * 1000,
  });

  // Redirect C1396-style slug → missing-connectz style
  useEffect(() => {
    if (portalInfo && slug) {
      const nameSlug = portalInfo.customerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      localStorage.setItem("portal-slug", nameSlug);
      // Store the HRMS client ID so signup can bind the account to this client
      const clientId = (portalInfo as unknown as { id?: string }).id;
      if (clientId) localStorage.setItem("portal-client-id", clientId);
      if (nameSlug && nameSlug !== slug.toLowerCase()) {
        navigate(`/portal/${nameSlug}/login`, { replace: true, state: location.state });
      }
    }
  }, [portalInfo, slug, navigate, location.state]);

  if (!isPending && session) {
    const role = (session.user as unknown as { role?: string }).role;
    if (role === "CUSTOMER") {
      return <Navigate to="/portal/dashboard" replace />;
    }
  }

  const storedClientId = localStorage.getItem("portal-client-id") ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--rt-bg)" }}>
      {/* Top navbar */}
      <header
        style={{
          background:   "var(--rt-accent)",
          borderBottom: "none",
          flexShrink:   0,
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6" style={{ height: "56px" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg px-5 py-1.5" style={{ background: "#ffffff" }}>
              <img
                src="/wisright-logo.png"
                alt="Right Tracker"
                style={{ height: "38px", width: "auto", objectFit: "contain" }}
              />
            </div>
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.3)" }} />
            <span className="text-sm font-bold" style={{ color: "#ffffff", whiteSpace: "nowrap" }}>
              Right Tracker
              <span className="hidden sm:inline font-normal text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>— WisRight's Support Tool</span>
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.22)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.12)"; }}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Success banner after ticket submission */}
        {fromSubmit.ticketId && (
          <div className="w-full max-w-md mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-green-500 text-lg leading-none mt-0.5">✓</span>
            <div>
              <p className="text-green-800 font-semibold text-sm">
                Ticket <span className="font-mono">{fromSubmit.ticketId}</span> submitted!
              </p>
              <p className="text-green-700 text-xs mt-0.5">
                {fromSubmit.isNewUser
                  ? "Create an account to track your ticket status online."
                  : "Sign in to view and track your ticket."}
              </p>
            </div>
          </div>
        )}

        <Card className="w-full max-w-md">
          <CardHeader className="pb-2">
            {/* Logo inside white card */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center rounded-xl px-4 py-2 sm:px-5 sm:py-3" style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
                <img src="/wisright-logo.png" alt="Right Tracker" style={{ height: "64px", width: "auto", objectFit: "contain" }} />
              </div>
            </div>
            <CardTitle className="text-center text-xl">
              Right Tracker{" "}
              <span className="font-normal text-base text-muted-foreground">
                {activeTab === "signin" ? "(Customer Login)" : "(Create Account)"}
              </span>
            </CardTitle>
            {portalInfo?.customerName && (
              <p className="text-center text-sm mt-1" style={{ color: "var(--rt-text-3)" }}>
                Welcome to{" "}
                <span className="font-semibold" style={{ color: "var(--rt-text-1)" }}>
                  {portalInfo.customerName}
                </span>{" "}
                support
              </p>
            )}
          </CardHeader>
          <CardContent>
            {/* Tabs — only shown after ticket submission (isNewUser) */}
            {fromSubmit.isNewUser && (
              <div className="flex rounded-lg border border-gray-200 p-1 mb-6 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setActiveTab("signin")}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                    activeTab === "signin"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                    activeTab === "signup"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {activeTab === "signin"
              ? <SignInForm defaultEmail={fromSubmit.email ?? ""} />
              : <SignUpForm defaultName={fromSubmit.name ?? ""} defaultEmail={fromSubmit.email ?? ""} clientId={storedClientId} />
            }

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <Link
                to={`/portal/${slug}/submit`}
                className="text-sm text-muted-foreground hover:underline"
              >
                Submit your First Ticket here →
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
