import { expect } from 'chai';
import { canRepostThought, isThoughtRepostableBy } from '../src/content';

describe('content/reposts', () => {
    describe('isThoughtRepostableBy', () => {
        it('allows anyone to repost a public thought', () => {
            expect(isThoughtRepostableBy({ id: 't1', fromUserId: 'author', isPublic: true }, 'reader'))
                .to.equal(true);
        });

        it('refuses a reader reposting somebody else\'s non-public thought', () => {
            expect(isThoughtRepostableBy({ id: 't1', fromUserId: 'author', isPublic: false }, 'reader'))
                .to.equal(false);
        });

        it('allows an author to repost their own non-public thought', () => {
            expect(isThoughtRepostableBy({ id: 't1', fromUserId: 'author', isPublic: false }, 'author'))
                .to.equal(true);
        });

        // Replies are minted with isPublic=false by every client, so an absent flag must read
        // as "not public" rather than as "unknown, allow it".
        it('treats an absent isPublic as not public', () => {
            expect(isThoughtRepostableBy({ id: 't1', fromUserId: 'author' }, 'reader')).to.equal(false);
        });

        it('refuses an anonymous viewer on a non-public thought', () => {
            expect(isThoughtRepostableBy({ id: 't1', fromUserId: 'author', isPublic: false }, undefined))
                .to.equal(false);
        });

        // Guards against an undefined fromUserId matching an undefined viewer id.
        it('does not treat two unknown ids as the same person', () => {
            expect(isThoughtRepostableBy({ id: 't1' }, undefined)).to.equal(false);
        });

        it('refuses a missing thought', () => {
            expect(isThoughtRepostableBy(null, 'reader')).to.equal(false);
        });
    });

    describe('canRepostThought', () => {
        const publicThought = { id: 't1', fromUserId: 'author', isPublic: true };

        it('offers the control on a public thought', () => {
            expect(canRepostThought(publicThought, 'reader')).to.equal(true);
        });

        it('refuses a draft, which has no id the server would accept', () => {
            expect(canRepostThought({ ...publicThought, isDraft: true }, 'reader')).to.equal(false);
        });

        it('refuses a thought that is already a repost, since the server collapses to the root', () => {
            expect(canRepostThought({ ...publicThought, isRepost: true }, 'reader')).to.equal(false);
        });

        it('refuses a thought with no id', () => {
            expect(canRepostThought({ fromUserId: 'author', isPublic: true }, 'reader')).to.equal(false);
        });

        it('defers to the access rule for a non-public thought', () => {
            expect(canRepostThought({ ...publicThought, isPublic: false }, 'reader')).to.equal(false);
            expect(canRepostThought({ ...publicThought, isPublic: false }, 'author')).to.equal(true);
        });
    });
});
