---
name: Sponsors
description: A warm, minimal sponsor wall with pastel portraits.
colors:
  ivory: "#fffaf7"
  ink: "#392e33"
  muted: "#77666d"
  line: "#e9dfdf"
  heart: "#ef7a96"
  focus: "#a84664"
  mint: "#bfe9ca"
  butter: "#f9e8aa"
  blush: "#f6cbce"
  seafoam: "#bce9dd"
  lilac: "#e7c9ef"
typography:
  body:
    fontFamily: "Manrope, sans-serif"
  display:
    fontSize: "clamp(36px, 4vw, 49px)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.04em"
rounded:
  contribution: "6px"
  sponsor: "10px"
  portrait: "50%"
---

# Design System: Sponsors

## Overview

Preserve the ivory canvas and pink heart identity. Keep the page minimal and sleek, with totals and contributions beside an open grid of pastel circular portraits. The returning-sponsor form and admin review workspace have been checked in a browser at desktop and mobile sizes.

## Colors

The heart supplies the pink accent; rose marks focus and selected portraits. Ink and muted text sit on ivory with pale dividers. Five pastel portrait backgrounds cycle through CSV order and do not encode contribution size.

## Typography

Use bundled Manrope, with weights 400–700. The total is the strongest type; amounts use tabular numerals. The page title is 25px and wall headline 24px. Supporting text ranges from 10–14px. Long names and notes wrap. Transaction IDs are visible only in the authenticated admin view.

## Layout

The centered page has a 1280px maximum width and 56px desktop side padding. A 270px summary column and 70px gutter sit beside five sponsor columns. Selected details and the scrollable contribution list appear under the total.

At 1050px, side padding becomes 32px, the summary column 230px, the gutter 38px, and the wall four columns. At 760px, use 24px side padding and one vertical flow: summary, wall, details, contributions. The wall uses three columns, portraits up to 74px (80px on desktop), and a 44px total. The contribution list has a 198px maximum height.

## Elevation & Depth

Keep surfaces flat with thin dividers. Hovered portraits gain a faint shadow, 5px lift, and slight rotation. Selection uses a rose outline.

## Shapes

Circular portraits are the signature. Contribution rows and sponsor buttons have softly rounded interaction areas; the Sponsor action pairs a label with up to three overlapping approved sponsor photos, hidden when none are available.

## Components

- **Yali identity:** use the supplied, unmodified `public/yali-logo.png` at 64px beside the Sponsors heading. The Tamil tagline reads “உங்கள் ஆதரவு, எங்கள் வலிமை.” (Your support is our strength.) and the footer thanks every supporter. Tamil text uses bundled Noto Sans Tamil with `lang="ta"`; retain the pink and pastel page palette.

- **Selection:** native sponsor and contribution buttons select the same record and synchronize `aria-pressed`. Tab navigates; Enter and Space activate. Focus uses a 2px rose outline with 5px offset. A polite, atomic live region announces details. Mobile selection scrolls details into view without moving focus.
- **Portraits:** valid HTTPS or root-relative photos cover circles; missing or failed photos reveal initials. Decorative images are hidden from assistive technology; buttons announce the sponsor and amount.
- **Motion:** arrival lasts 750ms, staggered by 35ms up to 500ms. Portrait hover transitions last 450ms; row background transitions last 180ms. Reduced motion disables animation, transitions, hover transforms, and smooth detail scrolling.
- **Data:** production loads approved entries from the API. The sample CSV is local-development data only. Public fields exclude email and payment references. Empty approved data shows a zero total and a welcoming empty wall.
- **Sponsor form:** a native modal pairs a plain QR with labeled fields; submission time is recorded automatically. Mobile stacks the QR above the form. Preserve input on errors, reuse request IDs for retries, and focus the saved-pending confirmation after success.
- **Returning sponsors:** check handles as they are entered. Existing IDs show an explicit warning, hide shared profile fields, and require an email code sent to the saved address. Only new payment details and a note are entered. Clear verification when the ID changes.
- **Admin:** email-link sign-in protects pending requests and CSV export. A centered sign-in surface opens into a review queue with status counts, filters, search and responsive review cards. Cards expose payment details for manual checking, with approve, reject, and email retry actions. Logout clears private rows and invalidates stale loads.

## Do's and Don'ts

The contribution feed uses small avatars and “Name paid ₹amount” sentences, with an @user_id and relative submission time below. Order it newest first using the CSV's UTC `paid_at` field; refresh labels every 30 seconds. Keep handles unique, case-insensitive, and independent of social IDs. Row hover uses a 3px horizontal nudge and warm background; reduced motion disables the nudge. Transaction IDs remain hidden.

- Do preserve the ivory canvas, pink heart, pastel circles, visible focus, and restrained motion.
- Do synchronize selected details between both entry points.
- Don't imply submitting a reference verifies payment; publish only after admin approval.
