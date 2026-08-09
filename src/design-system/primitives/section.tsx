import { cn } from '@/lib/cn';

import { Reveal } from './reveal';

type SectionProps = React.HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'article';
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap = {
  sm: 'py-12 md:py-16',
  md: 'py-20 md:py-28',
  lg: 'py-28 md:py-40',
};

export function Section({ as: Tag = 'section', size = 'md', className, ...props }: SectionProps) {
  return <Tag className={cn(sizeMap[size], className)} {...props} />;
}

/**
 * `as` exists because this component hardcoded `<h2>`, and roughly a dozen
 * pages (About, Contact, FAQ, Shipping, the /categories hub, the blog index,
 * every policy page) use it as their MAIN heading — so those pages shipped with
 * no `<h1>` at all. A document whose most important heading is an h2 gives
 * Google no primary topic to attach the page to.
 *
 * Default stays `h2`: within the homepage and other multi-section pages this is
 * a section heading and h2 is correct. Pass `as="h1"` only where the heading is
 * the page's subject.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <Reveal
      inView
      className={cn(
        'flex max-w-3xl flex-col gap-3',
        align === 'center' && 'mx-auto items-center text-center',
        className,
      )}
    >
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <Heading className="editorial-heading text-display-md md:text-display-lg">{title}</Heading>
      {description ? (
        <p className="text-pretty text-base leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </Reveal>
  );
}
