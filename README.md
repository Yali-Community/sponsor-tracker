# Sponsor tracker

A minimal TypeScript and Vite sponsor wall with an orange heart, warm-toned avatars, and a total calculated from CSV.

## Sponsor data

Edit `sponsors.example.csv` in the repository root. The page imports it at build time; rebuild and redeploy after changing it. Every row appears in the avatar wall and contributions list. All included entries are fictional sample data.

- `profile_picture`: HTTPS image URL or a root-relative path to an image in `public/`. Blank or failed images display initials.
- `name`: sponsor name (required).
- `social_id`: plain text, not restricted to a platform.
- `amount`: non-negative INR amount, with up to two decimal places and no currency symbol or grouping commas.
- `transaction_id`: plain text reference.
- `notes`: optional text. Quote values that contain commas, quotes, or line breaks using normal CSV escaping.

Select an avatar or contribution to see the sponsor's details. The shipped sample label is in `index.html`; update it when replacing the sample data. Transaction IDs are retained in the CSV but are not displayed in the UI. The CSV is bundled into the public site, so this is not a privacy boundary.

The page supports keyboard selection, image fallbacks, empty/error states, and reduced-motion preferences.

## Development

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

The build checks TypeScript and generates the static site in `dist/`.

Run `npm test` for CSV parsing, amount validation, total calculation, and profile URL tests.

## Deploy to Vercel

Import this repository into Vercel with the repository root as the root directory.
The included `vercel.json` selects Vite, runs `npm run build`, and publishes `dist/`.
No environment variables are required.

## Color theme

Colors follow [mohan-bee/yali](https://github.com/mohan-bee/yali/blob/main/src/style.css): paper `#faf7ef`, ink `#20211c`, muted `#626155`, orange `#f58612`, and dividers `#d8d4c8`. Focus uses Yali’s burnt orange `#9c4200`; avatar backgrounds are soft tints that complement this palette.
