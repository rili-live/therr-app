/**
 * Phase 6 verification scenario 7 — Legacy tokens default to THERR.
 *
 * Tokens issued before the multi-app auth WIP branch carry no `brand` claim, so the
 * gateway never sets `x-brand-variation` for those requests. getBrandContext must
 * treat them as BrandVariations.THERR — same as the migration backfill default — so
 * the legacy population sees exactly the data they saw before this work.
 *
 * The `isLegacyToken` flag is the signal handlers can use to differentiate "this user
 * has a v1 token" from "this user is on Therr explicitly". The flag must be true ONLY
 * when there is a userId (proving the request is authenticated) but no brand header.
 */
import { expect } from 'chai';
import { BrandVariations } from '../src/constants/enums/Branding';
import getBrandContext from '../src/http/get-brand-context';

describe('getBrandContext — legacy token defaulting (Phase 6 scenario 7)', () => {
    it('defaults to THERR with isLegacyToken=true when an authenticated request has no brand header', () => {
        const ctx = getBrandContext({
            'x-userid': 'user-1',
        });
        expect(ctx.brandVariation).to.equal(BrandVariations.THERR);
        expect(ctx.isLegacyToken).to.equal(true);
        expect(ctx.hasExplicitBrand).to.equal(false);
    });

    it('does not flag isLegacyToken when the brand header is present', () => {
        const ctx = getBrandContext({
            'x-userid': 'user-1',
            'x-brand-variation': BrandVariations.HABITS,
        });
        expect(ctx.brandVariation).to.equal(BrandVariations.HABITS);
        expect(ctx.isLegacyToken).to.equal(false);
        expect(ctx.hasExplicitBrand).to.equal(true);
    });

    it('returns explicit Therr context (not legacy) when both headers are present and brand is therr', () => {
        const ctx = getBrandContext({
            'x-userid': 'user-1',
            'x-brand-variation': BrandVariations.THERR,
        });
        expect(ctx.brandVariation).to.equal(BrandVariations.THERR);
        expect(ctx.isLegacyToken).to.equal(false);
        expect(ctx.hasExplicitBrand).to.equal(true);
    });

    it('falls back to THERR (with hasExplicitBrand=false) when brand header value is unknown', () => {
        const ctx = getBrandContext({
            'x-userid': 'user-1',
            'x-brand-variation': 'not-a-real-brand',
        });
        // Unknown values are treated like missing — defense against header tampering or
        // a future enum drift. The user still sees Therr-defaulted data, never something
        // outside the validated brand set.
        expect(ctx.brandVariation).to.equal(BrandVariations.THERR);
        expect(ctx.hasExplicitBrand).to.equal(false);
    });

    it('does not flag isLegacyToken on unauthenticated requests (no userId)', () => {
        const ctx = getBrandContext({});
        // No userId means the request hasn't passed gateway auth — it's not a "legacy
        // user", just an anonymous request.
        expect(ctx.brandVariation).to.equal(BrandVariations.THERR);
        expect(ctx.isLegacyToken).to.equal(false);
        expect(ctx.hasExplicitBrand).to.equal(false);
    });
});
