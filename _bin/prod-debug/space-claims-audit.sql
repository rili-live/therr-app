-- Space claim audit — read-only.
--
-- Run against the maps database (therr_prod_maps) to see what the admin claim queue
-- actually holds, what the dashboard was showing instead, and which approved space
-- requests still carry a requester and need releasing.
--
--   psql "$MAPS_DB_URL" -f _bin/prod-debug/space-claims-audit.sql
--
-- Every statement below is a SELECT. Nothing here writes. The one repair statement is
-- at the bottom, commented out, and should only be run deliberately.
--
-- Production super admin id (therr-services/maps-service/src/constants/index.ts):
--   568bf5d2-8595-4fd6-95da-32cc318618d3
-- Spaces owned by that id are unclaimed inventory rather than a business's own page.

\set superAdminId '568bf5d2-8595-4fd6-95da-32cc318618d3'

\echo ''
\echo '=== 1. The real claim queue (what /dashboard-admin should list) ==='
-- A claim awaiting review takes one of two shapes:
--   a) a space created by the claim itself, flagged isClaimPending — from
--      POST /spaces/request-claim
--   b) a claim on a space already on the map, which only stamps requestedByUserId —
--      from POST /spaces/request-claim/:spaceId
-- Shape (b) is intentionally NOT flagged pending, so that a live business is not pulled
-- off the map while an admin reviews it.
SELECT
    s.id,
    s."notificationMsg"                                    AS title,
    s."addressReadable"                                    AS address,
    s."fromUserId"                                         AS owner_id,
    s."requestedByUserId"                                  AS claimant_id,
    s."isClaimPending"                                     AS pending_flag,
    s."isPublic",
    s."createdAt",
    s."updatedAt",
    CASE
        WHEN s."isClaimPending" THEN 'new-space request'
        ELSE 'claim on existing space'
    END                                                    AS claim_shape,
    now() - s."createdAt"                                  AS age
FROM main.spaces s
WHERE s."isMatureContent" = false
  AND (
        s."isClaimPending" = true
     OR (s."requestedByUserId" IS NOT NULL AND s."fromUserId" <> s."requestedByUserId")
  )
ORDER BY s."createdAt" DESC;

\echo ''
\echo '=== 2. Count by shape ==='
SELECT
    CASE
        WHEN "isClaimPending" THEN 'new-space request (isClaimPending)'
        ELSE 'claim on existing space (requestedByUserId only)'
    END AS claim_shape,
    count(*)
FROM main.spaces
WHERE "isMatureContent" = false
  AND (
        "isClaimPending" = true
     OR ("requestedByUserId" IS NOT NULL AND "fromUserId" <> "requestedByUserId")
  )
GROUP BY 1;

\echo ''
\echo '=== 3. What the dashboard was actually showing (the buggy query) ==='
-- The old store query ORed `isPublic = true` into the isClaimPending filter, then ordered
-- by distance from Austin, TX with LIMIT 50. The result was "the 50 public spaces nearest
-- Austin", almost none of them claims. The `pending_flag` column below is the tell: rows
-- where it is false were never claim requests at all.
SELECT
    s.id,
    s."notificationMsg"  AS title,
    s."isClaimPending"   AS pending_flag,
    s."isPublic",
    s."requestedByUserId" AS claimant_id,
    round((ST_Distance(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography) / 1609.34)::numeric, 1) AS miles_from_austin
FROM main.spaces s
WHERE ST_DWithin(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography, 20037943)
  AND s."isMatureContent" = false
  AND (s."isClaimPending" = true OR s."isPublic" = true)
ORDER BY ST_Distance(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography) ASC
LIMIT 50;

\echo ''
\echo '=== 4. How many of those 50 rows were real claims ==='
SELECT
    count(*) FILTER (WHERE pending_flag)       AS real_claims_shown,
    count(*) FILTER (WHERE NOT pending_flag)   AS unrelated_public_spaces_shown,
    count(*)                                   AS total_rows_shown
FROM (
    SELECT s."isClaimPending" AS pending_flag
    FROM main.spaces s
    WHERE ST_DWithin(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography, 20037943)
      AND s."isMatureContent" = false
      AND (s."isClaimPending" = true OR s."isPublic" = true)
    ORDER BY ST_Distance(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography) ASC
    LIMIT 50
) shown;

\echo ''
\echo '=== 5. Pending claims that the buggy query could never have reached ==='
-- Anything here was invisible to the admin: a genuine pending claim that fell outside the
-- 50 nearest-to-Austin rows.
WITH shown AS (
    SELECT s.id
    FROM main.spaces s
    WHERE ST_DWithin(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography, 20037943)
      AND s."isMatureContent" = false
      AND (s."isClaimPending" = true OR s."isPublic" = true)
    ORDER BY ST_Distance(s."geomCenter"::geography, ST_MakePoint(-97.9205478, 30.3076576)::geography) ASC
    LIMIT 50
)
SELECT
    s.id,
    s."notificationMsg" AS title,
    s."addressReadable" AS address,
    s."requestedByUserId" AS claimant_id,
    s."createdAt"
