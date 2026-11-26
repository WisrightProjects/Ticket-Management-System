import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZES = [10, 20, 25, 50] as const;

export function ListPagination({ page, totalPages, onPageChange, pageSize, onPageSizeChange, sizes = PAGE_SIZES, disabled }: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  sizes?: readonly number[];
  disabled?: boolean;
}) {
  const last = Math.max(1, totalPages);
  const pageSizes = sizes.includes(pageSize) ? sizes : [...sizes, pageSize].sort((a, b) => a - b);
  const numbers = last <= 5
    ? Array.from({ length: last }, (_, index) => index + 1)
    : [...new Set([1, page - 1, page, page + 1, last])].filter((number) => number >= 1 && number <= last);

  return <div className="flex flex-wrap items-center gap-3">
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Rows per page
      <select className="h-8 rounded-md border border-input bg-background px-2 text-foreground" value={pageSize}
        disabled={disabled} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
        {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" title="Previous page"
        disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden="true" />
      </Button>
      {numbers.map((number, index) => (
        <span key={number} className="flex items-center gap-1">
          {index > 0 && number - numbers[index - 1]! > 1 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}
          <Button type="button" variant={number === page ? "default" : "outline"} size="sm"
            className="min-w-8 tabular-nums" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined}
            disabled={disabled} onClick={() => onPageChange(number)}>{number}</Button>
        </span>
      ))}
      <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" title="Next page"
        disabled={disabled || page >= last} onClick={() => onPageChange(page + 1)}>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  </div>;
}
