/* eslint-disable max-len */
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Categories } from 'therr-js-utilities/constants';
import {
    Anchor, Breadcrumbs, Container, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import withTranslation from '../wrappers/withTranslation';

interface ICategoriesHubProps {
    locale: string;
    translate: (key: string, params?: any) => string;
}

const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };

const formatCategoryLabel = (categoryKey: string): string => {
    if (!categoryKey) return '';
    const label = categoryKey.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const CategoriesHub: React.FC<ICategoriesHubProps> = ({ locale, translate }) => {
    const lp = localePrefixMap[locale] || '';
    const categoryEntries = Object.entries(Categories.CategorySlugMap)
        .map(([key, slug]) => ({ key, slug, label: formatCategoryLabel(key) }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return (
        <Container size="lg" py={{ base: 'md', sm: 'xl' }} id="page_categories_hub">
            <Breadcrumbs mb="md">
                <Anchor component={Link} to="/">{translate('pages.categoriesHub.breadcrumb.home')}</Anchor>
                <Anchor component={Link} to="/locations">{translate('pages.categoriesHub.breadcrumb.locations')}</Anchor>
                <Text span>{translate('pages.categoriesHub.breadcrumb.categories')}</Text>
            </Breadcrumbs>

            <Stack gap="md" mb="xl">
                <Title order={1}>{translate('pages.categoriesHub.heading')}</Title>
                <Text>{translate('pages.categoriesHub.intro')}</Text>
            </Stack>

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                {categoryEntries.map((cat) => (
                    <Anchor
                        key={cat.slug}
                        component={Link}
                        to={`/locations/${cat.slug}`}
                        underline="hover"
                    >
                        {cat.label}
                    </Anchor>
                ))}
            </SimpleGrid>

            <Stack gap="sm" mt="xl">
                <Title order={2} size="h3">{translate('pages.categoriesHub.citiesCtaHeading')}</Title>
                <Text>
                    {translate('pages.categoriesHub.citiesCtaBody')}{' '}
                    <Anchor component={Link} to={`${lp}/locations/cities`}>
                        {translate('pages.categoriesHub.citiesCtaLink')}
                    </Anchor>.
                </Text>
            </Stack>
        </Container>
    );
};

export default withTranslation(CategoriesHub);
