import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import SocketActions from 'actions/socket';
import translator from '../services/translator';
import RegisterForm from '../components/RegisterForm';

interface IRegisterRouterProps {
    history: any;
}

interface IRegisterDispatchProps {
    register: Function;
}

type IStoreProps = IRegisterDispatchProps

// Regular component props
interface IRegisterProps extends RouteComponentProps<IRegisterRouterProps>, IStoreProps {
}

interface IRegisterState {
    errorMessage: string;
    inputs: any;
}

const mapStateToProps = (state: any) => ({
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    register: SocketActions.register,
}, dispatch);

/**
 * Login
 */
export class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate: Function;

    constructor(props: IRegisterProps) {
        super(props);

        this.state = {
            errorMessage: '',
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | Register';
    }

    register = (credentials: any) => {
        this.props.register(credentials).then((response: any) => {
            this.props.history.push({
                pathname: '/login',
                state: {
                    successMessage: 'Registration success! Login to continue.',
                },
            });
        }).catch((error: any) => {
            if (error.id === 'userExists') {
                this.setState({
                    errorMessage: error.message,
                });
            } else {
                this.setState({
                    errorMessage: 'Oops, something went wrong',
                });
            }
        });
    }

    public render(): JSX.Element | null {
        const { errorMessage } = this.state;

        return (
            <>
                <div className="flex-box">
                    <RegisterForm register={this.register} />

                </div>
                {
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(RegisterComponent));