FROM main.spaces s
WHERE s."isMatureContent" = false
  AND (
        s."isClaimPending" = true
     OR (s."requestedByUserId" IS NOT NULL AND s."fromUserId" <> s."requestedByUserId")
  )
  AND s.id NOT IN (SELECT id FROM shown)
ORDER BY s."createdAt" DESC;

\echo ''
\echo '=== 6. Approved space requests still carrying a requester ==='
-- These are consumer "Request a Space" suggestions (POST /spaces/request-claim, created
-- under the super admin) that an admin approved. Approval cleared isClaimPending but left
-- requestedByUserId set. They are NOT business claims and ownership must NOT move — the
-- requester was suggesting a public business, not claiming it. Left as they are, the
-- corrected admin queue (section 1) lists every one of them as a fresh claim,
-- isClaimAwaitingApproval pins a pending banner on them, and isUnclaimed stays false so
-- no business can ever claim them. The repair releases them: requestedByUserId → NULL.
--
-- READ THIS BEFORE THE FIX SHIPS. On today's data these rows are unambiguous: the only
-- writer that ever set requestedByUserId was the new-space request path, which always set
-- isClaimPending alongside it, so a row with a requester and no pending flag is an
-- approved request. Once the fix is deployed, claims on existing spaces start setting
-- requestedByUserId WITHOUT the pending flag, and a still-pending claim of that shape
-- becomes indistinguishable here from an approved request — so cross-check against
-- section 1 if you run this later. Running the repair at the bottom before the deploy
-- avoids the ambiguity entirely.
SELECT
    s.id,
    s."notificationMsg"  AS title,
    s."addressReadable"  AS address,
    s."requestedByUserId" AS requester_id,
    s."createdAt",
    s."updatedAt"
FROM main.spaces s
WHERE s."isClaimPending" = false
  AND s."requestedByUserId" IS NOT NULL
  AND s."fromUserId" = :'superAdminId'
ORDER BY s."updatedAt" DESC;

\echo ''
\echo '=== 7. Claim volume by week, to compare against the admin emails you received ==='
-- Claims on existing spaces (POST /spaces/request-claim/:spaceId) never wrote to the
-- database at all before this fix: the update threw on an undefined binding, the handler
-- swallowed it and still returned 200. Those claims exist ONLY as the admin notification
-- email. If a week here shows fewer rows than you have emails for, the difference is that
-- lost path, and the space must be re-claimed (or assigned by hand) to be recoverable.
SELECT
    date_trunc('week', "createdAt") AS week,
    count(*) FILTER (WHERE "isClaimPending")                          AS new_space_requests,
    count(*) FILTER (WHERE "requestedByUserId" IS NOT NULL)           AS rows_with_a_claimant
FROM main.spaces
WHERE "createdAt" > now() - interval '180 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '=== 8. Look up one space or claimant named in an admin email ==='
-- The claim-request email carries the claimant userId and the address. Fill either in.
-- \set claimantId 'paste-user-id-here'
-- SELECT id, "notificationMsg", "addressReadable", "fromUserId", "requestedByUserId",
--        "isClaimPending", "isPublic", "createdAt", "updatedAt"
-- FROM main.spaces
-- WHERE "requestedByUserId" = :'claimantId'
--    OR "fromUserId" = :'claimantId'
-- ORDER BY "createdAt" DESC;
--
-- SELECT id, "notificationMsg", "addressReadable", "fromUserId", "requestedByUserId",
--        "isClaimPending", "createdAt"
-- FROM main.spaces
-- WHERE "addressReadable" ILIKE '%paste part of the address%'
-- ORDER BY "createdAt" DESC;

-- ---------------------------------------------------------------------------
-- REPAIR (commented out — run only after reviewing section 6)
--
-- Releases already-approved space requests back to unclaimed inventory, which is what
-- SpacesStore.approveClaim now does for that shape at approval time. Check section 6
-- first; every row it lists is a row this would change. Do NOT transfer ownership here —
-- these rows are consumer suggestions, and handing them to the requester gives a
-- consumer account a business page.
--
-- Best run BEFORE the fix is deployed, for the two reasons in section 6: the rows are
-- unambiguous until then, and leaving them unrepaired means the corrected admin queue
-- picks them back up as though they were fresh claims awaiting review.
--
-- `scripts/import-spaces/repair-space-claims` runs this same statement with a
-- preview/row-count guard; prefer it.
--
-- BEGIN;
-- UPDATE main.spaces
-- SET "requestedByUserId" = NULL,
--     "updatedAt"         = now()
-- WHERE "isClaimPending" = false
--   AND "requestedByUserId" IS NOT NULL
--   AND "fromUserId" = '568bf5d2-8595-4fd6-95da-32cc318618d3';
-- -- confirm the row count matches section 6, then COMMIT (or ROLLBACK).
-- COMMIT;
-- ---------------------------------------------------------------------------
