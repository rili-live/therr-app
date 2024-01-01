import React from 'react';
import { Link } from 'react-router-dom';
import moment, { Moment } from 'moment';
import {
    faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import {
    faFacebook, faInstagram, faTiktok, faTwitter, faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    Button, ButtonGroup, Card, Dropdown, Image, Table,
} from 'react-bootstrap';
import { IInfluencerPairing } from '../../../types';
import * as globalConfig from '../../../../../global-config';

const getSocialIcon = (platform: string) => {
    switch (platform) {
        case 'twitter':
            return faTwitter;
        case 'tiktok':
            return faTiktok;
        case 'facebook':
            return faFacebook;
        case 'instagram':
        case 'facebook-instagram':
            return faInstagram;
        case 'youtube':
            return faYoutube;
        default:
            return faQuestion;
    }
};

interface IInfluencersListTableProps {
    influencerPairings: IInfluencerPairing[];
    isLoading: boolean;
}

const InfluencersListTable = ({ influencerPairings, isLoading }: IInfluencersListTableProps) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    const TableRow = (props: {
        influencerPairing: IInfluencerPairing;
    }) => {
        const {
            influencerPairing,
        } = props;
        const {
            id,
            userName,
            socialSyncs,
        } = influencerPairing;
        const userUri = `${globalConfig[process.env.NODE_ENV].hostFull}/users/${id}`;

        return (
            <tr>
                {/* <td>
                    <Dropdown as={ButtonGroup}>
                        <Dropdown.Toggle as={Button} split variant="link" className="text-dark m-0 p-0">
                            <span className="icon icon-sm">
                                <FontAwesomeIcon icon={faEllipsisH} className="icon-dark" />
                            </span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item as={Link} to={campaignEditPath}>
                                <FontAwesomeIcon icon={faEdit} className="me-2" /> Edit
                            </Dropdown.Item>
                            <Dropdown.Item as={Link} to={campaignResultsPath}>
                                <FontAwesomeIcon icon={faChartBar} className="me-2" /> View Results
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </td> */}
                <td className="fw-bold">
                    <a href={userUri} rel="noreferrer" target="_blank">{userName}</a>
                </td>
                <td className="fw-bold text-wrap">
                    <p className="mb-0">
                        {socialSyncs
                            .map((sync, index) => (
                                <React.Fragment key={sync.id}>
                                    <a href={sync.link} rel="noreferrer" target="_blank">
                                        <FontAwesomeIcon
                                            icon={getSocialIcon(sync.platform)}
                                            className="me-2 text-black"
                                        /> {sync.displayName} - {sync.platformUsername}
                                    </a>
                                    {
                                        index < socialSyncs.length - 1
                                        && <span> | </span>
                                    }
                                </React.Fragment>
                            ))}
                    </p>
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
                            {/* <th className="border-0">Actions</th> */}
                            <th className="border-0">Therr Username</th>
                            <th className="border-0">Social Links</th>
                        </tr>
                    </thead>
                    <tbody>
                        {influencerPairings.map((pairing) => <TableRow key={pairing.id} influencerPairing={pairing} />)}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
};

export default InfluencersListTable;
