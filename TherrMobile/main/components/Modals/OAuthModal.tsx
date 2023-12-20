import React, {
    Component,
} from 'react';
import {
    View,
    Modal,
    Pressable,
} from 'react-native';
import qs from 'qs';
import {
    WebView,
} from 'react-native-webview';

const patchPostMessageJsCode = `(${String(function () {
    var originalPostMessage = window.postMessage;
    var patchedPostMessage = function (message, targetOrigin, transfer) {
        originalPostMessage(message, targetOrigin, transfer);
    };
    patchedPostMessage.toString = function () {
        return String(Object.hasOwnProperty).replace('hasOwnProperty', 'postMessage');
    };
    window.postMessage = patchedPostMessage;
})})();`;

interface IOAuthModalProps {
    appId: string;
    provider: 'instagram' | 'facebook-instagram' | 'tiktok';
    requestId: string;
    onRequestClose: () => void;
    onLoginSuccess: (results: any) => any;
    onLoginFailure: (results: any) => any;
    backendRedirectUrl: string;
    frontendRedirectUrl: string;
    responseType: string;
    scopes: any;
    isVisible: boolean;
    language: string;
    incognito: boolean;
    themeModal: {
        styles: any;
    };
}

interface IOAuthModalState {
    key: number;
}

export default class OAuthModal extends Component<IOAuthModalProps, IOAuthModalState> {
    private webView;

    constructor(props) {
        super(props);
        this.state = {
            key: 1,
        };
    }

    onNavigationStateChange = (webViewState) => {
        const { onLoginFailure, onLoginSuccess, frontendRedirectUrl } = this.props;
        const {
            url,
        } = webViewState;
        const {
            key,
        } = this.state;
        if ((webViewState.title === 'Instagram' && webViewState.url === 'https://www.instagram.com/')) {
            this.setState({
                key: key + 1,
            });
        }

        if (url && url.startsWith(frontendRedirectUrl)) {
            this.webView.stopLoading();
            const urlWithNoHash = url.split('#_');
            const cleanUrl = urlWithNoHash[0] || url;
            const queryStringSplit = cleanUrl.split('?');
            if (!queryStringSplit[1]) {
                return onLoginFailure({ error: 'missing-query-params' });
            }
            const results = qs.parse(queryStringSplit[1]);
            if (results.access_token) {
                onLoginSuccess(results);
            } else {
                onLoginFailure(results);
            }
        }
    };

    onWebviewError = (err) => {
        const { onLoginFailure } = this.props;
        console.log('WebViewError', err);
        onLoginFailure(err);
    };

    onMessage(reactMessage) {
        const { onRequestClose } = this.props;

        try {
            const json = JSON.parse(reactMessage.nativeEvent.data);
            if (json && json.error_type) {
                onRequestClose();
                this.props.onLoginFailure(json);
            }
        } catch (err) {
            console.log('onMessage', err);
        }
    }

    // _onLoadEnd () {
    //   const scriptToPostBody = "window.postMessage(document.body.innerText, '*')"
    //     this.webView.injectJavaScript(scriptToPostBody)
    // }

    renderWebview() {
        const {
            appId,
            backendRedirectUrl,
            provider,
            scopes,
            requestId,
            responseType,
            language = 'en',
            incognito = false,
            themeModal,
        } = this.props;
        const {
            key,
        } = this.state;

        // Instagram
        // eslint-disable-next-line max-len
        let authUrl = `https://api.instagram.com/oauth/authorize/?client_id=${appId}&redirect_uri=${backendRedirectUrl}&response_type=${responseType}&scope=${scopes.join(',')}&state=${requestId}`;

        if (provider === 'facebook-instagram') {
            // eslint-disable-next-line max-len
            authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${backendRedirectUrl}&response_type=${responseType}&scope=${scopes.join(',')}&state=${requestId}`;
        }

        return (
            <WebView
                {...this.props}
                key={key}
                incognito={incognito}
                containerStyle={themeModal.styles.webView}
                source={{
                    uri: authUrl,
                    headers: {
                        'Accept-Language': `${language}`,
                    },
                }}
                startInLoadingState
                onNavigationStateChange={this.onNavigationStateChange}
                onError={this.onWebviewError}
                onMessage={this.onMessage}
                ref={(webView) => { this.webView = webView; }}
                injectedJavaScript={patchPostMessageJsCode}
                scrollEnabled
                nestedScrollEnabled
            />
        );
    }

    render() {
        const { onRequestClose, themeModal, isVisible } = this.props;

        return (
            <Modal
                animationType={'fade'}
                visible={isVisible}
                onRequestClose={onRequestClose}
                transparent>
                <Pressable
                    onPress={onRequestClose}
                    style={themeModal.styles.overlay}>
                    <Pressable style={themeModal.styles.container}>
                        <View style={[themeModal.styles.wrapper]}>
                            {this.renderWebview()}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }
}
