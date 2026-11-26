import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workError } from "@/lib/work-client";

type Delivery = { email: string; activationUrl: string; delivery: "sent" | "failed" };
type Result = Delivery | { email: string; error: string };
const emailSchema = z.email();
const batchLimit = 25;

export function BulkCustomerInvitations({ organizationId, inline = false }: { organizationId: string; inline?: boolean }) {
  const cache = useQueryClient();
  const [recipients, setRecipients] = useState("");
  const [access, setAccess] = useState<"MEMBER" | "MANAGER">("MEMBER");
  const emails = [...new Set(recipients.split(/[\s,;]+/).filter(Boolean).map((email) => email.toLowerCase()))];
  const invalid = emails.filter((email) => !emailSchema.safeParse(email).success);
  const invitations = useMutation({
    mutationFn: async ({ addresses, role }: { addresses: string[]; role: typeof access }) => {
      const results: Result[] = [];
      for (const email of addresses) {
        try {
          const { data } = await axios.post<Delivery>(`/api/organizations/${organizationId}/invitations`, { email, role }, { withCredentials: true });
          results.push(data);
        } catch (error) {
          results.push({ email, error: workError(error) });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      setRecipients(results.filter((item) => "error" in item).map((item) => item.email).join("\n"));
      void cache.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const form = (
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!invitations.isPending && emails.length && emails.length <= batchLimit && !invalid.length) {
            invitations.mutate({ addresses: emails, role: access });
          }
        }}>
          <Label htmlFor="bulk-invite-emails">Customer emails</Label>
          <Textarea id="bulk-invite-emails" aria-describedby="bulk-invite-help" rows={4} maxLength={10000} value={recipients}
            disabled={invitations.isPending} onChange={(event) => setRecipients(event.target.value)} />
          <p id="bulk-invite-help" className="text-xs text-muted-foreground">Enter up to {batchLimit} email addresses, separated by commas or line breaks. Each person gets their own activation link.</p>
          {invalid.length > 0 && <p role="alert" className="break-words text-sm text-destructive">Check these addresses: {invalid.join(", ")}</p>}
          {emails.length > batchLimit && <p role="alert" className="text-sm text-destructive">Reduce the list to {batchLimit} recipients.</p>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="bulk-invite-access">Ticket access</Label>
              <select id="bulk-invite-access" value={access} disabled={invitations.isPending}
                onChange={(event) => setAccess(event.target.value === "MANAGER" ? "MANAGER" : "MEMBER")} className="rounded-lg border bg-background p-2.5 text-sm">
                <option value="MEMBER">Own requests</option>
                <option value="MANAGER">All company requests</option>
              </select>
            </div>
            <Button type="submit" disabled={invitations.isPending || !emails.length || emails.length > batchLimit || !!invalid.length}>
              {invitations.isPending ? "Sending invitations…" : "Send invitations"}
            </Button>
          </div>
        </form>
        {invitations.data && <ul aria-label="Invitation results" className="divide-y rounded-lg border">
          {invitations.data.map((result) => <li key={result.email} className="space-y-2 p-3 text-sm">
            <p className="break-all font-medium">{result.email}</p>
            {"error" in result ? <p className="text-destructive">{result.error}</p> : result.delivery === "sent" ?
              <p className="text-muted-foreground">Invitation emailed.</p> : <>
                <p className="text-muted-foreground">Email delivery failed. Share this link with the intended recipient within 48 hours.</p>
                <Input aria-label={`Activation link for ${result.email}`} readOnly value={result.activationUrl} onFocus={(event) => event.currentTarget.select()} />
              </>}
          </li>)}
        </ul>}
      </div>
  );
  return inline ? <section className="rounded-xl border bg-card">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="font-semibold">Invite people</h2>
        <p className="mt-1 text-sm text-muted-foreground">Each person sets their own password from their personal invitation.</p>
      </div>
      {form}
    </section> : (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer border-b px-6 py-4 text-sm font-semibold">Bulk invitations</summary>
      {form}
    </details>
  );
}
