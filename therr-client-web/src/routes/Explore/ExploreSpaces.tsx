import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Anchor,
    Breadcrumbs,
    Container,
    Stack,
    Text,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';

const ExploreSpaces: React.FC = () => {
    const { t: translate } = useTranslation();
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/locations', { replace: true });
    }, [navigate]);

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">{translate('pages.navigation.home')}</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">{translate('pages.navigation.explore')}</Anchor>,
        <Text size="sm" key="spaces">{translate('pages.navigation.spaces')}</Text>,
    ];

    return (
        <Container size="lg" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>
                <Text c="dimmed">{translate('pages.navigation.redirectingToSpaces')}</Text>
            </Stack>
        </Container>
    );
};

export default ExploreSpaces;
