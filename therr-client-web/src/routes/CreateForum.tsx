import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Input,
    ButtonPrimary,
} from 'therr-react/components';
import { ForumActions } from 'therr-react/redux/actions';
import { IForumsState, IUserState } from 'therr-react/types';
import withNavigation from '../wrappers/withNavigation';
import translator from '../services/translator';
import formatHashtags from '../utilities/formatHashtags';
// import * as globalConfig from '../../../global-config';

interface ICreateForumRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ICreateForumDispatchProps {
    createHostedChat: Function;
    searchCategories: Function;
}

interface IStoreProps extends ICreateForumDispatchProps {
    forums: IForumsState;
    user: IUserState;
}

// Regular component props
interface ICreateForumProps extends ICreateForumRouterProps, IStoreProps {
}

interface ICreateForumState {
    categories: any[];
    hasJoinedAForum: boolean;
    hashtags: string[];
    inputs: any;
    isSubmitting: boolean;
    forumsList: any;
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createHostedChat: ForumActions.createForum,
    searchCategories: ForumActions.searchCategories,
}, dispatch);

// const handleSessionUpdate = (message: any) => {
//     console.log('SESSION_UPDATE:', message); // eslint-disable-line no-console
// };

/**
 * CreateForum
 */
export class CreateForumComponent extends React.Component<ICreateForumProps, ICreateForumState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: ICreateForumProps, nextState: ICreateForumState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums?.forumCategories?.map((c) => ({ ...c, isActive: false })) || [],
            };
        }

        return null;
    }

    // private sessionToken: string;

    constructor(props: ICreateForumProps) {
        super(props);

        this.state = {
            categories: [],
            hasJoinedAForum: false,
            hashtags: [],
            inputs: {
                roomId: 'general-chat',
            },
            forumsList: [],
            isSubmitting: false,
        };

        // this.sessionToken = '';
        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const {
            forums,
            searchCategories,
        } = this.props;
        document.title = `Therr | ${this.translate('pages.createForum.pageTitle')}`;

        if (forums && (!forums.forumCategories || !forums.forumCategories.length)) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            }, {});
        }
    }

    onInputChange = (name: string, value: string) => {
        const { hashtags } = this.state;
        let modifiedHashtags = [...hashtags];
        const modifiedValue = value;
        const newInputChanges = {
            [name]: modifiedValue,
        };

        if (name === 'hashTags') {
            const { formattedValue, formattedHashtags } = formatHashtags(value, modifiedHashtags);

            modifiedHashtags = formattedHashtags;
            newInputChanges[name] = formattedValue;
        }

        this.setState({
            hashtags: modifiedHashtags,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            isSubmitting: false,
        });
    };

    handleHashtagClick = (tag) => {
        const { hashtags } = this.state;
        const modifiedHastags = hashtags.filter((t) => t !== tag);

        this.setState({
            hashtags: modifiedHastags,
        });
    };

    isFormDisabled() {
        const { isSubmitting } = this.state;
        const {
            title,
            description,
        } = this.state.inputs;
        const requiredInputs = {
            title,
            description,
        };

        return isSubmitting || Object.keys(requiredInputs).some((key) => !requiredInputs[key]);
    }

    onSubmit = () => {
        const { user } = this.props;
        const { categories, hashtags } = this.state;
        const {
            administratorIds,
            title,
            subtitle,
            description,
            integrationIds,
            invitees,
            iconGroup,
            iconId,
            iconColor,
            maxCommentsPerMin,
            doesExpire,
            isPublic,
        } = this.state.inputs;

        const createArgs: any = {
            administratorIds: [user.details.id, ...(administratorIds || [])].join(','),
            title,
            subtitle: subtitle || title,
            description,
            categoryTags: categories.filter((c) => c.isActive).map((c) => c.tag) || ['general'],
            hashTags: hashtags.join(','),
            integrationIds: integrationIds ? integrationIds.join(',') : '',
            invitees: invitees ? invitees.join('') : '',
            iconGroup: iconGroup || 'font-awesome-5',
            iconId: iconId || 'star',
            iconColor: iconColor || 'black',
            maxCommentsPerMin,
            doesExpire,
            isPublic,
        };

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            // TODO: Move success/error alert to hosted chat page andd remove settimeout
            this.props
                .createHostedChat(createArgs)
                .then((response) => {
                    this.props.navigation.navigate(`/forums/${response.id}`, {
                        state: {
                            roomName: response.title,
                        },
                    });
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400
                            || error.statusCode === 401
                            || error.statusCode === 404
                    ) {
                        console.log('40x', error);
                    } else if (error.statusCode >= 500) {
                        console.log('500', error);
                    }
                });
        }
    };

    shouldDisableInput = (buttonName: string) => {
        switch (buttonName) {
            case 'forum':
                return !this.state.inputs.roomId;
            default:
                return false;
        }
    };

    public render(): JSX.Element | null {
        const { hashtags } = this.state;
        const { forums } = this.props;
        const tagsString = hashtags.map((t) => `#${t}`).join(' ');

        return (
            <div id="page_join_forum">
                <h1>{this.translate('pages.createForum.pageTitle')}</h1>
                <label htmlFor="forum_title">{this.translate('pages.createForum.labels.title')}:</label>
                <Input
                    type="text"
                    id="forum_title"
                    name="title"
                    value={this.state.inputs.title}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    placeholder={this.translate('pages.createForum.placeholders.title')}
                />
                <label htmlFor="forum_subtitle">{this.translate('pages.createForum.labels.subtitle')}:</label>
                <Input
                    type="text"
                    id="forum_subtitle"
                    name="subtitle"
                    value={this.state.inputs.subtitle}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    placeholder={this.translate('pages.createForum.placeholders.subtitle')}
                />
                <label htmlFor="forum_hashtags">{this.translate('pages.createForum.labels.hashTags')}:</label>
                <Input
                    type="text"
                    id="forum_hashtags"
                    name="hashTags"
                    value={this.state.inputs.hashTags}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    placeholder={this.translate('pages.createForum.placeholders.hashTags')}
                />
                <div>{ tagsString }</div>
                <label htmlFor="forum_description">{this.translate('pages.createForum.labels.description')}:</label>
                <Input
                    type="text"
                    id="forum_description"
                    name="description"
                    value={this.state.inputs.description}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    placeholder={this.translate('pages.createForum.placeholders.description')}
                />
                <div className="form-field text-right">
                    <ButtonPrimary
                        id="join_forum"
                        text={this.translate('pages.createForum.buttons.submit')}
                        onClick={this.onSubmit}
                        disabled={this.shouldDisableInput('forum')}
                    />
                </div>
                {
                    forums && forums.activeForums
                    && <span className="forums-list">
                        {
                            forums.activeForums.length < 1
                                ? <i>{this.translate('pages.createForum.noForumsMessage')}</i>
                                : <span>{this.translate('pages.createForum.labels.activeForums')}: <i>{forums?.activeForums?.length || 0}</i></span>
                        }
                    </span>
                }
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateForumComponent));
