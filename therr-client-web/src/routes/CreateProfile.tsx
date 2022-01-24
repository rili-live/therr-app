import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import translator from '../services/translator';
import CreateProfileForm from '../components/forms/CreateProfileForm';
import UsersActions from '../redux/actions/UsersActions';

interface ICreateProfileRouterProps {
    history: any;
}

interface ICreateProfileDispatchProps {
    updateUser: Function;
}

type IStoreProps = ICreateProfileDispatchProps

// Regular component props
interface ICreateProfileProps extends RouteComponentProps<ICreateProfileRouterProps>, IStoreProps {
    user?: IUserState;
}

interface ICreateProfileState {
    errorMessage: string;
    inputs: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

/**
 * Login
 */
export class CreateProfileComponent extends React.Component<ICreateProfileProps, ICreateProfileState> {
    private translate: Function;

    constructor(props: ICreateProfileProps) {
        super(props);

        this.state = {
            errorMessage: '',
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.createProfile.pageTitle')}`;
    }

    onSubmit = (updateArgs: any) => {
        const { history, user, updateUser } = this.props;

        updateUser(user.details.id, updateArgs).then((response: any) => {
            history.push({
                pathname: '/login',
                state: {
                    successMessage: this.translate('pages.createProfile.createProfileSuccess'),
                },
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({
                    errorMessage: error.message,
                });
            } else {
                this.setState({
                    errorMessage: this.translate('pages.createProfile.createProfileError'),
                });
            }
        });
    }

    public render(): JSX.Element | null {
        const { errorMessage } = this.state;

        return (
            <>
                <div id="page_create_profile" className="flex-box space-evenly center row wrap-reverse">
                    <CreateProfileForm onSubmit={this.onSubmit} title={this.translate('pages.createProfile.pageTitle')} />

                </div>
                {
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateProfileComponent));
