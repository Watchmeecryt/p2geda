import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <div className="grid size-12 place-items-center rounded-full border-2 border-dashed border-[rgba(255,108,47,0.55)] bg-[color-mix(in_srgb,var(--brand-yellow-500)_12%,#fff)] text-accent-deep">
          {icon}
        </div>
      ) : null}
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-body">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
