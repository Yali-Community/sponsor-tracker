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

Preserve the ivory canvas and pink heart identity. Keep the page minimal and sleek, with totals and contributions beside an open grid of pastel circular portraits. This document describes source code; browser visual verification has not been performed.

## Colors

The heart supplies the pink accent; rose marks focus and selected portraits. Ink and muted text sit on ivory with pale dividers. Five pastel portrait backgrounds cycle through CSV order and do not encode contribution size.

## Typography

Use bundled Manrope, with weights 400–700. The total is the strongest type; amounts use tabular numerals. The page title is 25px and wall headline 24px. Supporting text ranges from 10–14px. Long names and notes wrap. Transaction IDs stay in CSV data and are never rendered.

## Layout

The centered page has a 1280px maximum width and 56px desktop side padding. A 270px summary column and 70px gutter sit beside five sponsor columns. Selected details and the scrollable contribution list appear under the total.

At 1050px, side padding becomes 32px, the summary column 230px, the gutter 38px, and the wall four columns. At 760px, use 24px side padding and one vertical flow: summary, wall, details, contributions. The wall uses three columns, portraits up to 74px (80px on desktop), and a 44px total. The contribution list has a 198px maximum height.

## Elevation & Depth

Keep surfaces flat with thin dividers. Hovered portraits gain a faint shadow, 5px lift, and slight rotation. Selection uses a rose outline.

## Shapes

Circular portraits are the signature. Contribution rows and sponsor buttons have softly rounded interaction areas; the sample-data label is a bordered pill.

## Components

- **Selection:** native sponsor and contribution buttons select the same record and synchronize `aria-pressed`. Tab navigates; Enter and Space activate. Focus uses a 2px rose outline with 5px offset. A polite, atomic live region announces details. Mobile selection scrolls details into view without moving focus.
- **Portraits:** valid HTTPS or root-relative photos cover circles; missing or failed photos reveal initials. Decorative images are hidden from assistive technology; buttons announce the sponsor and amount.
- **Motion:** arrival lasts 750ms, staggered by 35ms up to 500ms. Portrait hover transitions last 450ms; row background transitions last 180ms. Reduced motion disables animation, transitions, hover transforms, and smooth detail scrolling.
- **CSV:** `sponsors.example.csv` is bundled at build time; changes require rebuilding. Columns are `profile_picture`, `name`, `social_id`, `amount`, `transaction_id`, and `notes`. Names and nonnegative amounts with up to two decimals are required. Derive INR totals and counts from rows; preserve CSV order. Render values as text and show optional details only when populated.
- **Data states:** a header-only CSV shows a zero summary and empty wall, hiding details and contributions. Invalid data displays an alert with correction and rebuild guidance. Retain the sample-data label while using example records.

## Do's and Don'ts

The contribution feed uses small avatars and “Name paid ₹amount” sentences, with an @user_id and relative payment time below. Order it newest first using the CSV's UTC `paid_at` field; refresh labels every 30 seconds. Keep handles unique, case-insensitive, and independent of social IDs. Row hover uses a 3px horizontal nudge and warm background; reduced motion disables the nudge. Transaction IDs remain hidden.

- Do preserve the ivory canvas, pink heart, pastel circles, visible focus, and restrained motion.
- Do synchronize selected details between both entry points.
- Don't imply example records are verified sponsors or CSV edits automatically update deployed builds.
