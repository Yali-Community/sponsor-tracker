# Private GitHub storage

The site stays hosted on Vercel. Runtime storage uses a separate **private** GitHub repository: `production/admin.csv`, `production/spending.json`, photos, and one-time verification/rate-limit claims. Preview branches use isolated prefixes. Never store the admin CSV in the public website repository.

Server-only variables:
- `GITHUB_STORAGE_REPO`: owner/repository.
- `GITHUB_STORAGE_TOKEN`: a token with Contents read/write access to the private data repository; never use a `VITE_` prefix.
- `GITHUB_STORAGE_BRANCH`: defaults to `main` (initialize that branch first).

Every operation checks repository privacy. Writes use GitHub file SHAs for optimistic concurrency. Missing production CSV or spending data fails closed instead of silently resetting amounts. Approved sponsor feeds/photos have a 60-second Vercel CDN cache; admin writes and private responses are uncached. Public edits, revocations and deletions may take up to a minute to appear. Spending remains uncached so Sheets can retrieve a fresh revision.

## Migration

1. Stop old application writes. Keep the Blob token and source data until migration is verified.
2. Configure the GitHub variables and `BLOB_READ_WRITE_TOKEN` in a local ignored env file.
3. Run `node --env-file=.env.local --experimental-strip-types scripts/migrate-blob.mjs /absolute/private/recovery-directory` from the repo. The directory must be outside the public repository. This downloads every production file before writing to GitHub, keeps paths intact, checks byte equality, and copies the CSV last. Re-running skips identical destination files and refuses conflicting ones.
4. Deploy only after the migrated CSV, spending data and photos are verified. Confirm public totals, admin sign-in/edit, a preview submission and Sheets sync. Do not delete the old store until recovery is complete.

If Vercel downloads return 403 due to the quota pause, migration cannot recover those bytes. Restore access or supply a trusted backup; do not invent records or initialize an empty production CSV. An exported admin CSV may have formula-escaped fields and needs review before import. Missing photos and spending need separate recovery.

GitHub has API and write-rate limits; this is for a small tracker, not high-volume database traffic. Deleting a user removes their live record and unused photo, but Git commit history retains prior versions. Restrict repository access accordingly. Rotate a disclosed token and update Vercel before revoking the old one.

References: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [Vercel Blob quota behavior](https://vercel.com/docs/vercel-blob/usage-and-pricing).
