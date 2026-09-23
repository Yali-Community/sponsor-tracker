## Storage migration

Runtime storage now uses a separate private GitHub repository. See [setup and recovery instructions](integrations/github-storage.md). The Blob dependency is retained only for the migration utility. Production data must be restored before switching deployments.

# Yali sponsor tracker

A TypeScript + Vite sponsor wall with a QR payment form and private admin review.

## How it works

1. Click **Sponsor** and verify your email with a six-digit code. The details form and UPI QR open after verification. The query number at the top of the page links to **+91 8248777476**.
2. Scan the QR or use the mobile UPI link, then enter your username and payment details. New users provide a name and can choose a pastel profile icon or upload an optional photo, with a live preview. After email verification, the form uses separate Username, Profile and Payment steps. Returning users skip profile entry after the saved email matches. Amounts are entered manually. Choose Instagram, X / Twitter, or a custom HTTPS link for an optional social profile. Existing usernames must match the verified email; their saved profile fields are reused.
3. Submit for review. The server records the submission time automatically. The request is saved as **pending** and a confirmation email is sent.
4. Open **/admin.html**, request an email sign-in link, and review the payment against your UPI account. Approve to publish or reject to keep it hidden. Approved contributions can be revoked with confirmation; they move to Revoked and leave the public wall and total without issuing a refund. The contributor receives a status email.
5. The public page shows one profile per username with approved amounts combined, alongside individual contribution entries and their notes. It fetches approved entries on each page load. No rebuild is needed after approval.

The form does **not** verify payments. Admin approval is manual. Payment references must be unique. Every submission requires an email proof bound to its request and email address; this is enforced server-side. Returning sponsors use their saved email for each new request. Codes expire after ten minutes and allow five attempts; code requests are rate-limited. Changing the email clears verification. Admins can correct saved profile details in **All users**.

## Private CSV and photos

The live `admin.csv` is in a **private Vercel Blob store**, not GitHub or the public assets folder. It tracks pending/approved/rejected/revoked status, email delivery, and review timestamps. Admins can download it from the authenticated admin page. `data/admin.example.csv` contains only the column headers.

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

Never use a `VITE_` prefix or commit real credentials. Admin links expire after 10 minutes and can only be used once. Sessions expire after eight hours and use Secure, HttpOnly, SameSite cookies. Sign-in emails and verification codes are rate-limited. Submissions allow up to ten successfully saved requests per email in a rolling five-minute window, checked atomically with the CSV write. Failed validation and idempotent retries do not consume this allowance; there is no per-IP submission cooldown. A genuine limit response includes a Retry-After value. Exported CSV neutralizes spreadsheet formulas.

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

The CSV/API field remains `user_id` for compatibility with saved records; the interface calls it **Username**.

The sample CSV supports quoted values, multiline notes, unique lowercase handles, and UTC submission timestamps. Live submissions use server validation and their private review CSV; the existing `paid_at` column stores the server-recorded submission time for new requests. The sample data and private transaction references are not included in the production sponsor feed.

## Deploy

Import this repository into Vercel, connect the private Blob store and configure the environment variables. Vercel builds the Vite pages plus `api/sponsorship.ts`. PRs generate previews; merging the production branch deploys production.

The UI preserves the pastel palette, supplied logo, Tamil thank-you lines, keyboard controls, reduced-motion preferences, image fallbacks and newest-first activity times.

### Managing users

Open **All users** in admin to search every submitted username, including pending, rejected and revoked contributions. **Edit user** updates the name, username, email, social ID and profile photo across all contributions for that user. Username conflicts are blocked; changing the email invalidates verification proofs for the previous address. Photos can be replaced or removed.

Expand **View contributions & edit amounts** to edit individual amounts, payment references and notes. Approved changes update the public wall and totals immediately. Submission/review timestamps remain system-managed; use the review queue to approve, reject or revoke. Concurrent edits are rejected with a refresh instruction, and edits wait while a status email is being sent. Profile corrections do not send extra emails.

Profile icons are bundled Lucide SVGs, recorded in the optional `avatar_icon` CSV column. Older CSVs remain readable and keep initials when no photo or icon is saved. Uploaded photos take priority. Repeat contributions reuse the saved icon; admins can change it under All users.

Username checks use a stable notice area: available or matching accounts show green, email mismatches show red and block Continue. Typing never hides or reveals profile fields; only explicit step navigation changes the layout. Late username responses are ignored, and Back preserves entered details.

### Admin quick entry

After signing in, use **Quick contribution** with only a username and amount, then **Add & publish** for a payment you have already checked. Entries are approved immediately and marked `entry_source=admin`, with an automatically generated internal reference (not a bank transaction ID). Repeated retries of the same entry do not add its amount twice. No email is sent when creating an admin entry.

Existing usernames keep their saved profile. New usernames use the username as the display name and a heart icon; their email remains blank. Admins can edit the profile or add a real email in **All users**. Until an admin adds an email, the public form cannot claim that username. Admin entries support the usual edit and revoke controls.

### Spending and user deletion

Open **View spending** for expenses, totals, search and category filters. Follow [Google Sheets setup](integrations/README.md) to publish the sheet. Configure server-only `SPENDING_SYNC_SECRET`; the public script is a template and the separately supplied private copy contains the passcode.

In **All users**, expand contributions and choose **Delete user & contributions**. Type the username to permanently remove the profile and all contributions, including approved amounts from public totals. This does not refund payments. Concurrent changes require a refresh before deletion.
