import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import translator from '../services/translator';
import SocketActions from 'actions/socket';
import RegisterForm from '../components/RegisterForm';

interface IRegisterRouterProps {
}

interface IRegisterDispatchProps {
    register: Function;
}

interface IStoreProps extends IRegisterDispatchProps {
}

// Regular component props
interface IRegisterProps extends RouteComponentProps<IRegisterRouterProps>, IStoreProps {
}

interface IRegisterState {
    inputs: any;
}

const mapStateToProps = (state: any) => {
    return {
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        register: SocketActions.register,
    }, dispatch);
};

/**
 * Login
 */
export class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate: Function;

    constructor(props: IRegisterProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | Register';
    }

    register = (credentials: any) => {
        this.props.register(credentials).then(() => {
            this.props.history.push('/login');
        }).catch((error: any) => {
            // console.log('REGISTRATION_ERROR: ', error);
        });
    }

    public render(): JSX.Element | null {
        return (
            <div className="flex-box">
                <RegisterForm register={this.register} />
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(RegisterComponent));