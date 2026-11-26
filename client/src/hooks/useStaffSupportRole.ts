import { useQuery } from "@tanstack/react-query";

export class StaffAccessEnded extends Error {}

export function useStaffSupportRole(userId?: string) {
  return useQuery({
    queryKey: ["staff-support-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/staff/support-role`, {
        credentials: "include",
      });
      if (response.status === 401 || response.status === 403) throw new StaffAccessEnded();
      if (!response.ok) throw new Error("Unable to load the staff support role.");
      const { supportRole }: { supportRole?: unknown } = await response.json();
      return supportRole === "TSA" || supportRole === "PROJECT_LEAD" || supportRole === "MEMBER" ? supportRole : null;
    },
    retry: false,
  });
}
