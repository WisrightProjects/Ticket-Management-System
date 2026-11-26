import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { CLIENT_LOGIN_PATH } from "@/lib/client-login";
import { Button } from "@/components/ui/button";

export function SharedClientLogin() {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const url = new URL(CLIENT_LOGIN_PATH, window.location.origin).href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };
  return <div className="flex flex-wrap items-center gap-2">
    <Link to={CLIENT_LOGIN_PATH} className="rounded-sm text-sm font-medium text-primary hover:underline">Client sign-in</Link>
    <Button variant="outline" size="sm" type="button" onClick={copy}>
      {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {status === "copied" ? "Copied" : "Copy sign-in link"}
    </Button>
    {status === "error" && <p role="status" className="break-all text-xs text-muted-foreground">{url}</p>}
  </div>;
}
