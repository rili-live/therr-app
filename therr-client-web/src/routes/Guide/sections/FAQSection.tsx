import * as React from 'react';
import {
    Accordion, Stack, Text, Title,
} from '@mantine/core';

interface IProps {
    items: { question: string; answer: string }[];
    heading?: string;
}

const FAQSection: React.FC<IProps> = ({ items, heading }) => (
    <Stack gap="sm">
        {heading && <Title order={2} size="h3">{heading}</Title>}
        <Accordion variant="separated">
            {items.map((item, i) => (
                <Accordion.Item key={i} value={String(i)}>
                    <Accordion.Control>{item.question}</Accordion.Control>
                    <Accordion.Panel><Text>{item.answer}</Text></Accordion.Panel>
                </Accordion.Item>
            ))}
        </Accordion>
    </Stack>
);

export default FAQSection;
