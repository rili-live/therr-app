import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Badge,
    Card,
    Container,
    Flex,
    Group as MantineGroup,
    Stack,
    Text,
    Title,
} from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import { ForumActions } from 'therr-react/redux/actions';
import { IForumsState, IUserState } from 'therr-react/types';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import formatHashtags from '../utilities/formatHashtags';

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
    translate: (key: string, params?: any) => string;
}

interface ICreateForumState {
    categories: any[];
    hasJoinedAForum: boolean;
    hashtags: string[];
    inputs: any;
    isSubmitting: boolean;
    forumsList: any;
}

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createHostedChat: ForumActions.createForum,
    searchCategories: ForumActions.searchCategories,
}, dispatch);

/**
 * CreateForum
 */
export class CreateForumComponent extends React.Component<ICreateForumProps, ICreateForumState> {
    static getDerivedStateFromProps(nextProps: ICreateForumProps, nextState: ICreateForumState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums?.forumCategories?.map((c) => ({ ...c, isActive: false })) || [],
            };
        }

        return null;
    }

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
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const {
            forums,
            searchCategories,
        } = this.props;
        document.title = `Therr | ${this.props.translate('pages.createForum.pageTitle')}`;

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

    handleCategoryToggle = (tag: string) => {
        const { categories } = this.state;
        const updated = categories.map((c) => (c.tag === tag ? { ...c, isActive: !c.isActive } : c));
        this.setState({ categories: updated });
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
            city,
            region,
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
            city: city || undefined,
            region: region || undefined,
            categoryTags: categories.filter((c) => c.isActive).map((c) => c.tag),
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
            this.props
                .createHostedChat(createArgs)
                .then((response) => {
                    this.props.navigation.navigate(`/groups/${response.forum.id}`, {
                        state: {
                            roomName: response.forum.title,
                        },
                    });
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400
                            || error.statusCode === 401
                            || error.statusCode === 404
                    ) {
                        console.log('40x', error); // eslint-disable-line no-console
                    } else if (error.statusCode >= 500) {
                        console.log('500', error); // eslint-disable-line no-console
                    }
                })
                .finally(() => {
                    this.setState({ isSubmitting: false });
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
        const { categories, hashtags } = this.state;
        const tagsString = hashtags.map((t) => `#${t}`).join(' ');

        return (
            <div id="page_join_forum">
                <Container size="sm">
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stack gap="sm">
                            <Title order={1} size="h2">{this.props.translate('pages.createForum.pageTitle')}</Title>
                            <MantineInput
                                type="text"
                                id="forum_title"
                                name="title"
                                value={this.state.inputs.title}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                placeholder={this.props.translate('pages.createForum.placeholders.title')}
                                label={this.props.translate('pages.createForum.labels.title')}
                            />
                            <MantineInput
                                type="text"
                                id="forum_subtitle"
                                name="subtitle"
                                value={this.state.inputs.subtitle}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                placeholder={this.props.translate('pages.createForum.placeholders.subtitle')}
                                label={this.props.translate('pages.createForum.labels.subtitle')}
                            />
                            <MantineInput
                                type="text"
                                id="forum_description"
                                name="description"
                                value={this.state.inputs.description}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                placeholder={this.props.translate('pages.createForum.placeholders.description')}
                                label={this.props.translate('pages.createForum.labels.description')}
                            />
                            <Flex gap="sm" direction={{ base: 'column', sm: 'row' }}>
                                <MantineInput
                                    type="text"
                                    id="forum_city"
                                    name="city"
                                    value={this.state.inputs.city}
                                    onChange={this.onInputChange}
                                    onEnter={this.onSubmit}
                                    translateFn={this.props.translate}
                                    placeholder={this.props.translate('pages.createForum.placeholders.city')}
                                    label={this.props.translate('pages.createForum.labels.city')}
                                />
                                <MantineInput
                                    type="text"
                                    id="forum_region"
                                    name="region"
                                    value={this.state.inputs.region}
                                    onChange={this.onInputChange}
                                    onEnter={this.onSubmit}
                                    translateFn={this.props.translate}
                                    placeholder={this.props.translate('pages.createForum.placeholders.region')}
                                    label={this.props.translate('pages.createForum.labels.region')}
                                />
                            </Flex>
                            <MantineInput
                                type="text"
                                id="forum_hashtags"
                                name="hashTags"
                                value={this.state.inputs.hashTags}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                placeholder={this.props.translate('pages.createForum.placeholders.hashTags')}
                                label={this.props.translate('pages.createForum.labels.hashTags')}
                            />
                            {tagsString && <Text size="sm" c="dimmed">{tagsString}</Text>}

                            {/* Category Selection */}
                            {categories.length > 0 && (
                                <div>
                                    <Text fw={500} size="sm" mb={4}>{this.props.translate('pages.createForum.labels.categories')}</Text>
                                    <MantineGroup gap={6}>
                                        {categories.map((cat) => (
                                            <Badge
                                                key={cat.tag}
                                                variant={cat.isActive ? 'filled' : 'outline'}
                                                size="md"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => this.handleCategoryToggle(cat.tag)}
                                            >
                                                {cat.tag}
                                            </Badge>
                                        ))}
                                    </MantineGroup>
                                </div>
                            )}

                            <div className="form-field text-right">
                                <MantineButton
                                    id="join_forum"
                                    text={this.props.translate('pages.createForum.buttons.submit')}
                                    onClick={this.onSubmit}
                                    disabled={this.isFormDisabled()}
                                    fullWidth
                                />
                            </div>
                        </Stack>
                    </Card>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(CreateForumComponent)));
