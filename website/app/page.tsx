import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { withBasePath } from '@/lib/basePath';
import { features, screens } from '@/lib/content';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero — centered, one device */}
        <section className="border-b border-line bg-wash">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-20">
            <img
              src={withBasePath('/favicon.png')}
              alt=""
              width={56}
              height={56}
              className="rounded-2xl shadow-sm"
            />
            <h1 className="mt-6 font-display text-[clamp(3.25rem,10vw,5rem)] font-medium leading-none tracking-tight">
              Iris
            </h1>
            <p className="mt-4 font-display text-xl text-ink/75 sm:text-2xl">
              Looks baked into every shot.
            </p>
            <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-muted sm:text-base">
              Pro camera for iOS and Android — lenses, manual controls, assist overlays, and film
              looks applied natively into your captures.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="https://github.com/dmitryshelomanov/iris"
                className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white no-underline transition hover:bg-navy"
              >
                View on GitHub
              </a>
              <a
                href="#screens"
                className="inline-flex h-11 items-center rounded-full border border-line bg-paper px-5 text-sm font-medium text-ink no-underline transition hover:border-ink/20"
              >
                See screens
              </a>
            </div>

            <div className="mt-14 w-[min(17.5rem,78vw)] sm:w-[18.5rem]">
              <DeviceFrame src="/screenshots/camera.jpg" alt="Iris camera" priority />
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">What is Iris?</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              A pro-minded camera for people who care how a frame feels — not a social feed wrapped
              around a shutter. Capture photo or video, switch lenses, dial exposure by hand, and
              bake a look into the file that lands in your library.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-line bg-wash">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">Key features</h2>
            <p className="mt-3 max-w-xl text-muted">
              Everything stays on device. No account, no cloud — just the camera you open to shoot.
            </p>
            <ul className="mt-10 grid gap-0 sm:grid-cols-2">
              {features.map((feature, i) => (
                <li
                  key={feature.title}
                  className="border-t border-line py-6 sm:border-l sm:px-6 sm:odd:border-l-0 sm:odd:pl-0 sm:even:pr-0"
                >
                  <p className="text-xs font-medium tracking-wider text-navy/70">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-lg font-medium tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Spotlight rows */}
        <section className="mx-auto max-w-5xl space-y-20 px-5 py-16 sm:space-y-28 sm:py-24">
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

          {/* Lifestyle bake — not in a phone */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-sm font-medium tracking-wide text-navy">Looks</p>
              <h3 className="mt-2 font-display text-3xl tracking-tight sm:text-[2.1rem]">
                Kodak Gold, baked in.
              </h3>
              <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                Looks are written into the capture on device. What you see is what lands in Photos.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl shadow-[0_24px_50px_-28px_rgba(20,22,28,0.45)]">
              <img
                src={withBasePath('/screenshots/bake.jpg')}
                alt="Capture with Kodak Gold look baked in"
                width={675}
                height={1200}
                className="block h-auto w-full"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        {/* Screens grid */}
        <section id="screens" className="border-t border-line bg-wash py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">In the app</h2>
            <p className="mt-3 max-w-lg text-muted">Real UI from the camera, gallery, review, and settings.</p>
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
              {screens.map((screen) => (
                <figure key={screen.src} className="mx-auto w-full max-w-[14.5rem]">
                  <DeviceFrame src={screen.src} alt={screen.alt} />
                  <figcaption className="mt-3 text-center text-sm text-muted">{screen.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <div className="rounded-3xl border border-line bg-wash px-6 py-10 text-center sm:px-12">
            <h2 className="font-display text-3xl tracking-tight">Open source. On-device.</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Built with Expo, Vision Camera, and a native look-bake module. MIT licensed.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a
                href="https://github.com/dmitryshelomanov/iris"
                className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white no-underline transition hover:bg-navy"
              >
                Star on GitHub
              </a>
              <Link
                href="/privacy/"
                className="inline-flex h-11 items-center rounded-full border border-line bg-paper px-5 text-sm font-medium no-underline transition hover:border-ink/20"
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

/** Thin device bezel — no marketing chrome, no blue frame. */
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
    <div className="rounded-[2rem] bg-[#111] p-[7px] shadow-[0_28px_60px_-32px_rgba(20,22,28,0.55)] ring-1 ring-black/10">
      <div className="overflow-hidden rounded-[1.55rem] bg-black">
        <img
          src={withBasePath(src)}
          alt={alt}
          width={394}
          height={860}
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
      className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
    >
      <div>
        <p className="text-sm font-medium tracking-wide text-navy">{eyebrow}</p>
        <h3 className="mt-2 font-display text-3xl tracking-tight sm:text-[2.1rem]">{title}</h3>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{body}</p>
      </div>
      <div className="mx-auto w-[min(16.5rem,78%)]">
        <DeviceFrame src={src} alt={alt} />
      </div>
    </div>
  );
}
