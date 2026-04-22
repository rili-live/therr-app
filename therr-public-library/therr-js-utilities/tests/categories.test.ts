import { expect } from 'chai';
import Categories from '../src/constants/Categories';

describe('Categories', () => {
    describe('QuickReportCategories', () => {
        it('should be exported', () => {
            expect(Categories.QuickReportCategories).to.be.an('array');
        });

        it('should include existing deals and warning categories', () => {
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[16]); // deals
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[23]); // warning
        });

        it('should include all new quick report categories', () => {
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[30]); // happeningNow
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[31]); // longWait
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[32]); // liveEntertainment
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[33]); // crowdAlert
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[34]); // hiddenGem
            expect(Categories.QuickReportCategories).to.include(Categories.CategoriesMap[35]); // localDeal
        });

        it('should have 8 categories total', () => {
            expect(Categories.QuickReportCategories).to.have.lengthOf(8);
        });

        it('new quick report categories (30-35) should be in MomentCategories', () => {
            for (let id = 30; id <= 35; id += 1) {
                const cat = Categories.CategoriesMap[id];
                expect(Categories.MomentCategories).to.include(
                    cat,
                    `Quick report category "${cat}" (ID ${id}) should be in MomentCategories`,
                );
            }
        });
    });

    describe('QuickReportExpiryHoursMap', () => {
        it('should be exported', () => {
            expect(Categories.QuickReportExpiryHoursMap).to.be.an('object');
        });

        it('should have an expiry for every quick report category', () => {
            Categories.QuickReportCategories.forEach((cat: string) => {
                expect(Categories.QuickReportExpiryHoursMap[cat]).to.be.a(
                    'number',
                    `Missing expiry for category "${cat}"`,
                );
                expect(Categories.QuickReportExpiryHoursMap[cat]).to.be.greaterThan(0);
            });
        });

        it('hiddenGem should have the longest expiry (24h)', () => {
            const hiddenGemExpiry = Categories.QuickReportExpiryHoursMap[Categories.CategoriesMap[34]];
            expect(hiddenGemExpiry).to.be.equal(24);
        });

        it('all expiries should be between 1 and 48 hours', () => {
            Object.values(Categories.QuickReportExpiryHoursMap).forEach((hours) => {
                expect(hours).to.be.at.least(1);
                expect(hours).to.be.at.most(48);
            });
        });
    });

    describe('New CategoriesMap entries', () => {
        it('should have category IDs 30-35 defined', () => {
            expect(Categories.CategoriesMap[30]).to.be.equal('categories.happeningNow');
            expect(Categories.CategoriesMap[31]).to.be.equal('categories.longWait');
            expect(Categories.CategoriesMap[32]).to.be.equal('categories.liveEntertainment');
            expect(Categories.CategoriesMap[33]).to.be.equal('categories.crowdAlert');
            expect(Categories.CategoriesMap[34]).to.be.equal('categories.hiddenGem');
            expect(Categories.CategoriesMap[35]).to.be.equal('categories.localDeal');
        });

        it('should have CategoryToInterestsMap entries for all new categories', () => {
            for (let id = 30; id <= 35; id += 1) {
                const cat = Categories.CategoriesMap[id];
                expect(Categories.CategoryToInterestsMap[cat]).to.be.an(
                    'array',
                    `Missing CategoryToInterestsMap entry for "${cat}"`,
                );
                expect(Categories.CategoryToInterestsMap[cat].length).to.be.greaterThan(0);
            }
        });

        it('should have ComplementaryCategoriesMap entries for all new categories', () => {
            for (let id = 30; id <= 35; id += 1) {
                const cat = Categories.CategoriesMap[id];
                expect(Categories.ComplementaryCategoriesMap[cat]).to.be.an(
                    'array',
                    `Missing ComplementaryCategoriesMap entry for "${cat}"`,
                );
                expect(Categories.ComplementaryCategoriesMap[cat].length).to.be.greaterThan(0);
            }
        });
    });
});
