# Play Console setup — Iris (Android)

Package name: `com.iris.camera`  
EAS project: https://expo.dev/accounts/dshelomanovs-team/projects/iris  
Production submit track in `eas.json`: `internal` (change to `production` for public rollout)

## Ready artifacts (local EAS builds, upload-keystore signed)

| Artifact                       | Path                                      |
| ------------------------------ | ----------------------------------------- |
| Preview APK (sideload / smoke) | `dist/android/iris-preview-1.0.0-vc2.apk` |
| Production AAB (Play upload)   | `dist/android/iris-production-1.0.0.aab`  |

Both were signed with EAS remote credentials (`Build Credentials xCc4rDWiIV`). Cloud builds were also queued:

- Preview: https://expo.dev/accounts/dshelomanovs-team/projects/iris/builds/cf9b1fa1-a0aa-4eeb-8b13-459921a853b0
- Production: https://expo.dev/accounts/dshelomanovs-team/projects/iris/builds/841ae880-0af4-4477-a399-c455591f90e4

## 1. Create the app (manual, once)

1. Open [Google Play Console](https://play.google.com/console) with a verified developer account.
2. **Create app** → name **Iris**, language English, app type **App**, free.
3. Accept declarations as applicable.
4. Under **Test and release → Testing → Internal testing**, create a release.
5. Upload `dist/android/iris-production-1.0.0.aab` (or the cloud AAB when finished).
6. Add yourself (and testers) to the internal testing email list → **Save and publish** the release.

First upload for a **new** app must be manual. After that, automate with EAS Submit.

## 2. Service account for `eas submit` (subsequent uploads)

1. In Google Cloud Console, create (or reuse) a project linked to Play Console.
2. Create a service account with access to the Play Android Developer API.
3. In Play Console → **Users and permissions**, invite the service account email with release permissions.
4. Download the JSON key (keep it **out of git**).
5. Configure EAS:

```bash
npx eas-cli submit --platform android --profile production --latest
# When prompted, upload the Google Service Account key
```

Or set `submit.production.android.serviceAccountKeyPath` in `eas.json` to a local path that is gitignored.

Then:

```bash
npm run submit:android
```

## 3. Store listing & compliance

Follow [`LISTING.md`](./LISTING.md) and [`DATA-SAFETY.md`](./DATA-SAFETY.md).

Assets:

- `docs/play-store/feature-graphic.png` (1024×500)
- `docs/play-store/icon-512.png` (512×512)
- `docs/store-screenshots/android/framed-*.png` (1080×1920)

## 4. Promote to production

When Internal testing looks good:

1. In Play Console, promote the release to **Production** (or create a production release from the same AAB).
2. In [`eas.json`](../../eas.json), change:

```json
"track": "internal"
```

to:

```json
"track": "production"
```

## 5. Keystore backup (do once)

EAS created the upload keystore on the first Android build. Download a backup:

```bash
npx eas-cli credentials -p android
```

Choose the Iris project → Android → Keystore → Download. Store the `.jks` + passwords in a password manager — **losing them blocks Play updates**.

## 6. Install preview APK on a device

```bash
adb install -r dist/android/iris-preview-1.0.0-vc2.apk
```

Smoke: open camera, switch looks, capture photo/video, check gallery save, permissions prompts.
