import { IHabitGoal } from 'therr-react/types';

/**
 * How the "Pick a habit" step groups and labels system templates.
 *
 * Categories come from the template's own `category` column (seeded by users-service
 * migration `20260925000002_habits.habit_goals.seedCategorizedTemplates.js`). This list is
 * the picker's display order; a category the app does not know yet is still shown, last,
 * under "Other", so a template added server-side is never unreachable from an older build.
 */
export const TEMPLATE_CATEGORY_ORDER = [
    'fitness',
    'money',
    'mindfulness',
    'health',
    'productivity',
    'learning',
    'social',
    'home',
] as const;

export const POPULAR_CATEGORY = 'popular';
export const OTHER_CATEGORY = 'other';

/** How many templates the default "Popular" tab shows. */
export const POPULAR_TEMPLATE_COUNT = 6;

/**
 * With this many templates or fewer, the picker shows them all in one list — tabs over a
 * handful of cards only add a tap.
 */
export const MIN_TEMPLATES_FOR_CATEGORIES = POPULAR_TEMPLATE_COUNT;

/**
 * Breaks `usageCount` ties in "Popular". Every template starts at zero, so without this the
 * first thing a new user saw would be whatever order Postgres returned equal rows in.
 */
const FEATURED_TEMPLATE_KEYS = [
    'workOut',
    'saveGroupTrip',
    'read15',
    'meditate',
    'goForWalk',
    'noSpendDay',
];

type Translate = (key: string, params?: any) => string;

export const getTemplateCategory = (template: IHabitGoal): string => (
    (TEMPLATE_CATEGORY_ORDER as readonly string[]).includes(template.category || '')
        ? template.category as string
        : OTHER_CATEGORY
);

/** The tabs to offer, in order: Popular, then each known category present, then Other. */
export const getTemplateCategories = (templates: IHabitGoal[]): string[] => {
    const present = new Set(templates.map(getTemplateCategory));

    return [
        POPULAR_CATEGORY,
        ...TEMPLATE_CATEGORY_ORDER.filter((category) => present.has(category)),
        ...(present.has(OTHER_CATEGORY) ? [OTHER_CATEGORY] : []),
    ];
};

const featuredRank = (template: IHabitGoal) => {
    const index = FEATURED_TEMPLATE_KEYS.indexOf(template.templateKey || '');
    return index === -1 ? FEATURED_TEMPLATE_KEYS.length : index;
};

export const getTemplatesForCategory = (templates: IHabitGoal[], category: string): IHabitGoal[] => {
    if (category === POPULAR_CATEGORY) {
        return templates
            .map((template, index) => ({ template, index }))
            .sort((a, b) => ((b.template.usageCount || 0) - (a.template.usageCount || 0))
                || (featuredRank(a.template) - featuredRank(b.template))
                || (a.index - b.index))
            .slice(0, POPULAR_TEMPLATE_COUNT)
            .map(({ template }) => template);
    }

    return templates.filter((template) => getTemplateCategory(template) === category);
};

export const getTemplateCategoryLabel = (category: string, translate: Translate): string => {
    const key = `pages.pacts.templateCategories.${category}`;
    const label = translate(key);
    return label === key ? translate('pages.pacts.templateCategories.other') : label;
};

/**
 * A template's name and description in the user's language.
 *
 * The stored text is English. When the dictionaries carry the template's key, that wins;
 * otherwise — a template seeded before its translations shipped, or one without a key —
 * the stored text is used. The translator returns the key itself for a missing entry,
 * which is what the comparison detects.
 */
export const localizeTemplate = (
    template: IHabitGoal,
    translate: Translate,
): { name: string; description?: string } => {
    if (!template.templateKey) {
        return { name: template.name, description: template.description };
    }

    const nameKey = `pages.pacts.templates.${template.templateKey}.name`;
    const descriptionKey = `pages.pacts.templates.${template.templateKey}.description`;
    const name = translate(nameKey);
    const description = translate(descriptionKey);

    return {
        name: name === nameKey ? template.name : name,
        description: description === descriptionKey ? template.description : description,
    };
};
