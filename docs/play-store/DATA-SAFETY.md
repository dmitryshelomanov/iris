# Google Play Data safety — Iris

Answers aligned with [`docs/privacy.md`](../privacy.md). Iris has **no backend**, **no analytics**, and does **not** transmit personal data off-device.

## Data collection overview

| Question                                                            | Answer                           |
| ------------------------------------------------------------------- | -------------------------------- |
| Does your app collect or share any of the required user data types? | **No**                           |
| Is all user data encrypted in transit?                              | N/A (nothing transmitted)        |
| Do you provide a way for users to request data deletion?            | N/A (no account / no cloud data) |

## Permissions justification (App content → Sensitive permissions)

### Camera

Used to capture photos and video at the user’s request. Captures stay on device / media library.

### Microphone / RECORD_AUDIO

Used only when recording video with sound, at the user’s request.

### Photos / media (READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, legacy storage)

- Save captures to the device library when the user allows it.
- Keep the in-app gallery in sync (e.g. when the user deletes a shot).
- Iris does not upload media.

### Motion / sensors

On-device level / horizon overlay only. Not stored or sent anywhere.

## Content rating

Complete the IARC questionnaire in Play Console. Expected outcome for a utility camera app with no user-generated social content, no violence, no gambling: **Everyone** / low maturity. Answer honestly if any look previews show people (stock/demo).

## Ads / target audience

- Contains ads: **No**
- In-app purchases: **No** (unless you add them later)
- Target age: general / 13+ as appropriate for a camera utility
- Designed for children: **No**

## Checklist before sending for review

- [ ] Privacy policy URL set
- [ ] Data safety form submitted (no data collected)
- [ ] Content rating questionnaire completed
- [ ] Camera / mic / photos declarations filled with the text above
- [ ] Feature graphic + icon + ≥2 phone screenshots uploaded
- [ ] Short + full description pasted from `LISTING.md`
