import type { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
      <div className="max-w-2xl">
        <p className="label-pill">{kicker}</p>
        <h1 className="mt-2.5 text-[clamp(1.75rem,3.2vw,2.35rem)] leading-[1.08] font-medium">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
