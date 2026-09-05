import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, CheckmarkCircle02Icon, Note01Icon } from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { cn } from '@/lib/utils';

export function DocLead({ children }: { children: ReactNode }) {
  return <p className="docs-lead">{children}</p>;
}

export function DocH2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="docs-h2">
      {children}
    </h2>
  );
}

export function DocH3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="docs-h3">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p className="docs-p">{children}</p>;
}

export function DocUl({ children }: { children: ReactNode }) {
  return <ul className="docs-ul">{children}</ul>;
}

export function DocOl({ children }: { children: ReactNode }) {
  return <ol className="docs-ol">{children}</ol>;
}

export function DocA({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  if (to) {
    return (
      <Link to={to} className="docs-a">
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className="docs-a" target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {children}
    </a>
  );
}

export function DocPre({ children }: { children: ReactNode }) {
  return (
    <pre className="docs-pre">
      <code>{children}</code>
    </pre>
  );
}

/** JSDoc-style contract / function card. */
export function DocSig({
  name,
  signature,
  tags,
}: {
  name: string;
  signature: string;
  tags: { kind: string; text: string }[];
}) {
  return (
    <figure className="docs-sig">
      <figcaption className="docs-sig__name">{name}</figcaption>
      <pre className="docs-sig__code">
        <code>{signature}</code>
      </pre>
      <dl className="docs-sig__tags">
        {tags.map((tag) => (
          <div key={`${tag.kind}-${tag.text}`} className="docs-sig__row">
            <dt>@{tag.kind}</dt>
            <dd>{tag.text}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocCallout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'honest' | 'ok';
  title: string;
  children: ReactNode;
}) {
  const icon: IconSvgElement =
    tone === 'honest' ? Alert02Icon : tone === 'ok' ? CheckmarkCircle02Icon : Note01Icon;
  return (
    <aside className={cn('docs-callout', `docs-callout--${tone}`)}>
      <div className="docs-callout__title">
        <HugeiconsIcon icon={icon} size={16} aria-hidden />
        <span>{title}</span>
      </div>
      <div className="docs-callout__body">{children}</div>
    </aside>
  );
}
