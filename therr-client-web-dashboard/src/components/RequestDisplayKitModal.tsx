import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, Button, Form, Modal, Row, Col,
} from 'react-bootstrap';
import { MapsService, SpaceDisplayKitType } from 'therr-react/services';
import { ISpace } from '../types';

const DISPLAY_OPTIONS: { value: SpaceDisplayKitType; label: string; description: string }[] = [
    {
        value: 'coaster',
        label: 'Coaster',
        description: 'Double-sided 3.5" coaster. QR on one face, Therr branding on the other.',
    },
    {
        value: 'table_tent',
        label: 'Table Tent',
        description: 'Foldable A6 stand for tabletops. QR + CTA on front, reward explainer on back.',
    },
    {
        value: 'window_cling',
        label: 'Window Cling',
        description: '4" x 4" static cling for storefront windows. Highly visible from street.',
    },
];

interface IRequestDisplayKitModalProps {
    show: boolean;
    onHide: () => void;
    space: ISpace | null;
}

interface IShippingForm {
    shippingName: string;
    shippingAddress: string;
    shippingCity: string;
    shippingRegion: string;
    shippingPostalCode: string;
    shippingCountry: string;
}

const buildInitialShipping = (space: ISpace | null): IShippingForm => ({
    shippingName: '',
    shippingAddress: space?.addressReadable || '',
    shippingCity: '',
    shippingRegion: space?.region || '',
    shippingPostalCode: '',
    shippingCountry: 'US',
});

const RequestDisplayKitModal: React.FC<IRequestDisplayKitModalProps> = ({ show, onHide, space }) => {
    const initialShipping = useMemo(() => buildInitialShipping(space), [space?.id]);
    const [displayType, setDisplayType] = useState<SpaceDisplayKitType>('coaster');
    const [shipping, setShipping] = useState<IShippingForm>(initialShipping);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submittedAt, setSubmittedAt] = useState<number | null>(null);

    useEffect(() => {
        if (show) {
            setDisplayType('coaster');
            setShipping(buildInitialShipping(space));
            setError(null);
            setSubmittedAt(null);
        }
    }, [show, space?.id]);

    const onShippingChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = event.currentTarget;
        setShipping((prev) => ({ ...prev, [name]: value }));
    };

    const isFormValid = !!shipping.shippingName.trim()
        && !!shipping.shippingAddress.trim()
        && !!shipping.shippingCity.trim()
        && !!shipping.shippingRegion.trim()
        && !!shipping.shippingPostalCode.trim();

    const onSubmit = () => {
        if (!space?.id || !isFormValid || isSubmitting) {
            return;
        }
        setIsSubmitting(true);
        setError(null);
        MapsService.requestSpaceDisplayKit({
            spaceId: space.id,
            displayType,
            ...shipping,
        }).then(() => {
            setSubmittedAt(Date.now());
        }).catch((err) => {
            const message = err?.response?.data?.message
                || 'We could not submit your display-kit request. Please try again.';
            setError(message);
        }).finally(() => {
            setIsSubmitting(false);
        });
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title className="h5">Request a Physical Display Kit</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {submittedAt ? (
                    <Alert variant="success">
                        Your display-kit request was received. We&apos;ll email you once it ships.
                    </Alert>
                ) : (
                    <>
                        <p className="text-muted mb-3">
                            Place a branded QR display at <strong>{space?.notificationMsg || 'your space'}</strong>.
                            Customers scan to check in, earn rewards, and amplify your business on Therr.
                        </p>

                        {error && <Alert variant="danger">{error}</Alert>}

                        <h6 className="mb-2">Choose a display type</h6>
                        <Row className="mb-4">
                            {DISPLAY_OPTIONS.map((opt) => (
                                <Col md={4} key={opt.value} className="mb-2">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setDisplayType(opt.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') setDisplayType(opt.value);
                                        }}
                                        className={`p-3 border rounded h-100 ${displayType === opt.value ? 'border-primary bg-light' : ''}`}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Form.Check
                                            type="radio"
                                            id={`display-type-${opt.value}`}
                                            name="displayType"
                                            label={<strong>{opt.label}</strong>}
                                            checked={displayType === opt.value}
                                            onChange={() => setDisplayType(opt.value)}
                                        />
                                        <small className="text-muted d-block mt-1">{opt.description}</small>
                                    </div>
                                </Col>
                            ))}
                        </Row>

                        <h6 className="mb-2">Shipping address</h6>
                        <Form>
                            <Row>
                                <Col md={12} className="mb-2">
                                    <Form.Group>
                                        <Form.Label>Recipient name</Form.Label>
                                        <Form.Control
                                            name="shippingName"
                                            value={shipping.shippingName}
                                            onChange={onShippingChange}
                                            placeholder="Business owner / manager name"
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={12} className="mb-2">
                                    <Form.Group>
                                        <Form.Label>Street address</Form.Label>
                                        <Form.Control
                                            name="shippingAddress"
                                            value={shipping.shippingAddress}
                                            onChange={onShippingChange}
                                            placeholder="123 Main St"
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={5} className="mb-2">
                                    <Form.Group>
                                        <Form.Label>City</Form.Label>
                                        <Form.Control
                                            name="shippingCity"
                                            value={shipping.shippingCity}
                                            onChange={onShippingChange}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={3} className="mb-2">
                                    <Form.Group>
                                        <Form.Label>Region</Form.Label>
                                        <Form.Control
                                            name="shippingRegion"
                                            value={shipping.shippingRegion}
                                            onChange={onShippingChange}
                                            placeholder="CA"
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={2} className="mb-2">
                                    <Form.Group>
                                        <Form.Label>Postal</Form.Label>
                                        <Form.Control
                                            name="shippingPostalCode"
                                            value={shipping.shippingPostalCode}
                                            onChange={onShippingChange}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={2} className="mb-2">
                                    <Form.Group>
                                        <Form.Label>Country</Form.Label>
                                        <Form.Control
                                            name="shippingCountry"
                                            value={shipping.shippingCountry}
                                            onChange={onShippingChange}
                                            placeholder="US"
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Form>
                    </>
                )}
            </Modal.Body>
            <Modal.Footer>
                {submittedAt ? (
                    <Button variant="primary" onClick={onHide}>Done</Button>
                ) : (
                    <>
                        <Button variant="link" onClick={onHide} disabled={isSubmitting}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={onSubmit}
                            disabled={!isFormValid || isSubmitting || !space?.id}
                        >
                            {isSubmitting ? 'Submitting...' : 'Request Kit'}
                        </Button>
                    </>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default RequestDisplayKitModal;
