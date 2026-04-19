import * as React from 'react';
import { Table, Text } from '@mantine/core';

interface IProps {
    caption: string;
    headers: string[];
    rows: (string | number)[][];
}

const DataTableSection: React.FC<IProps> = ({ caption, headers, rows }) => (
    <Table withTableBorder striped>
        <Table.Caption><Text size="sm" c="dimmed">{caption}</Text></Table.Caption>
        <Table.Thead>
            <Table.Tr>
                {headers.map((h) => <Table.Th key={h}>{h}</Table.Th>)}
            </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
            {rows.map((row, ri) => (
                <Table.Tr key={ri}>
                    {row.map((cell, ci) => <Table.Td key={ci}>{cell}</Table.Td>)}
                </Table.Tr>
            ))}
        </Table.Tbody>
    </Table>
);

export default DataTableSection;
