import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for the Iris camera app.',
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <p className="mb-8">
          <Link href="/" className="text-sm text-muted no-underline transition hover:text-ink">
            ← Iris
          </Link>
        </p>

        <h1 className="font-display text-4xl tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-muted">Last updated: 2026-07-29</p>

        <div className="prose-iris mt-10 space-y-5 text-[1.05rem] leading-relaxed text-ink/90">
          <p>
            Iris (“the App”) is a camera application for capturing photos and video on your device.
            This policy describes how Iris handles information.
          </p>

          <h2 className="!mt-10 font-display text-2xl tracking-tight">Who we are</h2>
          <p>Iris is developed by Dmitry Shelomanov.</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>
              Email:{' '}
              <a
                className="text-navy underline-offset-2 hover:underline"
                href="mailto:dmitryshelomanov@mail.ru"
              >
                dmitryshelomanov@mail.ru
              </a>
            </li>
            <li>
              Website:{' '}
              <a
                className="text-navy underline-offset-2 hover:underline"
                href="https://dmitryshelomanov.github.io/"
              >
                dmitryshelomanov.github.io
              </a>
            </li>
            <li>
              App site:{' '}
              <a
                className="text-navy underline-offset-2 hover:underline"
                href="https://dmitryshelomanov.github.io/iris/"
              >
                dmitryshelomanov.github.io/iris
              </a>
            </li>
            <li>
              Repository:{' '}
              <a
                className="text-navy underline-offset-2 hover:underline"
                href="https://github.com/dmitryshelomanov/iris"
              >
                github.com/dmitryshelomanov/iris
              </a>
            </li>
          </ul>

          <h2 className="!mt-10 font-display text-2xl tracking-tight">Data we process</h2>
          <p>
            Iris does <strong>not</strong> collect, sell, or transmit personal data to our servers.
            There is no Iris backend and no third-party analytics in the App.
          </p>

          <h3 className="!mt-8 text-lg font-semibold tracking-tight">Camera and microphone</h3>
          <p>
            The App uses the camera and microphone only to capture photos and record video with
            sound, at your request. Capture files stay on your device (and, if you allow it, in your
            device photo library).
          </p>

          <h3 className="!mt-8 text-lg font-semibold tracking-tight">Photos and media library</h3>
          <p>
            With your permission, Iris may save captures to your photo library and read library
            items so the in-app gallery stays in sync (for example when you delete a shot). Iris
            does not upload your media.
          </p>

          <h3 className="!mt-8 text-lg font-semibold tracking-tight">Motion / sensors</h3>
          <p>
            Iris may use device motion sensors to show a level / horizon assist overlay. Sensor data
            is processed on device and is not stored or sent anywhere.
          </p>

          <h3 className="!mt-8 text-lg font-semibold tracking-tight">Local settings</h3>
          <p>
            Preferences (look presets, capture defaults, overlays, and similar) are stored locally
            on your device. They are not synced to Iris servers.
          </p>

          <h2 className="!mt-10 font-display text-2xl tracking-tight">Permissions</h2>
          <p>Depending on the platform, Iris may request:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Camera</li>
            <li>Microphone</li>
            <li>Photo library / media access</li>
            <li>Motion / activity (level overlay)</li>
          </ul>
          <p>
            You can revoke permissions in system settings. Some features will stop working without
            them.
          </p>

          <h2 className="!mt-10 font-display text-2xl tracking-tight">Children’s privacy</h2>
          <p>
            Iris is not directed at children under 13. We do not knowingly collect personal
            information from children.
          </p>

          <h2 className="!mt-10 font-display text-2xl tracking-tight">Changes</h2>
          <p>
            We may update this policy. The “Last updated” date at the top will change when we do.
            Continued use of the App after changes means you accept the updated policy.
          </p>

          <h2 className="!mt-10 font-display text-2xl tracking-tight">Contact</h2>
          <p>
            Questions about privacy:{' '}
            <a
              className="text-navy underline-offset-2 hover:underline"
              href="mailto:dmitryshelomanov@mail.ru"
            >
              dmitryshelomanov@mail.ru
            </a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
