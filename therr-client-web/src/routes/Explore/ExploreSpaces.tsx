import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Anchor,
    Breadcrumbs,
    Container,
    Stack,
    Text,
} from '@mantine/core';

const ExploreSpaces: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/locations', { replace: true });
    }, [navigate]);

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">Home</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">Explore</Anchor>,
        <Text size="sm" key="spaces">Spaces</Text>,
    ];

    return (
        <Container size="lg" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>
                <Text c="dimmed">Redirecting to spaces directory...</Text>
            </Stack>
        </Container>
    );
};

export default ExploreSpaces;
