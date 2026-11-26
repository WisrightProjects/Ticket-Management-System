import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { ListPagination } from "@/components/ListPagination";
import { SharedClientLogin } from "@/components/SharedClientLogin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { readableOrganizationName, workError } from "@/lib/work-client";

type Workspace = { id: string; name: string; hrmsClientId?: string | null; isActive?: boolean };
type Client = { id: string; name: string };
type ClientRow = { id: string; name: string; status: "Ready" | "Not set up" | "Needs review"; workspace?: Workspace; clientId?: string };

export default function Clients() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const directory = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await axios.get<Client[]>("/api/tickets/clients", { withCredentials: true });
      return { clients: res.data, source: res.headers?.["x-client-directory-source"] as string | undefined };
    },
  });
  const workspaces = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => (await axios.get<Workspace[]>("/api/organizations", { withCredentials: true })).data,
  });
  const openWorkspace = async (id: string) => {
    await cache.invalidateQueries({ queryKey: ["organizations"] });
    navigate(`/clients/${encodeURIComponent(id)}`);
  };
  const setup = useMutation({
    mutationFn: async (clientId: string) => (await axios.post<{ id: string }>("/api/organizations/client-setup", { clientId }, { withCredentials: true })).data,
    onSuccess: ({ id }) => openWorkspace(id),
  });
  const add = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "") || `client-${crypto.randomUUID()}`;
      return (await axios.post<{ id: string }>("/api/organizations", { name, slug }, { withCredentials: true })).data;
    },
    onSuccess: ({ id }) => openWorkspace(id),
  });
  const reviewId = axios.isAxiosError(setup.error) && typeof setup.error.response?.data?.organizationId === "string"
    ? setup.error.response.data.organizationId : undefined;

  const companies = directory.data?.source === "ticket-history" || !Array.isArray(directory.data?.clients) ? [] : directory.data.clients;
  const saved = Array.isArray(workspaces.data) ? workspaces.data : [];
  const byClient = new Map(saved.filter((item) => item.hrmsClientId).map((item) => [item.hrmsClientId, item]));
  const knownIds = new Set(companies.map(({ id }) => id));
  const rows: ClientRow[] = [
    ...companies.map(({ id, name }): ClientRow => {
      const workspace = byClient.get(id);
      return { id: `wisework:${id}`, name, clientId: id, workspace, status: workspace ? workspace.isActive === false ? "Needs review" : "Ready" : "Not set up" };
    }),
    ...saved.filter(({ hrmsClientId }) => !hrmsClientId || !knownIds.has(hrmsClientId)).map((workspace): ClientRow => ({
      id: workspace.id,
      name: readableOrganizationName(workspace.name) ?? "Unnamed company",
      workspace,
      status: workspace.hrmsClientId || workspace.isActive === false ? "Needs review" : "Ready",
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = rows.filter((row) => (!status || row.status === status) && row.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const first = (currentPage - 1) * pageSize;
  const visible = filtered.slice(first, first + pageSize);
  const loading = directory.isPending || workspaces.isPending;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Clients" subtitle="Set up customer portals and manage who can sign in."
        actions={<Button onClick={() => { add.reset(); setCompanyName(""); setAddOpen(true); }}><Plus aria-hidden="true" />Add client</Button>} />
      {workspaces.isError && <ErrorBanner message="Could not load client workspaces. Refresh to try again." />}
      {(directory.isError || directory.data?.source === "ticket-history") && <p role="status" className="mb-4 text-sm text-muted-foreground">The WiseWork directory is unavailable. Existing client workspaces are still listed.</p>}
      {directory.data?.source === "local-snapshot" && <p className="mb-4 text-xs text-muted-foreground">WiseWork companies are listed from the local snapshot.</p>}
      {setup.isError && <div role="alert" className="mb-4 rounded-lg border border-destructive/25 p-3 text-sm text-destructive">
        {workError(setup.error)} {reviewId && <Link className="font-semibold underline" to={`/clients/${encodeURIComponent(reviewId)}`}>Open existing workspace</Link>}
      </div>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Input aria-label="Search clients" className="w-full sm:w-64" placeholder="Search clients…" value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          <select aria-label="Portal status" className="h-8 rounded-lg border border-input bg-card px-2 text-sm" value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All portal statuses</option>
            {["Ready", "Not set up", "Needs review"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <SharedClientLogin />
      </div>

      {loading ? <div aria-label="Loading clients" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
      </div> : !visible.length ? <EmptyState icon={Building2} title={search || status ? "No clients match these filters." : "No clients found."} />
        : <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((row) => (
              <article key={row.id} data-testid="client-card" className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border bg-card p-4">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold">{row.name}</h2>
                    <Badge variant={row.status === "Ready" ? "secondary" : "outline"} className="mt-1">{row.status}</Badge>
                  </div>
                </div>
                {row.workspace ? <Button size="sm" variant="outline" className="self-start" render={<Link to={`/clients/${encodeURIComponent(row.workspace.id)}`} />}>
                  Manage client <ChevronRight aria-hidden="true" />
                </Button> : <Button size="sm" className="self-start" disabled={setup.isPending || workspaces.isError}
                    onClick={() => { if (row.clientId) setup.mutate(row.clientId); }}>
                  {setup.isPending && setup.variables === row.clientId ? "Setting up…" : "Set up portal"}
                </Button>}
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{first + 1}–{first + visible.length} of {filtered.length} clients</span>
            <ListPagination page={currentPage} totalPages={totalPages} onPageChange={setPage}
              pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
          </div>
        </>}

      <Dialog open={addOpen} onOpenChange={(open) => { if (!add.isPending) setAddOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>Use this for a company without a WiseWork record. For a WiseWork company, find it in Clients and select Set up portal.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); add.mutate(companyName.trim()); }}>
            <Label htmlFor="new-client-name">Company name</Label>
            <Input id="new-client-name" required minLength={2} maxLength={150} value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            {add.isError && <p role="alert" className="text-sm text-destructive">{workError(add.error)}</p>}
            <Button type="submit" disabled={add.isPending || companyName.trim().length < 2}>{add.isPending ? "Creating…" : "Create client"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
