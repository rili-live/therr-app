/* eslint-disable max-len */
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Cities } from 'therr-js-utilities/constants';
import {
    Anchor, Breadcrumbs, Container, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import withTranslation from '../wrappers/withTranslation';

interface ICitiesHubProps {
    locale: string;
    translate: (key: string, params?: any) => string;
}

const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };

const CitiesHub: React.FC<ICitiesHubProps> = ({ locale, translate }) => {
    const lp = localePrefixMap[locale] || '';
    const cities = [...Cities.CitiesList].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Container size="lg" py={{ base: 'md', sm: 'xl' }} id="page_cities_hub">
            <Breadcrumbs mb="md">
                <Anchor component={Link} to="/">{translate('pages.citiesHub.breadcrumb.home')}</Anchor>
                <Anchor component={Link} to="/locations">{translate('pages.citiesHub.breadcrumb.locations')}</Anchor>
                <Text span>{translate('pages.citiesHub.breadcrumb.cities')}</Text>
            </Breadcrumbs>

            <Stack gap="md" mb="xl">
                <Title order={1}>{translate('pages.citiesHub.heading')}</Title>
                <Text>{translate('pages.citiesHub.intro')}</Text>
            </Stack>

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                {cities.map((city) => (
                    <Anchor
                        key={city.slug}
                        component={Link}
                        to={`/locations/city/${city.slug}`}
                        underline="hover"
                    >
                        {city.name}, {city.stateAbbr}
                    </Anchor>
                ))}
            </SimpleGrid>

            <Stack gap="sm" mt="xl">
                <Title order={2} size="h3">{translate('pages.citiesHub.categoriesCtaHeading')}</Title>
                <Text>
                    {translate('pages.citiesHub.categoriesCtaBody')}{' '}
                    <Anchor component={Link} to={`${lp}/locations/categories`}>
                        {translate('pages.citiesHub.categoriesCtaLink')}
                    </Anchor>.
                </Text>
            </Stack>
        </Container>
    );
};

export default withTranslation(CitiesHub);
