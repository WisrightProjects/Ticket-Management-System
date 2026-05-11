import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  apiTicketSchema,
  assignableUsersSchema,
  type AssignableUser,
  TICKET_TYPES,
  PRIORITIES,
  TICKET_TYPE,
  legalNextStatuses,
  type StatusValue,
  type TicketTypeValue,
  type PriorityValue,
} from "@tms/core";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import { Sparkles, Loader2 } from "lucide-react";
import { EnumSelect } from "@/components/EnumSelect";
import { ImplementationPanel } from "@/components/ImplementationPanel";
import { DetailRow } from "@/components/DetailRow";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const API_URL = import.meta.env.VITE_API_URL || "";
const NO_CLIENT = "__none__";

interface TicketMetaSidebarProps {
  /** Human-readable ticket ID, e.g. "TKT-0001" */
  ticketId: string;
}

/**
 * Sidebar component that owns all metadata editing UI for a ticket:
 * project/client, assignee, status, category, priority, hours, created-by, created-at.
 * React Query deduplicates the ["ticket", ticketId] fetch with TicketDetail.
 */
function TicketMetaSidebar({ ticketId }: TicketMetaSidebarProps) {
  const queryClient = useQueryClient();

  // Hours inputs — controlled with focus-aware sync so unrelated mutation
  // refetches never discard in-progress edits.
  const estimatedRef = useRef<HTMLInputElement>(null);
  const actualRef    = useRef<HTMLInputElement>(null);
  const [estimatedVal, setEstimatedVal] = useState("");
  const [actualVal, setActualVal]       = useState("");

  const [pickerClientOverride, setPickerClientOverride] = useState<string>("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!ticketId,
  });

  const effectivePickerClientId = pickerClientOverride || (ticket?.hrmsClientId ?? "");

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["assignable-users", ticket?.hrmsProjectId ?? null],
    queryFn: async () => {
      const url = ticket?.hrmsProjectId
        ? `${API_URL}/api/tickets/assignable-users?projectId=${ticket.hrmsProjectId}`
        : `${API_URL}/api/tickets/assignable-users`;
      const res = await axios.get(url, { withCredentials: true });
      return assignableUsersSchema.parse(res.data);
    },
    enabled: !!ticket,
    staleTime: 60_000,
  });

  const { data: hrmsClients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["hrms-clients"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/clients`, { withCredentials: true });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: hrmsProjects = [] } = useQuery<{ id: string; projectCode: string; projectName: string }[]>({
    queryKey: ["hrms-projects", effectivePickerClientId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/projects?clientId=${effectivePickerClientId}`, { withCredentials: true });
      return res.data;
    },
    enabled: !!effectivePickerClientId,
    staleTime: 5 * 60 * 1000,
  });

  const projectMutation = useMutation({
    mutationFn: ({ projectId, projectName, clientId, clientName }: { projectId: string; projectName: string; clientId: string; clientName: string }) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/project`, { projectId, projectName, clientId, clientName }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch(
        `${API_URL}/api/tickets/${ticketId}/assignee`,
        { assignedToId },
        { withCredentials: true },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: StatusValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/status`, { status }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const typeMutation = useMutation({
    mutationFn: (type: TicketTypeValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/type`, { type }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: PriorityValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/priority`, { priority }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const estimatedHoursMutation = useMutation({
    mutationFn: async (val: number | null) => {
      const res = await axios.patch(
        `${API_URL}/api/tickets/${ticketId}/estimated-hours`,
        { estimatedHours: val },
        { withCredentials: true },
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const actualHoursMutation = useMutation({
    mutationFn: async (val: number | null) => {
      const res = await axios.patch(
        `${API_URL}/api/tickets/${ticketId}/actual-hours`,
        { actualHours: val },
        { withCredentials: true },
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const aiEstimateMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(
        `${API_URL}/api/tickets/${ticketId}/estimate-hours-ai`,
        {},
        { withCredentials: true },
      );
      return res.data as { estimatedHours: number };
    },
    onSuccess: (data) => {
      estimatedHoursMutation.mutate(data.estimatedHours);
    },
  });

  // Derived server values for hours sync
  const estimatedDefault = ticket?.estimatedHours == null ? "" : String(ticket.estimatedHours);
  const actualDefault    = ticket?.actualHours    == null ? "" : String(ticket.actualHours);

  // Sync hours inputs from server-confirmed value, but skip while focused
  // so that unrelated mutation refetches don't discard in-progress typing.
  useEffect(() => {
    if (document.activeElement !== estimatedRef.current) {
      setEstimatedVal(estimatedDefault);
    }
  }, [estimatedDefault]);

  useEffect(() => {
    if (document.activeElement !== actualRef.current) {
      setActualVal(actualDefault);
    }
  }, [actualDefault]);

  function commitHours(
    raw: string,
    current: number | null | undefined,
    mutate: (val: number | null) => void,
  ) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (current != null) mutate(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    if (current != null && Number(current) === parsed) return;
    mutate(parsed);
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Details</h3>

        <DetailRow label="Project">
          <div className="space-y-1.5 min-w-0">
            {/* Client row — static label when already assigned, full dropdown otherwise */}
            {ticket.hrmsClientId && !pickerClientOverride ? (
              <div className="flex items-center justify-between gap-2 h-8 px-2 rounded-md border border-border bg-background text-sm min-w-0">
                <span className="truncate text-sm">
                  {hrmsClients.find((c) => c.id === ticket.hrmsClientId)?.name ?? ticket.hrmsClientId}
                </span>
                <button
                  type="button"
                  onClick={() => setPickerClientOverride(ticket.hrmsClientId!)}
                  className="text-xs text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
                >
                  Change
                </button>
              </div>
            ) : (
              <Select
                value={effectivePickerClientId || NO_CLIENT}
                onValueChange={(val) => setPickerClientOverride(!val || val === NO_CLIENT ? "" : val)}
              >
                <SelectTrigger size="sm" className="w-full min-w-0" aria-label="Client">
                  {effectivePickerClientId ? (
                    <span className="truncate">
                      {hrmsClients.find((c) => c.id === effectivePickerClientId)?.name ?? "—"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select client…</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>
                    <span className="text-muted-foreground">— Select client —</span>
                  </SelectItem>
                  {hrmsClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {effectivePickerClientId && (
              <Select
                value=""
                onValueChange={(val) => {
                  const proj = hrmsProjects.find((p) => p.id === val);
                  if (!proj) return;
                  const client = hrmsClients.find((c) => c.id === effectivePickerClientId);
                  projectMutation.mutate({
                    projectId: proj.id,
                    projectName: proj.projectName,
                    clientId: effectivePickerClientId,
                    clientName: client?.name ?? "",
                  });
                  setPickerClientOverride("");
                }}
                disabled={projectMutation.isPending || hrmsProjects.length === 0}
              >
                <SelectTrigger size="sm" className="w-full min-w-0">
                  {ticket.hrmsProjectName ? (
                    <span className="flex items-center gap-1 min-w-0 overflow-hidden">
                      <span className="truncate">{ticket.hrmsProjectName}</span>
                      <span className="text-muted-foreground shrink-0">(change…)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select project…</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {hrmsProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {projectMutation.isError && (
              <p className="text-xs text-destructive">Failed to update project</p>
            )}
          </div>
        </DetailRow>

        <DetailRow label="Created by">
          {ticket.senderName ?? ticket.createdBy.name}
        </DetailRow>

        <DetailRow label="Status">
          <EnumSelect
            value={ticket.status}
            options={legalNextStatuses(ticket.status, ticket.type) as readonly StatusValue[]}
            labels={STATUS_LABELS}
            onValueChange={(val) => statusMutation.mutate(val)}
            disabled={statusMutation.isPending}
            isError={statusMutation.isError}
            errorMessage="Failed to update status"
          />
        </DetailRow>

        <DetailRow label="Category">
          <EnumSelect
            value={ticket.type}
            options={TICKET_TYPES}
            labels={CATEGORY_LABELS}
            onValueChange={(val) => typeMutation.mutate(val)}
            disabled={typeMutation.isPending}
            isError={typeMutation.isError}
            errorMessage="Failed to update category"
          />
        </DetailRow>

        <DetailRow label="Priority">
          <EnumSelect
            value={ticket.priority}
            options={PRIORITIES}
            labels={PRIORITY_LABELS}
            onValueChange={(val) => priorityMutation.mutate(val)}
            disabled={priorityMutation.isPending}
            isError={priorityMutation.isError}
            errorMessage="Failed to update priority"
          />
        </DetailRow>

        <DetailRow label="Estimated Hours">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={estimatedRef}
              data-testid="estimated-hours-display"
              type="number"
              min="0"
              max="9999.99"
              step="0.25"
              value={estimatedVal}
              onChange={(e) => setEstimatedVal(e.target.value)}
              onBlur={(e) =>
                commitHours(
                  e.currentTarget.value,
                  ticket.estimatedHours ?? null,
                  (v) => estimatedHoursMutation.mutate(v),
                )
              }
              disabled={estimatedHoursMutation.isPending || aiEstimateMutation.isPending}
              placeholder="—"
              aria-label="Estimated hours"
              className="h-9 px-3 rounded-md border border-border bg-background text-sm w-[100px] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => aiEstimateMutation.mutate()}
              disabled={aiEstimateMutation.isPending || estimatedHoursMutation.isPending}
              title="AI estimate"
              aria-label="AI estimate"
              className="inline-flex items-center gap-1 h-9 px-2 rounded-md border border-border bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 disabled:opacity-50"
            >
              {aiEstimateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI
            </button>
            {estimatedHoursMutation.isPending && !aiEstimateMutation.isPending && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
          {estimatedHoursMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to update estimated hours</p>
          )}
          {aiEstimateMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to get AI estimate</p>
          )}
        </DetailRow>

        <DetailRow label="Actual Hours">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={actualRef}
              data-testid="actual-hours-display"
              type="number"
              min="0"
              max="9999.99"
              step="0.25"
              value={actualVal}
              onChange={(e) => setActualVal(e.target.value)}
              onBlur={(e) =>
                commitHours(
                  e.currentTarget.value,
                  ticket.actualHours ?? null,
                  (v) => actualHoursMutation.mutate(v),
                )
              }
              disabled={actualHoursMutation.isPending}
              placeholder="—"
              aria-label="Actual hours"
              className="h-9 px-3 rounded-md border border-border bg-background text-sm w-[100px] disabled:opacity-50"
            />
            {actualHoursMutation.isPending && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
            {ticket.actualHours != null &&
              ticket.estimatedHours != null &&
              Number(ticket.actualHours) > Number(ticket.estimatedHours) * 1.2 && (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  Over estimate
                </Badge>
              )}
          </div>
          {actualHoursMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to update actual hours</p>
          )}
        </DetailRow>

        <DetailRow label="Assigned to">
          <Select
            value={ticket.assignedTo?.id ?? "unassigned"}
            onValueChange={(val) => assignMutation.mutate(val === "unassigned" ? null : val)}
          >
            <SelectTrigger size="sm" className="w-full" disabled={assignMutation.isPending}>
              {ticket.assignedTo
                ? <span>{ticket.assignedTo.name}</span>
                : <span className="text-muted-foreground">Unassigned</span>
              }
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-muted-foreground">Unassigned</span>
              </SelectItem>
              {assignableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to update assignee</p>
          )}
        </DetailRow>

        <DetailRow label="Created">
          {new Date(ticket.createdAt).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
          })}
        </DetailRow>
      </div>

      {/* Implementation request workflow panel — admin side */}
      {ticket.type === TICKET_TYPE.IMPLEMENTATION && <ImplementationPanel ticket={ticket} />}
    </div>
  );
}

export { TicketMetaSidebar };
