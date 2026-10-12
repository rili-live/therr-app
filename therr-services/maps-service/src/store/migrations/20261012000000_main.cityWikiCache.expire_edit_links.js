// Expire City Pulse wiki rows cached with Wikivoyage "[edit | edit source]" link
// text in their sections.
//
// `wikiFetcher.stripHtml` removed the `mw-editsection` span with a lazy match that
// stopped at its first nested `</span>`, so the link labels survived as plain text
// ("Understand editedit source Geography ...") on /locations/city/:slug pages. The
// fetcher now passes `disableeditsection` and strips the full span; this makes the
// cityPulse handler's lazy refresh replace the existing rows on their next view
// instead of serving them until their 30-day TTL lapses.
//
// Every row with sections is affected (es/fr-ca carry the same markup with
// translated labels), so this matches on the column rather than the text.
// Idempotent: re-running only re-expires rows, which then refresh again.

exports.up = (knex) => knex.raw(`
    UPDATE main."cityWikiCache"
    SET "expiresAt" = NOW()
    WHERE sections IS NOT NULL
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
`);

// Cache invalidation only — there is no prior state to restore.
exports.down = () => Promise.resolve();
