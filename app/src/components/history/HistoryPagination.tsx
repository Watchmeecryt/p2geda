import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const HISTORY_PAGE_SIZE = 10;

export function useHistoryPagination<T>(items: T[], pageSize = HISTORY_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const slice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    slice,
    pageSize,
    total: items.length,
    showPagination: items.length > pageSize,
  };
}

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

/** Numbered pages (1, 2, 3 …) with prev/next — shown only when more than one page. */
export function HistoryPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4">
      <p className="text-[0.76rem] text-hint">
        Showing {from}–{to} of {totalItems}
      </p>
      <nav className="flex items-center gap-1" aria-label="History pagination">
        <PageButton
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </PageButton>
        {pages.map((entry, index) =>
          entry === '…' ? (
            <span key={`gap-${index}`} className="px-1 text-[0.8rem] text-hint">
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              label={`Page ${entry}`}
              active={entry === page}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </PageButton>
          ),
        )}
        <PageButton
          label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </PageButton>
      </nav>
    </div>
  );
}

function PageButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-w-9 items-center justify-center rounded-full px-2.5 py-1.5 text-[0.82rem] font-semibold transition-colors',
        active
          ? 'btn-ink'
          : disabled
            ? 'cursor-not-allowed text-hint/50'
            : 'text-muted hover:bg-surface hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Always includes 1 and the last page; fills a window around the current page. */
function buildPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: Array<number | '…'> = [];
  for (let index = 0; index < sorted.length; index++) {
    const value = sorted[index]!;
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) result.push('…');
    result.push(value);
  }
  return result;
}
