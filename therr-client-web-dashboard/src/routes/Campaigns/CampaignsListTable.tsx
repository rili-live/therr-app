import React from 'react';
import { Link } from 'react-router-dom';
import moment, { Moment } from 'moment';
import {
    faAngleDown, faAngleUp, faClock, faEdit, faEllipsisH, faEye, faPause, faPlay, faStop, faTimes, faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    Button, ButtonGroup, Card, Dropdown, Image, Table,
} from 'react-bootstrap';
import { CampaignStatuses } from 'therr-js-utilities/constants';
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

const CampaignStatus = ({ status, scheduleStartAt, scheduleStopAt }: any) => {
    const isComplete = Date.now() >= new Date(scheduleStopAt).getTime();
    const isBeforeSchedule = Date.now() < new Date(scheduleStartAt).getTime();
    let statusIcon = faClock;
    let valueTxtColor = 'text-info';
    let generalizedStatus = isComplete && status !== CampaignStatuses.REMOVED ? CampaignStatuses.COMPLETE : status;
    generalizedStatus = isBeforeSchedule && status !== CampaignStatuses.REMOVED ? CampaignStatuses.PENDING : generalizedStatus;
    if (generalizedStatus === CampaignStatuses.PAUSED || generalizedStatus === CampaignStatuses.COMPLETE) {
        statusIcon = generalizedStatus === CampaignStatuses.COMPLETE ? faStop : faPause;
        valueTxtColor = 'text-warning';
    }
    if (generalizedStatus === CampaignStatuses.PENDING) {
        statusIcon = faClock;
        valueTxtColor = 'text-info';
    }
    if (generalizedStatus === CampaignStatuses.ACTIVE) {
        statusIcon = faPlay;
        valueTxtColor = 'text-success';
    }
    if (generalizedStatus === CampaignStatuses.REMOVED) {
        statusIcon = faTimes;
        valueTxtColor = 'text-danger';
    }

    return (
        status ? <span className={valueTxtColor}>
            <FontAwesomeIcon icon={statusIcon} />
            <span className="fw-bold ms-1">
                {generalizedStatus}
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
            adGroupIds,
            status,
            type,
            spaceId,
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
                            <Dropdown.Item as={Link} to={campaignEditPath}>
                                <FontAwesomeIcon icon={faEdit} className="me-2" /> Edit
                            </Dropdown.Item>
                            {/* <Dropdown.Item className="text-danger">
                                <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Delete?
                            </Dropdown.Item> */}
                        </Dropdown.Menu>
                    </Dropdown>
                </td>
                <td className="fw-bold">
                    <Link to={campaignEditPath}>{title || '-'}</Link>
                </td>
                <td className="fw-bold">
                    <CampaignStatus
                        scheduleStartAt={scheduleStartAt}
                        scheduleStopAt={scheduleStopAt}
                        status={status}
                    />
                </td>
                <td className="fw-bold">
                    {type || '-'}
                </td>
                <td className="fw-bold">
                    {scheduleStartAt ? moment(scheduleStartAt).format('MM/DD/YYYY h:mm A') : '-'}
                </td>
                <td className="fw-bold">
                    {scheduleStopAt ? moment(scheduleStopAt).format('MM/DD/YYYY h:mm A') : '-'}
                </td>
                <td className="fw-bold">
                    {updatedAt ? moment(updatedAt).format('MM/DD/YYYY h:mm A') : '-'}
                </td>
            </tr>
        );
    };

    return (
        <Card border="light" className="shadow-sm rounded-0">
            <Card.Body className="pb-0">
                <Table responsive className="table-centered table-nowrap rounded mb-0">
                    <thead className="thead-light">
                        <tr>
                            <th className="border-0">Actions</th>
                            <th className="border-0">Name</th>
                            <th className="border-0">Status</th>
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
