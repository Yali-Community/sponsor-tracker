# Sponsor tracker

A minimal TypeScript and Vite website with a Sponsors heading and a pink heart.

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

## Deploy to Vercel

Import this repository into Vercel with the repository root as the root directory.
The included `vercel.json` selects Vite, runs `npm run build`, and publishes `dist/`.
No environment variables are required.
