import React from 'react';
import { connect } from 'react-redux';
import { Link, NavigateFunction } from 'react-router-dom';
import {
    Alert,
    Button,
    Card,
    Col,
    Form,
    InputGroup,
    Row,
    Spinner,
    Table,
} from 'react-bootstrap';
import { IUserState } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faKey, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import ApiKeysService, { IApiKey } from '../../services/ApiKeysService';
import { getWebsiteName } from '../../utilities/getHostContext';

const API_DOCS_URL = 'https://api.therr.com/v1/docs';

// Mirrors MAX_KEYS_PER_USER in users-service/handlers/apiKeys.ts. Enforced server-side;
// duplicated here only so the button can be disabled before the user hits a 400.
const MAX_KEYS_PER_USER = 5;

// Mirrors API_KEY_ELIGIBLE_LEVELS in users-service/handlers/apiKeys.ts.
const API_KEY_ELIGIBLE_LEVELS: string[] = [
    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
    AccessLevels.SUPER_ADMIN,
    AccessLevels.API_ACCESS,
];

interface IApiKeysRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IStoreProps {
    user: IUserState;
}

interface IApiKeysProps extends IApiKeysRouterProps, IStoreProps {
}

interface IApiKeysState {
    apiKeys: IApiKey[];
    isLoading: boolean;
    isCreating: boolean;
    revokingKeyId: string;
    newKeyName: string;
    // The raw key from the most recent create call. Held in component state only —
    // the server hashes it and can never return it again.
    createdKey: string;
    didCopy: boolean;
    errorMessage: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

export class ApiKeysComponent extends React.Component<IApiKeysProps, IApiKeysState> {
    private translate: Function;

