import React from 'react';
import { Link } from 'react-router-dom';
import {
    faAngleDown, faAngleUp, faEdit, faEllipsisH, faEye, faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    Button, ButtonGroup, Card, Dropdown, Image, Table,
} from 'react-bootstrap';
import { ISpace } from '../../types';
import * as globalConfig from '../../../../global-config';

const USAFlag = '/assets/img/flags/united-states-of-america.svg';
const CanadaFlag = '/assets/img/flags/canada.svg';
const IndiaFlag = '/assets/img/flags/india.svg';
const MexicoFlag = '/assets/img/flags/mexico.svg';
const GermanyFlag = '/assets/img/flags/germany.svg';
const FranceFlag = '/assets/img/flags/france.svg';
const JapanFlag = '/assets/img/flags/japan.svg';
const ItalyFlag = '/assets/img/flags/italy.svg';

const countryImageMap = {
    USA: USAFlag,
    CAN: CanadaFlag,
    IND: IndiaFlag,
    MEX: MexicoFlag,
    FRA: FranceFlag,
    JPN: JapanFlag,
    DEU: GermanyFlag,
    ITA: ItalyFlag,
};

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

interface ISpacesListTableProps {
    spacesInView: ISpace[];
    editContext: string;
    isLoading: boolean;
    previousQueryStringParams?: {
        [key: string]: string;
    };
    translate: any;
}

const SpacesListTable = ({
    spacesInView,
    editContext,
    isLoading,
    previousQueryStringParams,
    translate,
}: ISpacesListTableProps) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    const TableRow = (props: {
        space: ISpace;
    }) => {
        const {
            space,
        } = props;
        const {
            id,
            addressReadable,
            notificationMsg,
            mediaIds,
            medias,
            message,
            category,
            region,
            createdAt,
            updatedAt,
        } = space;
        const countryImage = countryImageMap[region];
        let editSpacePath = editContext === 'admin' ? `/spaces/${id}/edit/${editContext}` : `/spaces/${id}/edit`;
        if (previousQueryStringParams) {
            const mockUrl = new URL(`https://www.example.com${editSpacePath}`);
            Object.keys(previousQueryStringParams).forEach((key) => {
                if (previousQueryStringParams[key]) {
                    mockUrl.searchParams.append(key, previousQueryStringParams[key]);
                }
            });
            editSpacePath = mockUrl.href.replace('https://www.example.com', '');
        }

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
                            <Dropdown.Item as={Link} to={editSpacePath} state={{ space }}>
                                <FontAwesomeIcon icon={faEdit} className="me-2" /> Edit
                            </Dropdown.Item>
                            {/* <Dropdown.Item className="text-danger">
                                <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Delete?
                            </Dropdown.Item> */}
                        </Dropdown.Menu>
                    </Dropdown>
                </td>
                <td className="fw-bold">
                    <Link to={editSpacePath} state={{ space }}>{notificationMsg || '-'}</Link>
                </td>
                <td className="fw-bold">
                    {!!medias?.length && '✓'}
                </td>
                <td className="fw-bold">
                    {category ? translate(category) : '-'}
                </td>
                <td className="fw-bold">
                    <Card.Link href={`${globalConfig[process.env.NODE_ENV].hostFull}/spaces/${id}`} target="_blank">{addressReadable || '-'}</Card.Link>
                </td>
                {/* <td className="border-0">
                    <ValueChange value={overallRankChange} />
                </td> */}
                <td className="fw-bold">
                    {updatedAt || '-'}
                </td>
                <td className="">
                    <Card.Link href="#" className="d-flex align-items-center">
                        {
                            countryImage && <Image src={countryImage} className="image-small rounded-circle me-2" />
                        }
                        <div><span className="h6">{region}</span></div>
                    </Card.Link>
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
                            <th className="border-0">Has Media?</th>
                            <th className="border-0">Category</th>
                            <th className="border-0">Address</th>
                            <th className="border-0">Last Updated</th>
                            <th className="border-0">Country/Region</th>
                        </tr>
                    </thead>
                    <tbody>
                        {spacesInView.map((space) => <TableRow key={`space-${space.id}`} space={space} />)}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
};

export default SpacesListTable;
