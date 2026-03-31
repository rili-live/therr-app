import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Col,
    Row,
    Toast,
    ToastContainer,
} from 'react-bootstrap';
import { ApiKeyActions } from 'therr-react/redux/actions';
import { IApiKeysState, IUserState } from 'therr-react/types';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import ManageApiKeysForm from '../components/forms/ManageApiKeysForm';
import { getWebsiteName } from '../utilities/getHostContext';

interface IApiKeysRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IApiKeysDispatchProps {
    getApiKeys: Function;
    createApiKey: Function;
    revokeApiKey: Function;
}

interface IStoreProps extends IApiKeysDispatchProps {
    apiKeys: IApiKeysState;
    user: IUserState;
}

interface IApiKeysProps extends IApiKeysRouterProps, IStoreProps {}

interface IApiKeysPageState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
}

const mapStateToProps = (state: any) => ({
    apiKeys: state.apiKeys,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getApiKeys: ApiKeyActions.list,
    createApiKey: ApiKeyActions.create,
    revokeApiKey: ApiKeyActions.revoke,
}, dispatch);

class ApiKeysComponent extends React.Component<IApiKeysProps, IApiKeysPageState> {
    private translate: Function;

    constructor(props: IApiKeysProps) {
        super(props);

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | API Keys`;
        this.props.getApiKeys();
    }

    onCreateKey = (data: { name?: string }) => this.props.createApiKey(data)
        .then((result: any) => {
            this.setState({
                alertTitle: 'Success',
                alertMessage: 'API key created successfully',
                alertVariation: 'success',
            });
            this.toggleAlert(true);
            return result;
        })
        .catch((error: any) => {
            this.setState({
                alertTitle: 'Error',
                alertMessage: error?.response?.data?.message || 'Failed to create API key',
                alertVariation: 'danger',
            });
            this.toggleAlert(true);
            throw error;
        });

    onRevokeKey = (id: string) => this.props.revokeApiKey(id)
        .then((result: any) => {
            this.setState({
                alertTitle: 'Success',
                alertMessage: 'API key revoked successfully',
                alertVariation: 'success',
            });
            this.toggleAlert(true);
            return result;
        })
        .catch((error: any) => {
            this.setState({
                alertTitle: 'Error',
                alertMessage: error?.response?.data?.message || 'Failed to revoke API key',
                alertVariation: 'danger',
            });
            this.toggleAlert(true);
            throw error;
        });

    toggleAlert = (show?: boolean) => {
        this.setState({
            alertIsVisible: show !== undefined ? show : !this.state.alertIsVisible,
        });
    };

    public render(): JSX.Element | null {
        const { apiKeys } = this.props;
        const {
            alertIsVisible,
            alertVariation,
            alertTitle,
            alertMessage,
        } = this.state;

        return (
            <div id="page_api_keys" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                </div>

                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col xs={12} xl={10} xxl={8}>
                        <ManageApiKeysForm
                            apiKeys={apiKeys?.apiKeys || []}
                            onCreateKey={this.onCreateKey}
                            onRevokeKey={this.onRevokeKey}
                        />
                    </Col>
                </Row>
                <ToastContainer className="p-3" position="bottom-end">
                    <Toast bg={alertVariation} show={alertIsVisible} onClose={() => this.toggleAlert(false)}>
                        <Toast.Header>
                            <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                            <strong className="me-auto">{alertTitle}</strong>
                        </Toast.Header>
                        <Toast.Body>{alertMessage}</Toast.Body>
                    </Toast>
                </ToastContainer>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ApiKeysComponent));
