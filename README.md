# Yali sponsor tracker

A TypeScript + Vite sponsor wall with a QR payment form and private admin review.

## How it works

1. Click **Sponsor**, scan the supplied UPI QR, and pay using your own UPI app.
2. Enter your name, unique user ID, email, amount, and transaction reference. Social ID, profile photo, and note are optional.
3. Submit for review. The server records the submission time automatically. The request is saved as **pending** and a confirmation email is sent.
4. Open **/admin.html**, request an email sign-in link, and review the payment against your UPI account. Approve to publish or reject to keep it hidden. The contributor receives a status email.
5. The public page fetches approved entries on each page load. No rebuild is needed after approval.

The form does **not** verify or initiate payments. Admin approval is manual. One request per unique user ID and payment reference is allowed, including rejected entries; contact the admin to correct an existing request.

## Private CSV and photos

The live `admin.csv` is in a **private Vercel Blob store**, not GitHub or the public assets folder. It tracks pending/approved/rejected status, email delivery, and review timestamps. Admins can download it from the authenticated admin page. `data/admin.example.csv` contains only the column headers.

Email addresses, transaction IDs, pending records, and pending photos are never returned by the public API. A profile photo is served through the API only after approval or to a signed-in admin. Names, handles, amounts, submission times, social IDs, photos and notes are published with the contributor's consent.

The clean QR (with the original payment payload) and Yali logo are committed in `public/`. Uploaded profile photos stay in private Blob storage, with approved images served through the API; they are not committed to the public GitHub repo.

CSV writes use conditional ETags and retries to avoid losing concurrent submissions. Email delivery uses an atomic claim to prevent normal concurrent duplicate sends. Admins can retry failed emails; an abandoned claim expires after two minutes. SMTP delivery and storage are separate services, so an uncertain SMTP result may still lead to a duplicate email on retry.

Preview branches, production and local development use separate storage namespaces. Preview test approvals cannot appear in production. API responses and private photos are not cached.

## Environment variables

Configure these **server-only** variables in Vercel (see `.env.example`):

- `BLOB_READ_WRITE_TOKEN`: a private Vercel Blob store's read/write token.
- `SMTP_USER` and `SMTP_PASS`: Gmail address and app password.
- `ADMIN_EMAIL`: destination for admin sign-in links.
- `ADMIN_SESSION_SECRET`: a cryptographically random secret of at least 32 characters.

Never use a `VITE_` prefix or commit real credentials. Admin links expire after 10 minutes and can only be used once. Sessions expire after eight hours and use Secure, HttpOnly, SameSite cookies. Sign-in emails and submissions are rate-limited; exported CSV neutralizes spreadsheet formulas.

Email outages do not remove a saved request. Delivery state is visible in the admin view. Storage failures show an error and preserve form input. Duplicate form retries reuse a request ID.

## Development and verification

Use Node.js 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run dev` shows the fictional `sponsors.example.csv` data for UI development. It does not run Vercel Functions. Test submissions, admin authentication, and real storage on a Vercel preview (or use `vercel dev` with server environment variables). `npm run preview` previews only the static build.

The sample CSV supports quoted values, multiline notes, unique lowercase handles, and UTC submission timestamps. Live submissions use server validation and their private review CSV; the existing `paid_at` column stores the server-recorded submission time for new requests. The sample data and private transaction references are not included in the production sponsor feed.

## Deploy

Import this repository into Vercel, connect the private Blob store and configure the environment variables. Vercel builds the Vite pages plus `api/sponsorship.ts`. PRs generate previews; merging the production branch deploys production.

The UI preserves the pastel palette, supplied logo, Tamil thank-you lines, keyboard controls, reduced-motion preferences, image fallbacks and newest-first activity times.
