import * as React from 'react';
import { Text } from '@mantine/core';

interface IProps {
    body: string;
}

const ProseSection: React.FC<IProps> = ({ body }) => (
    <>
        {body.split(/\n{2,}/).map((para, i) => (
            <Text key={i} component="p" size="md">{para}</Text>
        ))}
    </>
);

export default ProseSection;
