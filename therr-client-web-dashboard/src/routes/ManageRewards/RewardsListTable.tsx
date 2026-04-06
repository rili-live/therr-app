import React from 'react';
import { Link } from 'react-router-dom';
import { faEdit, faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    Badge,
    Button,
    ButtonGroup,
    Card,
    Dropdown,
    Table,
} from 'react-bootstrap';
import { ISpace } from '../../types';

interface IRewardsListTableProps {
    spacesInView: ISpace[];
    isLoading: boolean;
}

const RewardsListTable = ({
    spacesInView,
    isLoading,
}: IRewardsListTableProps) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    const rewardTypeLabel = (space: ISpace) => {
        if (!space.featuredIncentiveKey) return '—';
        const labelMap: Record<string, string> = {
            'visit-a-space': 'Check-In',
            'share-a-moment': 'Share a Photo',
            'host-an-event': 'Host an Event',
            'make-a-purchase': 'Make a Purchase',
        };
        return labelMap[space.featuredIncentiveKey] || space.featuredIncentiveKey;
    };

    const TableRow = ({ space }: { space: ISpace }) => {
        const hasReward = !!space.featuredIncentiveKey;
        const configPath = `/rewards/spaces/${space.id}`;

        return (
            <tr>
                <td>
                    <Dropdown as={ButtonGroup}>
                        <Dropdown.Toggle as={Button} split variant="link" className="text-dark m-0 p-0">
                            <span className="icon icon-sm">
                                <FontAwesomeIcon icon={faEllipsisH} className="icon-dark" />
                            </span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item as={Link} to={configPath} state={{ space }}>
                                <FontAwesomeIcon icon={faEdit} className="me-2" /> Configure
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </td>
                <td className="fw-bold">
                    <Link to={configPath} state={{ space }}>{space.notificationMsg || '—'}</Link>
                </td>
                <td>{space.addressReadable || '—'}</td>
                <td>{rewardTypeLabel(space)}</td>
                <td>
                    {hasReward
                        ? <Badge bg="success">Active</Badge>
                        : <Badge bg="secondary">Inactive</Badge>
                    }
                </td>
                <td>
                    <Button
                        as={Link as any}
                        to={configPath}
                        state={{ space }}
                        variant={hasReward ? 'outline-secondary' : 'outline-primary'}
                        size="sm"
                    >
                        {hasReward ? 'Edit Reward' : 'Enable Reward'}
                    </Button>
                </td>
            </tr>
        );
    };

    return (
        <Card border="light" className="shadow-sm">
            <Card.Body className="pb-0">
                <Table responsive className="table-centered table-nowrap rounded mb-0">
                    <thead className="thead-light">
                        <tr>
                            <th className="border-0">Actions</th>
                            <th className="border-0">Space Name</th>
                            <th className="border-0">Address</th>
                            <th className="border-0">Reward Type</th>
                            <th className="border-0">Status</th>
                            <th className="border-0">Configure</th>
                        </tr>
                    </thead>
                    <tbody>
                        {spacesInView.map((space) => <TableRow key={`reward-space-${space.id}`} space={space} />)}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
};

export default RewardsListTable;
