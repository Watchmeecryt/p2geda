import { useMemo } from 'react';

const COLORS = ['#ffd208', '#ffe46b', '#e6b800', '#111111', '#ffffff'];

/** Purely decorative celebration layer; hidden under prefers-reduced-motion via CSS. */
export function Confetti({ pieces = 46 }: { pieces?: number }) {
  const shards = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        id: index,
        left: `${(index * 97) % 100}%`,
        drift: `${((index * 53) % 60) - 30}px`,
        spin: `${360 + ((index * 71) % 540)}deg`,
        delay: `${((index * 37) % 120) / 100}s`,
        duration: `${2.4 + ((index * 29) % 130) / 100}s`,
        color: COLORS[index % COLORS.length],
        round: index % 3 === 0,
      })),
    [pieces],
  );

  return (
    <div className="confetti" aria-hidden>
      {shards.map((shard) => (
        <span
          key={shard.id}
          style={{
            left: shard.left,
            background: shard.color,
            borderRadius: shard.round ? '999px' : undefined,
            ['--drift' as string]: shard.drift,
            ['--spin' as string]: shard.spin,
            ['--delay' as string]: shard.delay,
            ['--duration' as string]: shard.duration,
          }}
        />
      ))}
    </div>
  );
}
