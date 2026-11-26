import { Link, useParams } from "react-router-dom";
import { SharedClientLogin } from "@/components/SharedClientLogin";
import { readableOrganizationName } from "@/lib/work-client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Building2, MailPlus, Plus, Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BulkCustomerInvitations } from "@/components/BulkCustomerInvitations";

import { OrganizationProjectLink } from "@/components/OrganizationProjectLink";

type Organization = { id: string; name: string; slug: string; hrmsClientId?: string | null; _count: { memberships: number; tickets: number }; memberships: Array<{ id: string; role: string; user: { name: string; email: string; isActive: boolean } }>; invitations: Array<{ id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null }> };
export default function Organizations() {
  const { organizationId } = useParams();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [selected, setSelected] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const [delivery, setDelivery] = useState("");
  const [copied, setCopied] = useState(false);
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: async () => (await axios.get<Organization[]>("/api/organizations", { withCredentials: true })).data });
  const current = organizationId
    ? organizations.data?.find((o) => o.id === organizationId)
    : organizations.data?.find((o) => o.id === selected) ?? organizations.data?.[0];
  const refresh = () => { void cache.invalidateQueries({ queryKey: ["organizations"] }); };
  const create = useMutation({ mutationFn: () => axios.post("/api/organizations", { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }, { withCredentials: true }), onSuccess: (response) => { setSelected(response.data.id); setName(""); refresh(); } });
  const invite = useMutation({ mutationFn: () => axios.post<{ activationUrl: string; delivery: string }>(`/api/organizations/${current?.id}/invitations`, { email, role }, { withCredentials: true }), onSuccess: ({ data }) => { setActivationUrl(data.activationUrl); setDelivery(data.delivery); setCopied(false); setEmail(""); refresh(); } });
  const revoke = useMutation({ mutationFn: (id: string) => axios.delete(`/api/organizations/${current?.id}/invitations/${id}`, { withCredentials: true }), onSuccess: refresh });
  const error = create.error ?? invite.error ?? revoke.error;
  const accessSections = current && <><section className="rounded-xl border bg-card overflow-hidden"><h2 className="font-semibold p-5 border-b flex items-center gap-2"><Users size={18} />Members</h2>{!current.memberships.length ? <p className="p-6 text-sm text-muted-foreground">No members yet. Invite a customer to get started.</p> : current.memberships.map((m) => <div key={m.id} className="flex justify-between items-center border-b last:border-0 p-5"><div><p className="text-sm font-medium">{m.user.name}</p><p className="text-xs text-muted-foreground mt-1">{m.user.email}</p></div><span className="text-xs text-muted-foreground">{m.role === "MANAGER" ? "Organization manager" : "Member"} · {m.user.isActive ? "Active" : "Inactive"}</span></div>)}</section><section className="rounded-xl border bg-card overflow-hidden"><h2 className="font-semibold p-5 border-b">Invitations</h2>{!current.invitations.length ? <p className="p-6 text-sm text-muted-foreground">Invitations will appear here.</p> : current.invitations.map((i) => <div className="p-4 border-b last:border-0 flex justify-between items-center gap-3" key={i.id}><div><p className="text-sm">{i.email}</p><p className="text-xs text-muted-foreground mt-1">{i.acceptedAt ? "Accepted" : i.revokedAt ? "Revoked" : new Date(i.expiresAt) < new Date() ? "Expired" : "Pending"}</p></div>{!i.acceptedAt && !i.revokedAt && <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id)}>Revoke</Button>}</div>)}</section></>;
  if (organizationId) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Link to="/clients" className="text-sm font-medium text-primary hover:underline">Back to Clients</Link>
        {organizations.isPending ? <p role="status">Loading client…</p> : organizations.isError || !current ? (
          <p role="alert" className="text-destructive">{organizations.isError ? "Unable to load this client." : "Client workspace not found."}</p>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{readableOrganizationName(current.name) ?? "Unnamed client"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage portal access and customer invitations.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SharedClientLogin />
                <Link className="rounded-sm text-sm font-medium text-primary hover:underline" to={`/tickets?organizationId=${encodeURIComponent(current.id)}&date=all`}>View tickets</Link>
              </div>
            </header>
            {revoke.isError && <p role="alert" className="text-destructive">Unable to revoke the invitation. Try again.</p>}
            <BulkCustomerInvitations key={current.id} organizationId={current.id} inline />
            {accessSections}
            <details className="rounded-xl border bg-card p-5">
              <summary className="cursor-pointer font-semibold">Client settings</summary>
              <div className="mt-4">
                <OrganizationProjectLink key={current.id} organizationId={current.id} clientId={current.hrmsClientId} organizations={organizations.data ?? []} />
              </div>
            </details>
          </>
        )}
      </div>
    );
  }
  return <div className="p-6 lg:p-8 space-y-7"><div className="flex items-center gap-3"><div className="rounded-xl border bg-card p-3"><Building2 className="size-6 text-primary" /></div><div><h1 className="text-2xl font-semibold tracking-tight">Organizations</h1><p className="text-sm text-muted-foreground mt-1">Manage customer workspaces, access and invitations.</p></div></div>
    {error && <p role="alert" className="rounded-lg border border-destructive/20 p-4 text-sm text-destructive">{axios.isAxiosError(error) ? error.response?.data?.error : "Unable to save changes"}</p>}
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]"><aside className="space-y-5"><form className="rounded-xl border bg-card p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><h2 className="text-sm font-semibold">Create organization</h2><Label htmlFor="organization-name">Company name</Label><Input id="organization-name" required minLength={2} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Technologies" /><Button type="submit" size="sm" disabled={create.isPending || !name.trim()}><Plus size={15} />Create organization</Button></form><div className="rounded-xl border bg-card p-2">{organizations.isPending ? <p className="p-4 text-sm">Loading organizations…</p> : organizations.isError ? <p role="alert" className="p-4 text-sm text-destructive">Unable to load organizations.</p> : !organizations.data?.length ? <p className="p-4 text-sm text-muted-foreground">Create your first customer workspace.</p> : organizations.data.map((o) => <button key={o.id} onClick={() => { setSelected(o.id); setActivationUrl(""); }} className={`block text-left w-full p-3 rounded-lg ${current?.id === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}><span className="text-sm font-medium">{readableOrganizationName(o.name) ?? "Unnamed organization"}</span><span className="block text-xs text-muted-foreground mt-1">{o._count.memberships} members · {o._count.tickets} requests</span></button>)}</div></aside>
      {current && <div className="space-y-6"><OrganizationProjectLink key={current.id} organizationId={current.id} clientId={current.hrmsClientId} organizations={organizations.data ?? []} /><section className="rounded-xl border bg-card p-6"><div className="flex items-center gap-2 mb-1"><MailPlus size={18} /><h2 className="font-semibold">Invite a customer</h2></div><p className="text-sm text-muted-foreground mb-5">Invite someone to {readableOrganizationName(current.name) ?? "this organization"}. They’ll set their own name and password.</p><form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}><div className="space-y-2 flex-1 min-w-48"><Label htmlFor="invite-email">Customer email</Label><Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@company.com" /></div><div className="space-y-2"><Label htmlFor="invite-role">Access level</Label><select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border bg-background p-2.5 text-sm"><option value="MEMBER">Own requests</option><option value="MANAGER">Organization requests</option></select></div><Button type="submit" disabled={invite.isPending}>Send invitation</Button></form>
        {activationUrl && <div className="mt-5 rounded-lg border bg-muted/40 p-4 space-y-3"><p role="status" className="text-sm">{delivery === "sent" ? "Invitation email sent. The link expires in 48 hours." : "Email delivery is unavailable. Share this activation link securely with the intended customer. It expires in 48 hours."}</p><div className="flex gap-2"><Input aria-label="Activation link" readOnly value={activationUrl} /><Button type="button" variant="outline" aria-label="Copy activation link" onClick={async () => { await navigator.clipboard.writeText(activationUrl); setCopied(true); }}><Copy size={15} />{copied ? "Copied" : "Copy"}</Button></div></div>}
      </section><BulkCustomerInvitations key={current.id} organizationId={current.id} />{accessSections}</div>}
    </div></div>;
}
