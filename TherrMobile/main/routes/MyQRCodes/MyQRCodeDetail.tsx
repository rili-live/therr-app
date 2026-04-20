import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View} from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IUserState } from 'therr-react/types';
import { Button } from '../../components/BaseButton';
import { Image } from '../../components/BaseImage';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import {
    buildEntityShareUrl,
    ShareableEntityType,
} from '../../utilities/shareUrls';

export interface IMyQRCodeDetailParams {
    entityType: ShareableEntityType;
    entityId: string;
    title?: string;
    subtitle?: string;
    imageUri?: string;
}

interface IStoreProps {
    user: IUserState;
}

export interface IMyQRCodeDetailProps extends IStoreProps {
    navigation: any;
    route: { params?: IMyQRCodeDetailParams };
}

interface IMyQRCodeDetailState {
    copied: boolean;
    qrSize: number;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

class MyQRCodeDetail extends React.Component<IMyQRCodeDetailProps, IMyQRCodeDetailState> {
    private translate: Function;
    private theme = buildStyles();
    private themeForms = buildFormStyles();
    private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: IMyQRCodeDetailProps) {
        super(props);

        const { width } = Dimensions.get('window');

        this.state = {
            copied: false,
            qrSize: Math.min(width - 80, 320),
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.myQRCodeDetail.headerTitle'),
        });
    }

    componentWillUnmount() {
        if (this.copyResetTimer) {
            clearTimeout(this.copyResetTimer);
            this.copyResetTimer = null;
        }
    }

    getShareUrl = (): string => {
        const { user, route } = this.props;
        const params = route?.params;
        if (!params?.entityId || !params?.entityType) {
            return '';
        }
        const locale = user.settings?.locale || 'en-us';
        return buildEntityShareUrl(params.entityType, locale, params.entityId);
    };

    onShare = () => {
        const shareUrl = this.getShareUrl();
        const { route } = this.props;
        const title = route?.params?.title || '';
        if (!shareUrl) { return; }

        Share.share({
            message: Platform.OS === 'ios' ? undefined : shareUrl,
            url: shareUrl,
            title,
        }).catch(() => {
            /* user dismissed share sheet */
        });
    };

    onCopy = () => {
        const shareUrl = this.getShareUrl();
        if (!shareUrl) { return; }

        Clipboard.setString(shareUrl);
        this.setState({ copied: true });

        if (this.copyResetTimer) {
            clearTimeout(this.copyResetTimer);
        }
        this.copyResetTimer = setTimeout(() => {
            this.setState({ copied: false });
            this.copyResetTimer = null;
        }, 2000);
    };

    renderHeader = () => {
        const { route } = this.props;
        const title = route?.params?.title || '';
        const subtitle = route?.params?.subtitle || '';
        const imageUri = route?.params?.imageUri;

        return (
            <View style={staticStyles.header}>
                {imageUri ? (
                    <Image
                        source={{ uri: imageUri }}
                        style={staticStyles.headerAvatar}
                        height={staticStyles.headerAvatar.height}
                        width={staticStyles.headerAvatar.width}
                        PlaceholderContent={<ActivityIndicator size="small" />}
                    />
                ) : null}
                {!!title && (
                    <Text
                        numberOfLines={2}
                        style={[staticStyles.headerTitle, { color: this.theme.colors.textWhite }]}
                    >
                        {title}
                    </Text>
                )}
                {!!subtitle && (
                    <Text
                        numberOfLines={1}
                        style={[staticStyles.headerSubtitle, { color: this.theme.colors.textGray }]}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
        );
    };

    renderEmptyState = () => (
        <View style={staticStyles.emptyContainer}>
            <MaterialIcon
                name="qr-code-2"
                size={96}
                color={this.theme.colors.textGray}
            />
            <Text
                style={[staticStyles.emptyText, { color: this.theme.colors.textGray }]}
            >
                {this.translate('pages.myQRCodeDetail.missingEntity')}
            </Text>
            <Button
                buttonStyle={this.themeForms.styles.buttonPrimary}
                titleStyle={this.themeForms.styles.buttonTitle}
                title={this.translate('pages.myQRCodeDetail.backButton')}
                onPress={() => this.props.navigation.goBack()}
            />
        </View>
    );

    render() {
        const { user, route } = this.props;
        const { copied, qrSize } = this.state;
        const params = route?.params;
        const shareUrl = this.getShareUrl();
        const isUserEntity = params?.entityType === 'user';
        const isPrivateProfile = isUserEntity
            && user.settings
            && user.settings.settingsIsProfilePublic === false;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        contentContainerStyle={staticStyles.scrollContent}
                    >
                        {shareUrl ? (
                            <>
                                {this.renderHeader()}
                                {/* QR is always dark-on-light regardless of
                                    theme: scanners degrade on inverted or
                                    low-contrast codes. */}
                                <View
                                    accessibilityRole="image"
                                    accessibilityLabel={this.translate(
                                        'pages.myQRCodeDetail.accessibility',
                                        { title: params?.title || '' },
                                    )}
                                    style={staticStyles.qrCard}
                                >
                                    <QRCode
                                        value={shareUrl}
                                        size={qrSize}
                                        color="#000000"
                                        backgroundColor="#ffffff"
                                        ecl="M"
                                    />
                                </View>
                                <Text
                                    style={[
                                        staticStyles.urlText,
                                        { color: this.theme.colors.textGray },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {shareUrl}
                                </Text>
                                <Text
                                    style={[
                                        staticStyles.helperText,
                                        { color: this.theme.colors.textGray },
                                    ]}
                                >
                                    {this.translate('pages.myQRCodeDetail.helperText')}
                                </Text>
                                {isPrivateProfile && (
                                    <Text
                                        style={[
                                            staticStyles.privateNote,
                                            { color: this.theme.colors.textGray },
                                        ]}
                                    >
                                        {this.translate('pages.myQRCodeDetail.privateNote')}
                                    </Text>
                                )}
                                <View style={staticStyles.buttonsBlock}>
                                    <Button
                                        containerStyle={staticStyles.buttonContainer}
                                        buttonStyle={this.themeForms.styles.buttonPrimary}
                                        titleStyle={this.themeForms.styles.buttonTitle}
                                        title={this.translate('forms.myQRCodeDetail.share')}
                                        onPress={this.onShare}
                                        icon={
                                            <MaterialIcon
                                                name="share"
                                                size={20}
                                                color={this.theme.colors.brandingWhite}
                                                style={staticStyles.buttonIcon}
                                            />
                                        }
                                    />
                                    <Button
                                        containerStyle={staticStyles.buttonContainer}
                                        buttonStyle={this.themeForms.styles.buttonPrimary}
                                        titleStyle={this.themeForms.styles.buttonTitle}
                                        title={this.translate(
                                            copied
                                                ? 'pages.myQRCodeDetail.copied'
                                                : 'forms.myQRCodeDetail.copy'
                                        )}
                                        onPress={this.onCopy}
                                        icon={
                                            <MaterialIcon
                                                name={copied ? 'check' : 'content-copy'}
                                                size={20}
                                                color={this.theme.colors.brandingWhite}
                                                style={staticStyles.buttonIcon}
                                            />
                                        }
                                    />
                                </View>
                            </>
                        ) : (
                            this.renderEmptyState()
                        )}
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

const staticStyles = StyleSheet.create({
    scrollContent: {
        padding: 16,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    headerAvatar: {
        height: 72,
        width: 72,
        borderRadius: 36,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    qrCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 16,
        marginVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    urlText: {
        fontSize: 12,
        maxWidth: '92%',
        marginBottom: 6,
    },
    helperText: {
        fontSize: 13,
        textAlign: 'center',
        marginVertical: 8,
        maxWidth: 320,
    },
    privateNote: {
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 4,
        maxWidth: 320,
    },
    buttonsBlock: {
        marginTop: 20,
        width: '100%',
        alignItems: 'stretch',
    },
    buttonContainer: {
        marginBottom: 10,
    },
    buttonIcon: {
        marginRight: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 16,
    },
});

export default connect(mapStateToProps)(MyQRCodeDetail);
