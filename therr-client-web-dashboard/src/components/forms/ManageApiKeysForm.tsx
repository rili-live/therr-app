import React, { useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Form,
    InputGroup,
    Modal,
    Table,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faPlus } from '@fortawesome/free-solid-svg-icons';
import { IApiKey } from 'therr-react/types';

const MAX_KEYS = 3;

interface IManageApiKeysFormProps {
    apiKeys: IApiKey[];
    onCreateKey: (data: { name?: string }) => Promise<any>;
    onRevokeKey: (id: string) => Promise<any>;
}

const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ManageApiKeysForm = ({
    apiKeys,
    onCreateKey,
    onRevokeKey,
}: IManageApiKeysFormProps) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreatedModal, setShowCreatedModal] = useState(false);
    const [showRevokeModal, setShowRevokeModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKeyValue, setCreatedKeyValue] = useState('');
    const [keyToRevoke, setKeyToRevoke] = useState<IApiKey | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

    const activeKeyCount = apiKeys.filter((k) => k.isValid).length;

    const handleCreate = () => {
        setIsSubmitting(true);
        onCreateKey({ name: newKeyName || undefined })
            .then((data) => {
                setShowCreateModal(false);
                setNewKeyName('');
                setCreatedKeyValue(data.key);
                setShowCreatedModal(true);
            })
            .catch(() => {
                // Error handled by parent via toast
            })
            .finally(() => setIsSubmitting(false));
    };

    const handleRevoke = () => {
        if (!keyToRevoke) return;
        setIsSubmitting(true);
        onRevokeKey(keyToRevoke.id)
            .then(() => {
                setShowRevokeModal(false);
                setKeyToRevoke(null);
            })
            .catch(() => {
                // Error handled by parent via toast
            })
            .finally(() => setIsSubmitting(false));
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(createdKeyValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openRevokeModal = (key: IApiKey) => {
        setKeyToRevoke(key);
        setShowRevokeModal(true);
    };

    return (
        <>
            <Card border="light" className="bg-white shadow-sm mb-4">
                <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h5 className="mb-1">API Keys</h5>
                            <p className="text-muted mb-0">
                                Manage your API keys for programmatic access to the Therr API.
                            </p>
                        </div>
                        <div className="d-flex align-items-center">
                            <Badge bg="secondary" className="me-3">
                                {activeKeyCount} of {MAX_KEYS} used
                            </Badge>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowCreateModal(true)}
                                disabled={activeKeyCount >= MAX_KEYS}
                            >
                                <FontAwesomeIcon icon={faPlus} className="me-1" />
                                Create Key
                            </Button>
                        </div>
                    </div>

                    {apiKeys.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <p className="mb-0">No API keys yet. Create one to get started.</p>
                        </div>
                    ) : (
                        <Table responsive hover className="align-middle">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Key</th>
                                    <th>Created</th>
                                    <th>Last Used</th>
                                    <th>Status</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {apiKeys.map((apiKey) => (
                                    <tr key={apiKey.id}>
                                        <td>{apiKey.name || <span className="text-muted">Unnamed</span>}</td>
                                        <td>
                                            <code>therr_sk_{apiKey.keyPrefix}...</code>
                                        </td>
                                        <td>{formatDate(apiKey.createdAt)}</td>
                                        <td>{formatDate(apiKey.lastAccessed)}</td>
                                        <td>
                                            {apiKey.isValid ? (
                                                <Badge bg="success">Active</Badge>
                                            ) : (
                                                <Badge bg="secondary">Revoked</Badge>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            {apiKey.isValid && (
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={() => openRevokeModal(apiKey)}
                                                >
                                                    Revoke
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Create Key Modal */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Create API Key</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Key Name (optional)</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g., Production, Test"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            maxLength={128}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowCreateModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleCreate} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Key'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Key Created Modal */}
            <Modal show={showCreatedModal} onHide={() => setShowCreatedModal(false)} centered backdrop="static">
                <Modal.Header>
                    <Modal.Title>API Key Created</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="text-danger fw-bold mb-3">
                        Copy this key now. You won&apos;t be able to see it again.
                    </p>
                    <InputGroup>
                        <Form.Control
                            readOnly
                            value={createdKeyValue}
                            className="font-monospace"
                        />
                        <Button variant="outline-secondary" onClick={handleCopy}>
                            <FontAwesomeIcon icon={faCopy} className="me-1" />
                            {copied ? 'Copied!' : 'Copy'}
                        </Button>
                    </InputGroup>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={() => setShowCreatedModal(false)}>
                        Done
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Revoke Confirmation Modal */}
            <Modal show={showRevokeModal} onHide={() => setShowRevokeModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Revoke API Key</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        Are you sure you want to revoke
                        {' '}<strong>{keyToRevoke?.name || `therr_sk_${keyToRevoke?.keyPrefix}...`}</strong>?
                    </p>
                    <p className="text-muted mb-0">
                        This action cannot be undone. Any applications using this key will lose access.
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowRevokeModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleRevoke} disabled={isSubmitting}>
                        {isSubmitting ? 'Revoking...' : 'Revoke Key'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default ManageApiKeysForm;
