import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-wash">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl tracking-tight">Iris</p>
          <p className="mt-2 text-base text-muted">Pro camera. Looks baked into every shot.</p>
        </div>
        <div className="flex flex-wrap gap-5 text-base text-muted">
          <a
            href="https://github.com/dmitryshelomanov/iris"
            className="no-underline transition hover:text-amber"
          >
            GitHub
          </a>
          <Link href="/privacy/" className="no-underline transition hover:text-amber">
            Privacy Policy
          </Link>
          <a
            href="mailto:dmitryshelomanov@mail.ru"
            className="no-underline transition hover:text-amber"
          >
            Contact
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-5xl px-5 py-5 text-sm text-muted">
          © {new Date().getFullYear()} Dmitry Shelomanov · MIT
        </p>
      </div>
    </footer>
  );
}
