import type { CSSProperties, ElementType } from 'react';

/** A headline whose lines rise up from behind a mask, one after another (Brilliant's page-title reveal).
 *  The lines play once the page is shown (.page[data-shown]) or the heading scrolls into view (.is-in). */
export function Rise({
  lines,
  as: Tag = 'h1',
  className = '',
}: {
  lines: string[];
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag className={`rise ${className}`}>
      {lines.map((line, i) => (
        <span className="mask" key={i}>
          <span style={{ '--i': i } as CSSProperties}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
