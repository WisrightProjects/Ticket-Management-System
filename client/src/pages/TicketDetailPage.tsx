import { useParams, Link } from "react-router-dom";
import { TicketDetail } from "@/components/TicketDetail";
import { TicketReplies } from "@/components/TicketReplies";
import { TicketMetaSidebar } from "@/components/TicketMetaSidebar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id ?? "";

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <Link
        to="/tickets"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 -ml-2")}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Tickets
      </Link>

      <div className="flex gap-6 items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          <TicketDetail ticketId={ticketId} />
          <TicketReplies ticketId={ticketId} />
        </div>

        {/* Sticky metadata sidebar */}
        <div className="w-72 xl:w-80 shrink-0 sticky top-[72px]">
          <TicketMetaSidebar ticketId={ticketId} />
        </div>
      </div>
    </div>
  );
}

export default TicketDetailPage;
