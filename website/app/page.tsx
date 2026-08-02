import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { withBasePath } from '@/lib/basePath';
import { bakeLooks, features, mlLooks, screens } from '@/lib/content';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero — centered, one device */}
        <section className="hero-atmosphere border-b border-line">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pb-20 pt-16 text-center sm:pb-24 sm:pt-20">
            <img
              src={withBasePath('/favicon.png')}
              alt=""
              width={64}
              height={64}
              className="rounded-2xl shadow-[0_12px_40px_-12px_rgba(251,191,36,0.45)] ring-1 ring-amber/30"
            />
            <h1 className="mt-8 font-display text-[clamp(4.25rem,14vw,7rem)] font-medium leading-[0.9] tracking-tight">
              Iris
            </h1>
            <p className="mt-6 font-display text-2xl italic leading-snug text-amber sm:text-3xl md:text-4xl">
              Looks baked into every shot.
            </p>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted sm:text-xl">
              Pro camera for iOS and Android — lenses, manual controls, assist overlays, and film
              looks applied natively into your captures.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a
                href="https://github.com/dmitryshelomanov/iris"
                className="inline-flex h-12 items-center rounded-full bg-amber px-6 text-base font-semibold text-paper no-underline transition hover:bg-amber-dim"
              >
                View on GitHub
              </a>
              <a
                href="#screens"
                className="inline-flex h-12 items-center rounded-full border border-line bg-paper/60 px-6 text-base font-medium text-ink no-underline transition hover:border-amber/40 hover:text-amber"
              >
                See screens
              </a>
            </div>

            <div className="mt-16 w-[min(18.5rem,80vw)] sm:w-[20rem]">
              <DeviceFrame src="/screenshots/camera.jpg" alt="Iris camera" priority />
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl md:text-6xl">
              What is Iris?
            </h2>
            <p className="mt-6 text-xl leading-relaxed text-muted sm:text-2xl">
              A pro-minded camera for people who care how a frame feels — not a social feed wrapped
              around a shutter. Capture photo or video, switch lenses, dial exposure by hand, and
              bake a look into the file that lands in your library.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="surface-atmosphere border-y border-line">
          <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Key features</h2>
            <p className="mt-4 max-w-xl text-lg text-muted sm:text-xl">
              Everything stays on device. No account, no cloud — just the camera you open to shoot.
            </p>
            <ul className="mt-12 grid gap-0 sm:grid-cols-2">
              {features.map((feature, i) => (
                <li
                  key={feature.title}
                  className="border-t border-line py-8 sm:border-l sm:px-7 sm:odd:border-l-0 sm:odd:pl-0 sm:even:pr-0"
                >
                  <p className="text-sm font-semibold tracking-wider text-amber">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-3 font-display text-2xl tracking-tight sm:text-[1.65rem]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Spotlight rows */}
        <section className="mx-auto max-w-5xl space-y-24 px-5 py-20 sm:space-y-32 sm:py-28">
          <Spotlight
            eyebrow="Capture"
            title="Pro controls. Film looks."
            body="Mode, aspect, timer, and look chips sit where your thumbs already are. Presets like Kodak Gold bake into the saved file — not a filter you lose on export."
            src="/screenshots/camera.jpg"
            alt="Iris camera interface"
          />
          <Spotlight
            reverse
            eyebrow="Library"
            title="Browse by look and type."
            body="The Iris gallery keeps recent captures close — filter photos, videos, favorites, and the look you shot with."
            src="/screenshots/gallery.jpg"
            alt="Iris gallery"
          />
          <Spotlight
            eyebrow="Review"
            title="Before / after and EXIF."
            body="Open a shot to compare looks, read ISO and shutter, favorite keepers, and share — without leaving Iris."
            src="/screenshots/review.jpg"
            alt="Iris photo review"
          />
          <Spotlight
            reverse
            eyebrow="Defaults"
            title="Defaults that stick."
            body="Aspect, quality, HDR, stabilization, look strength — set once, shoot for weeks."
            src="/screenshots/settings.jpg"
            alt="Iris settings"
          />
        </section>

        {/* Look bake strip */}
        <section id="looks" className="border-t border-line py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Looks, baked in</h2>
            <p className="mt-4 max-w-lg text-lg text-muted sm:text-xl">
              Same scene — different looks written into the file.
            </p>
          </div>
          <div className="mt-12 overflow-x-auto scroll-smooth scrollbar-none">
            <div className="flex w-max snap-x snap-mandatory gap-4 px-5 pb-2 sm:gap-5 lg:px-[max(1.25rem,calc((100vw-64rem)/2+1.25rem))]">
              {bakeLooks.map((look) => (
                <figure
                  key={look.src}
                  className="w-[min(15rem,72vw)] shrink-0 snap-start overflow-hidden rounded-2xl shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
                >
                  <img
                    src={withBasePath(look.src)}
                    alt={look.alt}
                    width={768}
                    height={1024}
                    className="block h-auto w-full"
                    loading="lazy"
                  />
                </figure>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl px-5 sm:mt-20">
            <h3 className="font-display text-3xl tracking-tight sm:text-4xl">Anime ML</h3>
            <p className="mt-4 max-w-lg text-lg text-muted sm:text-xl">
              On-device stylization baked into the photo — photo only, not for video.
            </p>
          </div>
          <div className="mt-10 overflow-x-auto scroll-smooth scrollbar-none">
            <div className="flex w-max snap-x snap-mandatory gap-4 px-5 pb-2 sm:gap-5 lg:px-[max(1.25rem,calc((100vw-64rem)/2+1.25rem))]">
              {mlLooks.map((look) => (
                <figure key={look.src} className="w-[min(15rem,72vw)] shrink-0 snap-start">
                  <div className="overflow-hidden rounded-2xl shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)] ring-1 ring-amber/25">
                    <img
                      src={withBasePath(look.src)}
                      alt={look.alt}
                      width={768}
                      height={1024}
                      className="block h-auto w-full"
                      loading="lazy"
                    />
                  </div>
                  <figcaption className="mt-3 text-sm font-semibold tracking-wide text-amber">
                    {look.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Screens grid */}
        <section id="screens" className="surface-atmosphere border-t border-line py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">In the app</h2>
            <p className="mt-4 max-w-lg text-lg text-muted sm:text-xl">
              Real UI from the camera, gallery, review, and settings.
            </p>
            <div className="mt-12 grid grid-cols-2 gap-5 sm:gap-7 lg:grid-cols-4">
              {screens.map((screen) => (
                <figure key={screen.src} className="mx-auto w-full max-w-[14.5rem]">
                  <DeviceFrame src={screen.src} alt={screen.alt} />
                  <figcaption className="mt-4 text-center text-base text-muted">
                    {screen.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <div className="rounded-3xl border border-line bg-wash px-6 py-12 text-center sm:px-14 sm:py-16">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              Open source. On-device.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-muted sm:text-xl">
              Built with Expo, Vision Camera, and a native look-bake module. MIT licensed.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href="https://github.com/dmitryshelomanov/iris"
                className="inline-flex h-12 items-center rounded-full bg-amber px-6 text-base font-semibold text-paper no-underline transition hover:bg-amber-dim"
              >
                Star on GitHub
              </a>
              <Link
                href="/privacy/"
                className="inline-flex h-12 items-center rounded-full border border-line bg-paper/60 px-6 text-base font-medium no-underline transition hover:border-amber/40 hover:text-amber"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/** Thin device bezel — no marketing chrome. */
function DeviceFrame({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="rounded-[2rem] bg-[#111] p-[7px] shadow-[0_28px_60px_-28px_rgba(0,0,0,0.75)] ring-1 ring-white/12">
      <div className="overflow-hidden rounded-[1.55rem] bg-black">
        <img
          src={withBasePath(src)}
          alt={alt}
          width={470}
          height={1024}
          className="block h-auto w-full"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
        />
      </div>
    </div>
  );
}

function Spotlight({
  eyebrow,
  title,
  body,
  src,
  alt,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  src: string;
  alt: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
    >
      <div>
        <p className="text-base font-semibold tracking-wide text-amber">{eyebrow}</p>
        <h3 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl md:text-[2.75rem]">
          {title}
        </h3>
        <p className="mt-5 text-lg leading-relaxed text-muted sm:text-xl">{body}</p>
      </div>
      <div className="mx-auto w-[min(17rem,80%)]">
        <DeviceFrame src={src} alt={alt} />
      </div>
    </div>
  );
}
