# Iris

Pro camera app for iOS — multi-lens switching, manual controls, photo/video capture, look baking, and assist overlays.

Built with **Expo SDK 57** (Dev Client), **Expo Router**, **NativeWind**, **React Native Reusables**, and **Vision Camera v5**.

> Android packaging is scaffolded; the primary target today is iOS on a physical device.

## Requirements

- Node **22.13+** (see [`.nvmrc`](.nvmrc))
- Xcode + CocoaPods (`pod` on `PATH`)
- Physical iPhone for camera preview and capture (Simulator has no camera hardware)

## Setup

```bash
nvm use
npm install
npm run prebuild:ios   # generates / refreshes the native ios/ project
cd ios && pod install && cd ..
npm run ios            # builds the Dev Client and launches
```

Day to day after the first native build:

```bash
npm start              # expo start --dev-client
# open the Iris Dev Client on device / simulator
```

Useful scripts:

| Script               | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `npm start`          | Metro + Dev Client                            |
| `npm run ios`        | Native Debug build and launch                 |
| `npm run ios:prod`   | Release build on a physical device (no Metro) |
| `npm run lint:types` | Typecheck (`tsc --noEmit`)                    |
| `npm run format`     | Prettier write                                |

## Stack

| Layer   | Choice                                       |
| ------- | -------------------------------------------- |
| App     | Expo SDK 57 + Dev Client (not Expo Go)       |
| Routing | Expo Router (`app/`)                         |
| UI      | NativeWind + Reusables in `src/shared/ui/`   |
| Camera  | `react-native-vision-camera` + Nitro modules |
| Looks   | Local Expo module `modules/iris-look-bake`   |
| Icons   | `lucide-react-native`                        |

## Project structure

Feature-Sliced Design under `src/`, with thin Expo Router screens in `app/`:

```
app/                          Expo Router entry points
  (tabs)/index.tsx            Camera
  gallery.tsx                 Gallery
  settings.tsx                Capture defaults
  permissions.tsx             Permission help

src/
  pages/                      Screen compositions
  widgets/camera-screen/      Main camera widget
  features/camera/            Lenses, manual, looks, overlays
  features/media/             Recents, review UI
  features/onboarding/        Permission / onboarding gate
  entities/capture/           Library save + recents model
  shared/                     Theme, utils, UI primitives

modules/iris-look-bake/       Native look bake (photo / video)
assets/images/                App icon, splash, Android adaptive icons
```

## Features

- Live preview on device (Vision Camera)
- Front / back flip, lens chips (`0.5×` / `1×` / tele) and zoom steps
- Photo and video capture → **Iris** album in Photos
- Manual Pro controls (ISO, shutter, WB, focus, EV)
- Look presets with strength + native bake into captures
- Assist overlays: grid, level, focus reticle, histogram, zebra, peaking, aspect crop
- Capture presets, scene chips, countdown, volume shutter
- Gallery + last-shot review

## Simulator vs device

|                 | Simulator | Physical iPhone        |
| --------------- | --------- | ---------------------- |
| UI / navigation | Yes       | Yes                    |
| Camera preview  | No        | Yes                    |
| Lens switching  | N/A       | Yes (device-dependent) |
| Capture / bake  | No        | Yes                    |

## Icons and splash

Source assets live in [`assets/images/`](assets/images/) and are wired in [`app.json`](app.json). Native iOS copies live under `ios/Iris/Images.xcassets/`.

After changing icons or splash, rebuild the native app (`npm run ios`). If the home-screen icon does not update, delete the app from the device and reinstall.

## License

[MIT](LICENSE) © Dmitry Shelomanov

Repository: [github.com/dmitryshelomanov/iris](https://github.com/dmitryshelomanov/iris)
