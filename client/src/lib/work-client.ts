import axios from "axios";
import type { QueueQuery, StatusValue, PriorityValue, TicketTypeValue } from "@tms/core";

export const WORK_API = `${import.meta.env.VITE_API_URL || ""}/api/work`;
export type WorkOptions = {
  staff: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  teams: { id: string; name: string; members: { userId: string; user: { name: string; isActive: boolean } }[] }[];
  myTeamIds: string[];
  headedProjects?: string[];
};
export type QueueTicket = {
  ticketId: string; title: string; status: StatusValue; priority: PriorityValue; type: TicketTypeValue;
  senderName: string | null; senderEmail: string | null; assignedToId: string | null; teamId: string | null;
  hrmsProjectId?: string | null;
  hrmsClientName?: string | null;
  assignedTo: { name: string } | null; team: { id: string; name: string } | null;
  organization: { id: string; name: string } | null; createdBy: { name: string };
  dueAt: string | null; updatedAt: string; createdAt: string;
};
export type QueueResponse = { data: QueueTicket[]; total: number; totalPages: number; page: number; asOf: string; counts: Record<QueueQuery["queue"], number> };
export type SavedView = { id: string; name: string; filters: QueueQuery };
export const workOptionsQuery = {
  queryKey: ["work-options"],
  queryFn: async () => (await axios.get<WorkOptions>(`${WORK_API}/options`, { withCredentials: true })).data,
  staleTime: 30_000,
};
export function queueUrl(filters: Partial<QueueQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value != null && value !== "") params.set(key, String(value));
  return params;
}
export function workError(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error : "Unable to save changes. Please try again.";
}

export function readableOrganizationName(name?: string | null): string | undefined {
  const label = name?.trim();
  if (label && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(label)) return label;
}
