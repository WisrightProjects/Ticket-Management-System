import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();

  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const linkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      location.pathname === path
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold">
            Ticket Management
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className={linkClass("/")}>
              Dashboard
            </Link>
            {isAdmin && (
              <Link to="/users" className={linkClass("/users")}>
                Users
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session?.user?.name}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
