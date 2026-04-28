import { BrandVariations } from '../constants/enums/Branding';
import { isKnownBrand } from '../db/brand-scoped';

export interface IBrandContext {
    brandVariation: BrandVariations;
    isLegacyToken: boolean;
    hasExplicitBrand: boolean;
}

const getBrandContext = (headers: { [key: string]: any }): IBrandContext => {
    const rawBrand = headers['x-brand-variation'];
    const userId = headers['x-userid'];
    const hasExplicitBrand = !!rawBrand && isKnownBrand(rawBrand);
    const brandVariation: BrandVariations = hasExplicitBrand ? (rawBrand as BrandVariations) : BrandVariations.THERR;
    const isLegacyToken = !rawBrand && !!userId;

    return {
        brandVariation,
        isLegacyToken,
        hasExplicitBrand,
    };
};

export default getBrandContext;
