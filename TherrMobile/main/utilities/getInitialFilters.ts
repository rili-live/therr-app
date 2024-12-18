
import { Categories } from 'therr-js-utilities/constants';
import { SELECT_ALL } from './categories';

export const authorOptions: { name: string; isChecked?: boolean }[] = [{ name: SELECT_ALL }, { name: 'me' }, { name: 'notMe' }];

export const categoryOptions: { name: string; isChecked?: boolean }[] = Object.values(Categories.CategoriesMap).map((cat: any) => ({ name: cat, data: [] }));

export const visibilityOptions: { name: string; isChecked?: boolean }[] = [
    { name: SELECT_ALL },
    { name: 'public' },
    { name: 'private' },
    { name: 'moments' },
    { name: 'spaces' },
    { name: 'events' },
];


const getInitialAuthorFilters = (translate) => authorOptions
    .map(a => ({ ...a, title: translate(`pages.mapFilteredSearch.labels.${a.name}`), isChecked: false }));

const getInitialCategoryFilters = (translate, shouldDefaultUnselectTitle = false) => [{
    title: shouldDefaultUnselectTitle ? translate('pages.mapFilteredSearch.labels.unSelectAll') : translate('pages.mapFilteredSearch.labels.selectAll'),
    name: SELECT_ALL,
}].concat(categoryOptions.map(c => ({
    ...c,
    title: c.name === 'categories.uncategorized'
        ? translate('pages.mapFilteredSearch.labels.uncategorized')
        : translate(c.name),
})));

const getInitialVisibilityFilters = (translate) => visibilityOptions
    .map(v => ({ ...v, title: translate(`pages.mapFilteredSearch.labels.${v.name}`) }));

export {
    getInitialAuthorFilters,
    getInitialCategoryFilters,
    getInitialVisibilityFilters,
};
