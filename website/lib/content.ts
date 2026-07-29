export const features = [
  {
    title: 'Multi-lens & zoom',
    body: 'Switch 0.5× / 1× / tele and glide through zoom on hardware that supports it.',
  },
  {
    title: 'Pro manual controls',
    body: 'ISO, shutter, white balance, focus, and exposure — when you want full control.',
  },
  {
    title: 'Looks baked in',
    body: 'Film-inspired presets are applied natively into saved photos and video, not just overlays.',
  },
  {
    title: 'Assist overlays',
    body: 'Grid, level, histogram, zebra, peaking, and aspect crop while you frame the shot.',
  },
  {
    title: 'Capture presets',
    body: 'Scene chips, countdown, volume shutter, and defaults that stick across launches.',
  },
  {
    title: 'Iris gallery',
    body: 'Browse recent shots by type and look, review the last capture, keep an Iris album in Photos.',
  },
] as const;

export const screens = [
  {
    src: '/screenshots/camera.jpg',
    alt: 'Iris camera with film looks and controls',
    caption: 'Camera',
  },
  {
    src: '/screenshots/gallery.jpg',
    alt: 'Iris gallery',
    caption: 'Gallery',
  },
  {
    src: '/screenshots/review.jpg',
    alt: 'Iris photo review with EXIF',
    caption: 'Review',
  },
  {
    src: '/screenshots/settings.jpg',
    alt: 'Iris settings',
    caption: 'Settings',
  },
] as const;
