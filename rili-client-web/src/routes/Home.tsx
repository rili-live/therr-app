import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary';
import Input from 'rili-public-library/react-components/Input';
import translator from '../services/translator';
import SocketActions from 'actions/socket';
// import * as globalConfig from '../../../global-config.js';

interface IHomeRouterProps {
}

interface IHomeDispatchProps {
    login: Function;
}

interface IStoreProps extends IHomeDispatchProps {
}

// Regular component props
interface IHomeProps extends RouteComponentProps<IHomeRouterProps>, IStoreProps {
}

interface IHomeState {
    inputs: any;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => {
    return {
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        login: SocketActions.login,
    }, dispatch);
};

/**
 * Home
 */
export class HomeComponent extends React.Component<IHomeProps, IHomeState> {
    private translate: Function;

    constructor(props: IHomeProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | Home';
    }

    isLoginDisabled() {
        return !this.state.inputs.userName || !this.state.inputs.password;
    }

    onButtonClick = (event: any) => {
        switch (event.target.id) {
            case 'password':
            case 'user_name':
            case 'login':
                if (!this.isLoginDisabled()) {
                    this.props.login({
                        userName: this.state.inputs.userName,
                    });
                    this.props.history.push('/join-room');
                }
        }
    }

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges
            }
        });
    }

    public render(): JSX.Element | null {
        return (
            <div className="flex-box">
                <div className="login-container">
                    <h1 className="text-center">Home</h1>
                    <p>Welcome to Rili, where everything is real-time, or at least really close to it.</p>
                    <label htmlFor="user_name">Username:</label>
                    <Input type="text" id="user_name" name="userName" value={this.state.inputs.userName} onChange={this.onInputChange} onEnter={this.onButtonClick} translate={this.translate} />

                    <label htmlFor="passwork">Password:</label>
                    <Input type="password" id="password" name="password" value={this.state.inputs.password} onChange={this.onInputChange} onEnter={this.onButtonClick} translate={this.translate} />

                    <div className="form-field text-right">
                        <ButtonPrimary id="login" text="Login" onClick={this.onButtonClick} disabled={this.isLoginDisabled()} />
                    </div>
                    <p className="text-center">*This is a pseudo-login form. Actual profile creation and login has not yet been configured.</p>
                </div>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));