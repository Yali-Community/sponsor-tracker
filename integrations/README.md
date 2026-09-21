# Publish spending from Google Sheets

The public page is `https://sponsor-tracker-omega.vercel.app/spending.html`.

1. Create a private Google Sheet. Open **Extensions → Apps Script**.
2. Paste `google-sheets.gs`, replacing any existing code, and set `SPENDING_PASSCODE` to the same unique secret as Vercel's server-only `SPENDING_SYNC_SECRET`. The ready-to-paste private copy supplied separately already contains your passcode. Do not commit that copy or share sheet edit access with people who should not publish.
3. Save and reload the sheet. Choose **Yali spending → Set up spending tab**. Authorize the script when Google asks.
4. Fill `id`, `date`, `description`, `category`, `amount`, `notes`. Use permanent unique IDs like `expense-001`, real dates formatted `YYYY-MM-DD`, and numeric INR amounts with at most two decimal places. Description is required; category and notes are optional. Do not put emails, private receipts, passcodes or payment references in these columns: every expense field is public.
5. Choose **Yali spending → Publish spending**, confirm, and refresh the website. You can also assign `publishSpending` to a drawing/button in Google Sheets. No Apps Script web app deployment is needed.

This is a complete snapshot, not an append: edits replace earlier rows and deleted sheet rows disappear from the site. Blank rows are ignored; invalid rows abort the whole update and leave the old data intact. An empty sheet is blocked to avoid accidental clearing; use `clearPublishedSpending` from the script editor for deliberate clearing. Up to 2,000 rows and ₹10,00,000 per expense are supported. Totals use integer paise.

The Apps Script menu is for **Google Sheets**, not desktop Microsoft Excel. The webhook accepts other clients sending the same JSON request and Bearer passcode.

## API

- `GET /api/spending`: public snapshot with `revision`, `updated_at`, and `expenses`.
- `POST /api/spending`: `Authorization: Bearer <private-passcode>` and `Content-Type: application/json`.
- Body: `{ "revision": 0, "expenses": [{ "id": "expense-001", "date": "2026-09-21", "description": "Venue hire", "category": "Events", "amount": "1500", "notes": "" }] }`.
- Fetch the current revision before publishing. Conflicting updates return 409 instead of silently overwriting a newer snapshot. Publishing an identical snapshot is idempotent. Deliberate empty lists also require `confirm_empty: true`.

Storage is private Vercel Blob, separate from sponsorship records and scoped by deployment environment/branch. Publishing expenses never changes sponsor balances. The passcode can only update spending; it cannot manage users. Rotate it by replacing the Vercel secret and the private script constant, then redeploy.

Google reference: [custom menus](https://developers.google.com/apps-script/guides/menus), [HTTP requests](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app), [document locks](https://developers.google.com/apps-script/reference/lock/lock-service).
