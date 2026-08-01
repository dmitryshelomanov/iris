import Link from 'next/link';
import { withBasePath } from '@/lib/basePath';

const nav = [
  { href: '/#features', label: 'Features' },
  { href: '/#looks', label: 'Looks' },
  { href: '/#screens', label: 'Screens' },
  { href: '/privacy/', label: 'Privacy' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <img
            src={withBasePath('/favicon.png')}
            alt=""
            width={32}
            height={32}
            className="rounded-lg ring-1 ring-amber/25"
          />
          <span className="font-display text-xl tracking-tight">Iris</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted no-underline transition hover:text-amber sm:text-base"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="https://github.com/dmitryshelomanov/iris"
            className="ml-1.5 hidden rounded-full bg-amber px-4 py-1.5 text-sm font-semibold text-paper no-underline transition hover:bg-amber-dim sm:inline-flex"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
