import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Label } from "@/components/ui/label";
import { readableOrganizationName, workError } from "@/lib/work-client";

export function OrganizationProjectLink({ organizationId, clientId, organizations }: {
  organizationId: string;
  clientId?: string | null;
  organizations: { id: string; name: string; hrmsClientId?: string | null }[];
}) {
  const cache = useQueryClient();
  const clients = useQuery({
    queryKey: ["wisework-clients"],
    queryFn: async () => (await axios.get<{ id: string; customerName: string }[]>("/api/organizations/wisework-clients", { withCredentials: true })).data,
  });
  const link = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/organizations/${organizationId}/wisework-client`, { clientId: id || null }, { withCredentials: true }),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["organizations"] }); },
  });
  const availableClients = Array.isArray(clients.data) ? clients.data : [];
  const linkedElsewhere = new Map(organizations.filter((organization) => organization.id !== organizationId)
    .map((organization) => [organization.hrmsClientId, readableOrganizationName(organization.name) ?? "another organization"]));
  return (
    <section className="space-y-2 rounded-xl border bg-card p-5">
      <Label htmlFor="organization-wisework-client">WiseWork client</Label>
      <select id="organization-wisework-client" className="block max-w-full rounded-lg border bg-background p-2 text-sm"
        value={clientId ?? ""} disabled={clients.isPending || link.isPending} onChange={(event) => link.mutate(event.target.value)}>
        <option value="">No linked client</option>
        {clientId && !availableClients.some((client) => client.id === clientId) && <option value={clientId}>Linked client unavailable in WiseWork</option>}
        {availableClients.map((client) => {
          const linked = linkedElsewhere.get(client.id);
          return <option key={client.id} value={client.id} disabled={!!linked}>{client.customerName}{linked ? ` · linked to ${linked}` : ""}</option>;
        })}
      </select>
      <p className="text-xs text-muted-foreground">Link the company to make its active WiseWork projects available when customers submit requests.</p>
      {link.isError && <p role="alert" className="text-sm text-destructive">{workError(link.error)}</p>}
    </section>
  );
}
