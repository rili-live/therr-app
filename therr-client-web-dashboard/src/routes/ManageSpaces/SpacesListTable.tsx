import React from 'react';
import { faAngleDown, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Card, Image, Table } from 'react-bootstrap';
import { ISpace } from '../../types';

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
}

const SpacesListTable = ({ spacesInView }: ISpacesListTableProps) => {
    const TableRow = (props: ISpace) => {
        const {
            notificationMsg,
            isPublic,
            message,
            category,
            region,
            createdAt,
            updatedAt,
        } = props;
        const countryImage = countryImageMap[region];

        return (
            <tr>
                <td className="fw-bold border-0">
                    {notificationMsg || '-'}
                </td>
                {/* <td className="border-0">
                    <ValueChange value={overallRankChange} />
                </td> */}
                <td className="fw-bold border-0">
                    {category || '-'}
                </td>
                <td className="fw-bold border-0">
                    {isPublic && '✓'}
                </td>
                <td className="fw-bold border-0">
                    {createdAt || '-'}
                </td>
                <td className="fw-bold border-0">
                    {updatedAt || '-'}
                </td>
                <td className="border-0">
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
                            <th className="border-0">Name</th>
                            <th className="border-0">Category</th>
                            <th className="border-0">Is Public?</th>
                            <th className="border-0">Created Date</th>
                            <th className="border-0">Last Updated</th>
                            <th className="border-0">Country</th>
                        </tr>
                    </thead>
                    <tbody>
                        {spacesInView.map((space) => <TableRow key={`space-${space.id}`} {...space} />)}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
};

export default SpacesListTable;
