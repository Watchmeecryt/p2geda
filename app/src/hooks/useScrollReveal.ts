import { useEffect } from 'react';

/**
 * Reveals every `.landing-reveal` block as it scrolls into view. Children marked
 * `.landing-reveal-child` stagger off their parent's `--reveal-index`, which is
 * what keeps long marketing pages feeling composed rather than popping in whole.
 */
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('.landing-reveal'));
    if (blocks.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      blocks.forEach((block) => block.classList.add('landing-reveal--visible'));
      return;
    }

    blocks.forEach((block) => {
      const children = Array.from(
        block.querySelectorAll<HTMLElement>(':scope > * > .landing-reveal-child, :scope > .landing-reveal-child'),
      );
      children.forEach((child, index) => child.style.setProperty('--reveal-index', String(index)));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('landing-reveal--visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.16 },
    );

    blocks.forEach((block) => observer.observe(block));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Fires once when the element first enters the viewport, for load-in decor. */
export function useInView<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        node.classList.add('is-in');
        observer.disconnect();
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
}
