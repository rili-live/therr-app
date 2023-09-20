import React from 'react';
import { Link } from 'react-router-dom';
import {
    faAngleDown, faAngleUp, faEdit, faEllipsisH, faEye, faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    Button, ButtonGroup, Card, Dropdown, Image, Table,
} from 'react-bootstrap';
import { ICampaign, ISpace } from '../../types';
import * as globalConfig from '../../../../global-config';

const ValueChange = ({ value, suffix }: any) => {
    const valueIcon = value < 0 ? faAngleDown : faAngleUp;
    const valueTxtColor = value < 0 ? 'text-danger' : 'text-success';

    return (
        value ? <span className={valueTxtColor}>
            <FontAwesomeIcon icon={valueIcon} />
            <span className="fw-bold ms-1">
                {Math.abs(value)}{suffix}
            </span>
        </span> : <span>--</span>
    );
};

interface ICampaignsListTableProps {
    campaignsInView: ICampaign[];
    editContext: string;
    isLoading: boolean;
}

const CampaignsListTable = ({ campaignsInView, editContext, isLoading }: ICampaignsListTableProps) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    const TableRow = (props: {
        campaign: ICampaign;
    }) => {
        const {
            campaign,
        } = props;
        const {
            id,
            title,
            description,
            assetIds,
            status,
            type,
            businessSpaceIds,
            targetDailyBudget,
            costBiddingStrategy,
            targetLanguages,
            targetLocations,
            scheduleStartAt,
            scheduleStopAt,
            updatedAt,
        } = campaign;
        const campaignEditPath = editContext === 'admin' ? `/campaigns/${id}/edit/${editContext}` : `/campaigns/${id}/edit`;

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
                            {/* <Dropdown.Item>
                                <FontAwesomeIcon icon={faEye} className="me-2" /> View Details
                            </Dropdown.Item> */}
                            <Dropdown.Item as={Link} to={campaignEditPath} state={{ campaign }}>
                                <FontAwesomeIcon icon={faEdit} className="me-2" /> Edit
                            </Dropdown.Item>
                            {/* <Dropdown.Item className="text-danger">
                                <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Delete?
                            </Dropdown.Item> */}
                        </Dropdown.Menu>
                    </Dropdown>
                </td>
                <td className="fw-bold">
                    <Link to={campaignEditPath} state={{ campaign }}>{title || '-'}</Link>
                </td>
                <td className="fw-bold">
                    {type || '-'}
                </td>
                <td className="fw-bold">
                    {scheduleStartAt.toString() || '-'}
                </td>
                <td className="fw-bold">
                    {scheduleStopAt.toString() || '-'}
                </td>
                <td className="fw-bold">
                    {updatedAt.toString() || '-'}
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
                            <th className="border-0">Name</th>
                            <th className="border-0">Type</th>
                            <th className="border-0">Start Date</th>
                            <th className="border-0">End Date</th>
                            <th className="border-0">Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaignsInView.map((campaign) => <TableRow key={`campaign-${campaign.id}`} campaign={campaign} />)}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
};

export default CampaignsListTable;
