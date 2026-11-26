import { ListPagination } from "@/components/ListPagination";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "@tms/core";
import axios from "axios";
import { Search, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_URL = import.meta.env.VITE_API_URL || "";
const employeeDirectorySchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  department: z.string().nullish(),
  designation: z.string().nullish(),
}));

export default function Users() {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const directory = useQuery({
    queryKey: ["users", "active-employees"],
    retry: false,
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/users`, {
        withCredentials: true,
        params: { scope: "active-employees" },
      });
      return { users: employeeDirectorySchema.parse(res.data), isSnapshot: res.headers?.["x-employee-directory-source"] === "local-snapshot" };
    },
  });

  const query = search.trim().toLowerCase();
  const people = directory.data?.users ?? [];
  const departments = [...new Set(people.flatMap(({ department }) => department ? [department] : []))]
    .sort((a, b) => a.localeCompare(b));
  const employees = people.filter(({ name, email, department, designation }) =>
    (!departmentFilter || department === departmentFilter)
    && [name, email, department, designation].some((value) => value?.toLowerCase().includes(query)));
  const totalPages = Math.max(1, Math.ceil(employees.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstRow = (currentPage - 1) * pageSize;
  const visible = employees.slice(firstRow, firstRow + pageSize);


  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <PageHeader title="Employee directory" subtitle="Active WiseWork employees"
        actions={directory.isSuccess && <span className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium tabular-nums text-muted-foreground">
          {people.length} active {people.length === 1 ? "employee" : "employees"}
        </span>} />
      {directory.isError && <ErrorBanner message="The WiseWork employee directory is unavailable." />}
      <section aria-label="WiseWork employee directory" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {!directory.isError && (
        <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3.5 sm:px-5">
          <div className="relative w-full sm:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search employees" placeholder="Search employees…" value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              className="h-9 bg-card pl-9" />
          </div>
          {departments.length > 0 && <select aria-label="Filter by department" value={departmentFilter}
            onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1); }}
            className="h-9 max-w-full rounded-lg border border-input bg-card px-3 text-sm">
            <option value="">All departments</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>}
          {directory.data?.isSnapshot && <p className="text-xs text-muted-foreground xl:ml-auto">Showing a snapshot of active WisRight employees from WiseWork.</p>}
        </div>
      )}

      {directory.isPending && (
        <div aria-label="Loading employees" className="space-y-3 p-4">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-10 rounded-md" />)}
        </div>
      )}
      {directory.isSuccess && !visible.length && (
        <EmptyState icon={UserX} title={query || departmentFilter ? "No employees match these filters." : "No active WiseWork employees found."} />
      )}
      {visible.length > 0 && (
        <>
          <Table aria-label="Active WiseWork employees" className="table-fixed">
            <TableHeader className="bg-muted/65">
              <TableRow>
                <TableHead scope="col" className="w-3/5 px-4 text-xs font-semibold text-muted-foreground sm:w-[28%] sm:px-5">Employee</TableHead>
                <TableHead scope="col" className="hidden w-[32%] px-4 text-xs font-semibold text-muted-foreground sm:table-cell">Work email</TableHead>
                <TableHead scope="col" className="w-2/5 px-4 text-xs font-semibold text-muted-foreground sm:w-[22%]">Department</TableHead>
                <TableHead scope="col" className="hidden w-[18%] px-4 text-xs font-semibold text-muted-foreground sm:table-cell">Designation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {visible.map((employee) => (
              <TableRow key={employee.id} data-testid="user-card">
                <TableCell className="whitespace-normal px-4 py-2.5 font-medium sm:px-5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {employee.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="break-words">{employee.name}</div>
                      <div className="break-all text-xs font-normal text-muted-foreground sm:hidden">{employee.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-normal break-all px-4 text-muted-foreground sm:table-cell">{employee.email}</TableCell>
                <TableCell className="whitespace-normal break-words px-4 text-xs sm:text-sm">
                  {employee.department || "—"}
                  {employee.designation && <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">{employee.designation}</div>}
                </TableCell>
                <TableCell className="hidden whitespace-normal break-words px-4 text-muted-foreground sm:table-cell">{employee.designation || "—"}</TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {firstRow + 1}–{firstRow + visible.length} of {employees.length} employees
            </span>
            <ListPagination page={currentPage} totalPages={totalPages} onPageChange={setPage}
              pageSize={pageSize} sizes={[10, 25, 50, 100]} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
          </div>
        </>
      )}
      </section>
    </div>
  );
}
