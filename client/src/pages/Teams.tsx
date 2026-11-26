import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { UsersRound, Plus, ArrowLeft } from "lucide-react";
import { WORK_API, workOptionsQuery, workError, type WorkOptions } from "@/lib/work-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function TeamMembers({ team, staff }: { team: WorkOptions["teams"][number]; staff: WorkOptions["staff"] }) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState(team.members.map((m) => m.userId));
  const save = useMutation({
    mutationFn: () => axios.put(`${WORK_API}/teams/${team.id}/members`, { memberIds: selected }, { withCredentials: true }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["work-options"] }); },
  });
  const names = [...staff, ...team.members.filter((m) => !staff.some((s) => s.id === m.userId)).map((m) => ({ id: m.userId, name: `${m.user.name} (inactive)` }))];
  return <section className="rounded-xl border bg-card p-5 space-y-4"><div className="flex justify-between gap-3"><h2 className="font-semibold">{team.name}</h2><span className="text-xs text-muted-foreground">{team.members.length} members</span></div><fieldset className="grid gap-3 sm:grid-cols-2" disabled={save.isPending}><legend className="sr-only">Members of {team.name}</legend>{names.map((member) => <label key={member.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(member.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, member.id] : selected.filter((id) => id !== member.id))} />{member.name}</label>)}</fieldset>{save.isError && <p role="alert" className="text-sm text-destructive">{workError(save.error)}</p>}{save.isSuccess && <p role="status" className="text-xs text-emerald-700">Membership updated.</p>}<Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>Save members</Button><p className="text-xs text-muted-foreground">Reassign a member’s team tickets before removing them.</p></section>;
}

export default function Teams() {
  const options = useQuery(workOptionsQuery);
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => axios.post(`${WORK_API}/teams`, { name, memberIds: [] }, { withCredentials: true }),
    onSuccess: () => { setName(""); void cache.invalidateQueries({ queryKey: ["work-options"] }); },
  });
  return <div className="p-5 lg:p-8 max-w-5xl space-y-6"><Link to="/work" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={15} />Work queues</Link><header><h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3"><UsersRound />Support teams</h1><p className="text-sm text-muted-foreground mt-2">Organize staff into teams to route and claim incoming requests.</p></header><form className="rounded-xl border bg-card p-5 flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><div className="space-y-2 flex-1 min-w-48"><label htmlFor="team-name" className="text-sm font-medium">New team</label><Input id="team-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product support" /></div><Button type="submit" disabled={create.isPending || !name.trim()}><Plus size={15} />Create team</Button>{create.isError && <p role="alert" className="w-full text-sm text-destructive">{workError(create.error)}</p>}</form>{options.isPending ? <p className="text-sm text-muted-foreground">Loading teams…</p> : options.isError ? <p role="alert" className="text-sm text-destructive">Unable to load teams. Refresh to try again.</p> : !options.data.teams.length ? <p className="p-10 border rounded-xl text-center text-sm text-muted-foreground">Create your first support team above.</p> : <div className="grid gap-5">{options.data.teams.map((team) => <TeamMembers key={`${team.id}:${team.members.map((m) => m.userId).sort().join(",")}`} team={team} staff={options.data.staff} />)}</div>}</div>;
}
