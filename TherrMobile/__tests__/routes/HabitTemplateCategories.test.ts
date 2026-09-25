import { it, describe, expect } from '@jest/globals';
import {
    getTemplateCategories,
    getTemplateCategoryLabel,
    getTemplatesForCategory,
    localizeTemplate,
    OTHER_CATEGORY,
    POPULAR_CATEGORY,
    POPULAR_TEMPLATE_COUNT,
    TEMPLATE_CATEGORY_ORDER,
} from '../../main/routes/Pacts/habitTemplates';
import translator from '../../main/utilities/translator';
import enUs from '../../main/locales/en-us/dictionary.json';
import es from '../../main/locales/es/dictionary.json';

/**
 * The "Pick a habit" step's grouping and translation of system templates.
 *
 * Templates are stored server-side in English with a `templateKey`; the dictionaries
 * carry the translation. The cases that matter are the fallbacks — a template the app has
 * no key or no translation for must still render its stored text, and a category the app
 * does not know must still be reachable — because either failure hides a template from a
 * user on an older build with no error anywhere.
 */

const template = (overrides: any = {}): any => ({
    id: overrides.templateKey || overrides.name || 'goal',
    name: 'Stored name',
    description: 'Stored description',
    category: 'fitness',
    usageCount: 0,
    ...overrides,
});

const translateEs = (key: string) => translator('es', key);
const translateEn = (key: string) => translator('en-us', key);

describe('localizeTemplate', () => {
    it('uses the dictionary when the template has a key', () => {
        const result = localizeTemplate(
            template({ templateKey: 'workOut', name: 'Work out' }),
            translateEs,
        );

        expect(result.name).toBe('Hacer ejercicio');
        expect(result.description).toBe(es.pages.pacts.templates.workOut.description);
    });

    it('falls back to the stored text when the key has no translation', () => {
        const result = localizeTemplate(template({ templateKey: 'shippedAfterThisBuild' }), translateEs);

        expect(result).toEqual({ name: 'Stored name', description: 'Stored description' });
    });

    it('uses the stored text for a template with no key', () => {
        expect(localizeTemplate(template(), translateEs).name).toBe('Stored name');
    });
});

describe('getTemplateCategories', () => {
    it('leads with Popular, follows the display order, and skips empty categories', () => {
        const categories = getTemplateCategories([
            template({ category: 'home' }),
            template({ category: 'fitness' }),
            template({ category: 'money' }),
        ]);

        expect(categories).toEqual([POPULAR_CATEGORY, 'fitness', 'money', 'home']);
    });

    it('puts unknown and missing categories under Other, last', () => {
        const categories = getTemplateCategories([
            template({ category: 'somethingNew' }),
            template({ category: undefined }),
            template({ category: 'fitness' }),
        ]);

        expect(categories).toEqual([POPULAR_CATEGORY, 'fitness', OTHER_CATEGORY]);
        expect(getTemplatesForCategory([template({ category: 'somethingNew' })], OTHER_CATEGORY)).toHaveLength(1);
    });
});

describe('getTemplatesForCategory', () => {
    it('ranks Popular by usage, capped', () => {
        const templates = Array.from({ length: 10 }, (_, i) => template({ name: `t${i}`, usageCount: i }));
        const popular = getTemplatesForCategory(templates, POPULAR_CATEGORY);

        expect(popular).toHaveLength(POPULAR_TEMPLATE_COUNT);
        expect(popular[0].name).toBe('t9');
    });

    it('breaks ties with the featured templates rather than arbitrary row order', () => {
        const popular = getTemplatesForCategory([
            template({ templateKey: 'laundry' }),
            template({ templateKey: 'saveGroupTrip' }),
            template({ templateKey: 'workOut' }),
        ], POPULAR_CATEGORY);

        expect(popular.map((t) => t.templateKey)).toEqual(['workOut', 'saveGroupTrip', 'laundry']);
    });
});

describe('category labels', () => {
    it('has a label for every category in every locale', () => {
        [...TEMPLATE_CATEGORY_ORDER, POPULAR_CATEGORY, OTHER_CATEGORY].forEach((category) => {
            expect(enUs.pages.pacts.templateCategories).toHaveProperty(category);
        });
    });

    it('labels an unknown category as Other', () => {
        expect(getTemplateCategoryLabel('somethingNew', translateEn)).toBe('Other');
    });
});