    constructor(props: IApiKeysProps) {
        super(props);

        this.state = {
            apiKeys: [],
            isLoading: true,
            isCreating: false,
            revokingKeyId: '',
            newKeyName: '',
            createdKey: '',
            didCopy: false,
            errorMessage: '',
        };

        this.translate = (key: string, params?: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.apiKeys.pageTitle')}`;
        this.fetchApiKeys();
    }

    get isEligible(): boolean {
        const accessLevels: string[] = this.props.user?.details?.accessLevels || [];
        return API_KEY_ELIGIBLE_LEVELS.some((level) => accessLevels.includes(level));
    }

    fetchApiKeys = () => {
        // An ineligible user gets a 403 from create, but list is harmless — still, skip
        // the call so the upgrade prompt renders immediately instead of after a spinner.
        if (!this.isEligible) {
            this.setState({ isLoading: false });
            return;
        }

        ApiKeysService.list()
            .then((response) => {
                this.setState({
                    apiKeys: response.data || [],
                    isLoading: false,
                });
            })
            .catch(() => {
                this.setState({
                    errorMessage: this.translate('pages.apiKeys.errors.loadFailed'),
                    isLoading: false,
                });
            });
    };

    onCreateKey = (event: React.FormEvent) => {
        event.preventDefault();
        const { newKeyName } = this.state;

        this.setState({ isCreating: true, errorMessage: '', createdKey: '' });

        ApiKeysService.create({ name: newKeyName.trim() || undefined })
            .then((response) => {
                const created: IApiKey = response.data;
                this.setState((prevState) => ({
                    // Strip the raw key before it lands in the list — the table is rendered
                    // from this array and the secret should live in exactly one place.
                    apiKeys: [{ ...created, key: undefined }, ...prevState.apiKeys],
                    createdKey: created.key || '',
                    newKeyName: '',
                    isCreating: false,
                    didCopy: false,
                }));
            })
            .catch((error) => {
                this.setState({
                    errorMessage: error?.response?.data?.message
                        || this.translate('pages.apiKeys.errors.createFailed'),
                    isCreating: false,
                });
            });
    };

    onRevokeKey = (apiKey: IApiKey) => {
        // eslint-disable-next-line no-alert
        const isConfirmed = window.confirm(this.translate('pages.apiKeys.confirmRevoke', {
            keyName: apiKey.name || apiKey.keyPrefix,
        }));
        if (!isConfirmed) {
            return;
        }

        this.setState({ revokingKeyId: apiKey.id, errorMessage: '' });

        ApiKeysService.revoke(apiKey.id)
            .then(() => {
                this.setState((prevState) => ({
                    apiKeys: prevState.apiKeys.filter((k) => k.id !== apiKey.id),
                    revokingKeyId: '',
                }));
            })
            .catch(() => {
                this.setState({
                    errorMessage: this.translate('pages.apiKeys.errors.revokeFailed'),
                    revokingKeyId: '',
                });
            });
    };

    onCopyKey = () => {
        const { createdKey } = this.state;
        if (!navigator?.clipboard) {
            return;
        }
        navigator.clipboard.writeText(createdKey)
            .then(() => this.setState({ didCopy: true }))
            .catch(() => this.setState({ didCopy: false }));
    };

    onDismissCreatedKey = () => this.setState({ createdKey: '', didCopy: false });

    renderUpgradePrompt = () => (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body className="text-center">
                <FontAwesomeIcon icon={faKey} size="2x" className="mb-3" />
                <h4>{this.translate('pages.apiKeys.upgradeTitle')}</h4>
                <p>{this.translate('pages.apiKeys.upgradeDescription')}</p>
                <Button variant="primary" as={Link as any} to="/settings">
                    {this.translate('pages.apiKeys.upgradeButton')}
                </Button>
            </Card.Body>
        </Card>
    );

    renderCreatedKey = () => {
        const { createdKey, didCopy } = this.state;

        return (
            <Alert variant="warning" onClose={this.onDismissCreatedKey} dismissible>
                <Alert.Heading>{this.translate('pages.apiKeys.createdTitle')}</Alert.Heading>
                <p>{this.translate('pages.apiKeys.createdWarning')}</p>
                <InputGroup>
                    <Form.Control
                        readOnly
                        value={createdKey}
                        onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
                        aria-label={this.translate('pages.apiKeys.createdTitle')}
                    />
                    <Button variant="outline-dark" onClick={this.onCopyKey}>
                        <FontAwesomeIcon icon={faCopy} className="me-1" />
                        {didCopy
                            ? this.translate('pages.apiKeys.copied')
                            : this.translate('pages.apiKeys.copy')}
                    </Button>
                </InputGroup>
            </Alert>
        );
    };

    renderKeysTable = () => {
        const { apiKeys, revokingKeyId } = this.state;

        if (!apiKeys.length) {
            return <p className="text-center py-4">{this.translate('pages.apiKeys.emptyState')}</p>;
        }

        return (
            <Table responsive className="table-centered table-nowrap rounded mb-0">
                <thead className="thead-light">
                    <tr>
                        <th className="border-0">{this.translate('pages.apiKeys.table.name')}</th>
                        <th className="border-0">{this.translate('pages.apiKeys.table.prefix')}</th>
                        <th className="border-0">{this.translate('pages.apiKeys.table.created')}</th>
                        <th className="border-0">{this.translate('pages.apiKeys.table.lastUsed')}</th>
                        <th className="border-0">{this.translate('pages.apiKeys.table.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {apiKeys.map((apiKey) => (
                        <tr key={apiKey.id}>
                            <td>{apiKey.name || <em>{this.translate('pages.apiKeys.unnamed')}</em>}</td>
                            <td><code>{apiKey.keyPrefix}</code></td>
                            <td>{apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : '—'}</td>
                            <td>
                                {apiKey.lastAccessed
                                    ? new Date(apiKey.lastAccessed).toLocaleDateString()
                                    : this.translate('pages.apiKeys.neverUsed')}
                            </td>
                            <td>
                                <Button
                                    variant="outline-danger"
                                    size="sm"
                                    disabled={revokingKeyId === apiKey.id}
                                    onClick={() => this.onRevokeKey(apiKey)}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
                                    {this.translate('pages.apiKeys.revoke')}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        );
    };

    public render(): JSX.Element | null {
        const {
            apiKeys,
            createdKey,
            errorMessage,
            isCreating,
            isLoading,
            newKeyName,
        } = this.state;
        const isAtKeyLimit = apiKeys.length >= MAX_KEYS_PER_USER;

        return (
            <div id="page_api_keys" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <div className="d-block mb-4 mb-md-0">
                        <h1 className="h4">{this.translate('pages.apiKeys.pageTitle')}</h1>
                        <p className="mb-0">
                            {this.translate('pages.apiKeys.pageDescription')}{' '}
                            <a href={API_DOCS_URL} target="_blank" rel="noreferrer">
                                {this.translate('pages.apiKeys.viewDocs')}
                            </a>
                        </p>
                    </div>
                </div>

                <Row className="justify-content-center">
                    <Col xs={12} xl={10}>
                        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

                        {isLoading && (
                            <div className="text-center py-5">
                                <Spinner animation="border" role="status" />
                            </div>
                        )}

                        {!isLoading && !this.isEligible && this.renderUpgradePrompt()}

                        {!isLoading && this.isEligible && (
                            <>
                                {createdKey && this.renderCreatedKey()}

                                <Card border="light" className="bg-white shadow-sm mb-4">
                                    <Card.Body>
                                        <h5 className="mb-4">{this.translate('pages.apiKeys.createTitle')}</h5>
                                        <Form onSubmit={this.onCreateKey}>
                                            <Row className="align-items-end">
                                                <Col xs={12} md={8} className="mb-3">
                                                    <Form.Group id="apiKeyName">
                                                        <Form.Label>
                                                            {this.translate('pages.apiKeys.nameLabel')}
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="text"
                                                            maxLength={128}
                                                            value={newKeyName}
                                                            placeholder={this.translate('pages.apiKeys.namePlaceholder')}
                                                            onChange={(e) => this.setState({ newKeyName: e.target.value })}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={12} md={4} className="mb-3">
                                                    <Button
                                                        variant="primary"
                                                        type="submit"
                                                        className="w-100"
                                                        disabled={isCreating || isAtKeyLimit}
                                                    >
                                                        <FontAwesomeIcon icon={faKey} className="me-1" />
                                                        {this.translate('pages.apiKeys.createButton')}
                                                    </Button>
                                                </Col>
                                            </Row>
                                            {isAtKeyLimit && (
                                                <p className="mb-0 text-muted">
                                                    {this.translate('pages.apiKeys.atLimit', {
                                                        max: `${MAX_KEYS_PER_USER}`,
                                                    })}
                                                </p>
                                            )}
                                        </Form>
                                    </Card.Body>
                                </Card>

                                <Card border="light" className="shadow-sm mb-4">
                                    <Card.Header>
                                        <h5 className="mb-0">{this.translate('pages.apiKeys.listTitle')}</h5>
                                    </Card.Header>
                                    <Card.Body className="pt-0">
                                        {this.renderKeysTable()}
                                    </Card.Body>
                                </Card>
                            </>
                        )}
                    </Col>
                </Row>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, null)(ApiKeysComponent));
