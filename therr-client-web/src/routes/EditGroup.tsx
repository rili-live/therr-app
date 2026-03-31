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

interface IEditGroupRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        groupId: string;
    };
}

interface IEditGroupDispatchProps {
    getForumDetails: Function;
    searchCategories: Function;
    updateForum: Function;
}

interface IStoreProps extends IEditGroupDispatchProps {
    forums: IForumsState;
    user: IUserState;
}

interface IEditGroupProps extends IEditGroupRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IEditGroupState {
    categories: any[];
    hashtags: string[];
    inputs: any;
    isSubmitting: boolean;
    isLoaded: boolean;
}

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getForumDetails: ForumActions.getForumDetails,
    searchCategories: ForumActions.searchCategories,
    updateForum: ForumActions.updateForum,
}, dispatch);

/**
 * EditGroup
 */
export class EditGroupComponent extends React.Component<IEditGroupProps, IEditGroupState> {
    constructor(props: IEditGroupProps) {
        super(props);

        this.state = {
            categories: [],
            hashtags: [],
            inputs: {},
            isSubmitting: false,
            isLoaded: false,
        };
    }

    componentDidMount() {
        const {
            forums,
            getForumDetails,
            searchCategories,
            routeParams,
        } = this.props;
        const { groupId } = routeParams;

        document.title = `Therr | ${this.props.translate('pages.editGroup.pageTitle')}`;

        if (!forums.forumCategories || !forums.forumCategories.length) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            });
        }

        const existingGroup = forums?.forumDetails?.[groupId];
        if (existingGroup) {
            this.populateFromGroup(existingGroup);
        } else {
            getForumDetails(groupId).then((group: any) => {
                if (group) {
                    this.populateFromGroup(group);
                }
            }).catch(() => {
                this.props.navigation.navigate('/groups');
            });
        }
    }

    componentDidUpdate(prevProps: IEditGroupProps) {
        const { forums, routeParams } = this.props;
        const { isLoaded } = this.state;
        const group = forums?.forumDetails?.[routeParams.groupId];
        const prevGroup = prevProps.forums?.forumDetails?.[routeParams.groupId];

        // Populate categories once both group and categories are loaded
        if (!isLoaded && group && forums.forumCategories?.length && !prevProps.forums.forumCategories?.length) {
            this.populateFromGroup(group);
        }

        // Handle case where group loaded after categories
        if (!isLoaded && group && !prevGroup && forums.forumCategories?.length) {
            this.populateFromGroup(group);
        }
    }

    populateFromGroup = (group: any) => {
        const { forums } = this.props;
        const groupCategoryTags = group.categoryTags || [];
        const parsedHashtags = group.hashTags ? group.hashTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

        const categories = (forums.forumCategories || []).map((c: any) => ({
            ...c,
            isActive: groupCategoryTags.includes(c.tag),
        }));

        this.setState({
            categories,
            hashtags: parsedHashtags,
            inputs: {
                title: group.title || '',
                subtitle: group.subtitle || '',
                description: group.description || '',
                city: group.city || '',
                region: group.region || '',
                hashTags: '',
            },
            isLoaded: true,
        });
    };

    isAuthorized = (): boolean => {
        const { forums, routeParams, user } = this.props;
        const group = forums?.forumDetails?.[routeParams.groupId];
        if (!group || !user?.details?.id) return false;

        const userId = String(user.details.id);
        if (String(group.authorId) === userId) return true;

        const adminIds = group.administratorIds
            ? String(group.administratorIds).split(',').map((id: string) => id.trim())
            : [];
        return adminIds.includes(userId);
    };

    onInputChange = (name: string, value: string) => {
        const { hashtags } = this.state;
        let modifiedHashtags = [...hashtags];
        const modifiedValue = value;
        const newInputChanges: any = {
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

    handleHashtagClick = (tag: string) => {
        const { hashtags } = this.state;
        const modifiedHashtags = hashtags.filter((t) => t !== tag);

        this.setState({
            hashtags: modifiedHashtags,
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
        const { routeParams, user } = this.props;
        const { groupId } = routeParams;
        const { categories, hashtags } = this.state;
        const {
            title,
            subtitle,
            description,
            city,
            region,
        } = this.state.inputs;

        const updateArgs: any = {
            administratorIds: user.details.id,
            title,
            subtitle: subtitle || title,
            description,
            city: city || undefined,
            region: region || undefined,
            categoryTags: categories.filter((c) => c.isActive).map((c) => c.tag),
            hashTags: hashtags.join(','),
        };

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            this.props
                .updateForum(groupId, updateArgs)
                .then(() => {
                    this.props.navigation.navigate(`/groups/${groupId}`);
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

    public render(): JSX.Element | null {
        const { isLoaded, categories, hashtags } = this.state;

        if (!isLoaded) {
            return null;
        }

        if (!this.isAuthorized()) {
            return (
                <div id="page_edit_group">
                    <Container size="sm">
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Text ta="center">{this.props.translate('pages.editGroup.notAuthorized')}</Text>
                        </Card>
                    </Container>
                </div>
            );
        }

        const tagsString = hashtags.map((t) => `#${t}`).join(' ');

        return (
            <div id="page_edit_group">
                <Container size="sm">
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stack gap="sm">
                            <Title order={1} size="h2">{this.props.translate('pages.editGroup.pageTitle')}</Title>
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
                                    id="save_forum"
                                    text={this.props.translate('pages.editGroup.buttons.submit')}
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

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(EditGroupComponent)));
