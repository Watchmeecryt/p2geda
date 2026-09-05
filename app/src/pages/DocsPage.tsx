import { Link, Navigate, useParams } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { DOC_ARTICLES } from '@/components/docs/articles';
import {
  DEFAULT_DOC,
  DOC_GROUPS,
  allDocPages,
  docPath,
  findDoc,
  type DocPageId,
} from '@/lib/docs/catalog';
import { cn } from '@/lib/utils';

export function DocsPage() {
  const { slug } = useParams();
  if (!slug) return <Navigate to={docPath(DEFAULT_DOC)} replace />;

  const page = findDoc(slug);
  if (!page) return <Navigate to={docPath(DEFAULT_DOC)} replace />;

  const pages = allDocPages();
  const index = pages.findIndex((item) => item.id === page.id);
  const prev = index > 0 ? pages[index - 1] : undefined;
  const next = index < pages.length - 1 ? pages[index + 1] : undefined;

  return (
    <div className="docs-shell">
      <aside className="docs-toc" aria-label="Documentation">
        {DOC_GROUPS.map((group) => (
          <div key={group.id} className="docs-toc__group">
            <p className="docs-toc__label">{group.label}</p>
            <ul>
              {group.pages.map((item) => {
                const active = item.id === page.id;
                return (
                  <li key={item.id}>
                    <Link
                      to={docPath(item.id)}
                      className={cn('docs-toc__link', active && 'docs-toc__link--active')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <HugeiconsIcon icon={item.icon} size={15} aria-hidden />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      <article className="docs-article">
        <header className="docs-article__head">
          <p className="label-pill">Docs</p>
          <h1>{page.title}</h1>
          <p className="docs-article__blurb">{page.blurb}</p>
        </header>
        <div className="docs-article__body">{DOC_ARTICLES[page.id as DocPageId]}</div>
        <nav className="docs-pager" aria-label="Docs pagination">
          {prev ? (
            <Link to={docPath(prev.id)} className="docs-pager__link">
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} aria-hidden />
              <span>
                <span className="docs-pager__kicker">Previous</span>
                <span className="docs-pager__title">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={docPath(next.id)} className="docs-pager__link docs-pager__link--next">
              <span>
                <span className="docs-pager__kicker">Next</span>
                <span className="docs-pager__title">{next.title}</span>
              </span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden />
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}
