import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { internalSubmitSchema, type InternalSubmitInput, INTERNAL_TICKET_TYPES, PRIORITIES } from "@tms/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EnumSelect } from "@/components/EnumSelect";
import { CheckCircle2 } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageHeader } from "@/components/PageHeader";

const TYPE_LABELS: Record<string, string> = {
  BUG:         "Bug",
  REQUIREMENT: "Requirement",
  TASK:        "Task",
  SUPPORT:     "Support",
  EXPLANATION: "Explanation",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW:      "Low",
  MEDIUM:   "Medium",
  HIGH:     "High",
  CRITICAL: "Critical",
};

export default function InternalSubmit() {
  const navigate  = useNavigate();
  const [done, setDone] = useState(false);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<InternalSubmitInput>({
    resolver: zodResolver(internalSubmitSchema),
    defaultValues: { type: "SUPPORT", priority: "MEDIUM" },
  });

  const ticketType = useWatch({ control, name: "type" });
  const priority = useWatch({ control, name: "priority" });

  const routing = useQuery({
    queryKey: ["internal-ticket-projects"],
    queryFn: async () => (await axios.get<{ projects: { id: string; name: string }[]; projectRequired: boolean }>("/api/internal/projects")).data,
  });

  const mutation = useMutation({
    mutationFn: (data: InternalSubmitInput) =>
      axios.post("/api/internal/tickets", data).then((r) => r.data),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8" style={{ background: "var(--rt-bg)" }}>
        <div className="bg-[var(--rt-surface)] rounded-2xl shadow-sm border border-[var(--rt-border)] p-10 text-center max-w-md w-full">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Ticket Submitted</h2>
          <p className="text-muted-foreground text-sm mb-6">Your ticket has been submitted and will be picked up by the team.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { reset(); setDone(false); }}>Submit Another</Button>
            <Button onClick={() => navigate("/tickets")}>Open Tickets</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8" style={{ background: "var(--rt-bg)" }}>
      <div className="w-full">
        <PageHeader
          title="Submit Internal Ticket"
          subtitle="Raise a staff request for the support queue."
        />

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-[var(--rt-surface)] rounded-2xl shadow-sm border border-[var(--rt-border)] p-6 space-y-5">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" placeholder="Brief summary of the issue" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Type + Priority row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <EnumSelect
                value={ticketType}
                options={INTERNAL_TICKET_TYPES}
                labels={TYPE_LABELS}
                onValueChange={(v) => setValue("type", v as InternalSubmitInput["type"])}
                width="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <EnumSelect
                value={priority}
                options={PRIORITIES}
                labels={PRIORITY_LABELS}
                onValueChange={(v) => setValue("priority", v as InternalSubmitInput["priority"])}
                width="w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="internal-project">Project {routing.data?.projectRequired && <span className="text-destructive">*</span>}</Label>
            <select id="internal-project" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              required={routing.data?.projectRequired} disabled={!routing.isSuccess}
              {...register("projectId", { setValueAs: (value: string) => value || undefined })}>
              <option value="">{routing.isPending ? "Loading projects…" : routing.data?.projectRequired ? "Select a project" : "General internal request"}</option>
              {routing.data?.projects.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
            {routing.isError && <ErrorBanner message="Unable to load ticket routing. Refresh the page to try again." />}
            {routing.data?.projectRequired && !routing.data.projects.length && (
              <p className="text-sm text-muted-foreground">No projects are available for your support role.</p>
            )}
            <p className="text-sm text-muted-foreground">Technical Support Admins can review this request. For a project ticket, the project lead and authorized project members can also see it.</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail…"
              rows={6}
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {mutation.isError && (
            <ErrorBanner message={axios.isAxiosError(mutation.error) && typeof mutation.error.response?.data?.error === "string" ? mutation.error.response.data.error : "Failed to submit ticket. Please try again."} />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/internal/tickets")}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !routing.isSuccess || (routing.data?.projectRequired && !routing.data.projects.length)}>
              {mutation.isPending ? "Submitting…" : "Submit Ticket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
