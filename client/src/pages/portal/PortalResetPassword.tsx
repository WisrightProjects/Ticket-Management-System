import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "@/lib/auth-client";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PortalResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

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
      navigate("/portal/login", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--rt-bg)" }}>
      {/* Header */}
      <header style={{ background: "var(--rt-accent)", flexShrink: 0 }}>
        <div className="flex items-center justify-between px-4 sm:px-6" style={{ height: "56px" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg px-5 py-1.5" style={{ background: "#ffffff" }}>
              <img src="/wisright-logo.png" alt="Right Tracker" style={{ height: "38px", width: "auto", objectFit: "contain" }} />
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-lg">Set New Password</CardTitle>
            <CardDescription className="text-center">
              Choose a strong password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-red-600 text-sm">Invalid or missing reset token.</p>
                <Link to="/portal/forgot-password" className="text-blue-600 hover:underline text-sm">
                  Request a new link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPw ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
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
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Saving..." : "Set New Password"}
                </Button>

                <p className="text-center text-sm text-gray-500">
                  <Link to="/portal/forgot-password" className="text-blue-600 hover:underline">
                    Request a new link
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
