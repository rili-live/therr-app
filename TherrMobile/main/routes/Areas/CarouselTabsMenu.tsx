import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { buildStyles } from '../../styles/user-content/areas';
import { CAROUSEL_TABS } from '../../constants';

interface ICarouselTabsMenuDispatchProps {
}

interface IStoreProps extends ICarouselTabsMenuDispatchProps {
}

// Regular component props
export interface ICarouselTabsMenuProps extends IStoreProps {
    activeTab: string;
    onButtonPress: Function;
    translate: Function;
    user: any;
}

interface ICarouselTabsMenuState {}

export const mapStateToProps = (state: any) => ({
    location: state.location,
    notifications: state.notifications,
});

export const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {},
        dispatch
    );

export class CarouselTabsMenu extends React.Component<ICarouselTabsMenuProps, ICarouselTabsMenuState> {
    private theme = buildStyles();

    constructor(props) {
        super(props);

        this.state = {};

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
    }

    getButtonStyles = (name) => {
        const { activeTab } = this.props;

        if (name === activeTab) {
            return {
                backgroundColor: this.theme.colors.primary3,
            };
        }

        return {};
    }

    render() {
        const { onButtonPress } = this.props;
        const areaCarouselTab = {
            ...this.theme.styles.areaCarouselTab,
            width: '32%',
        };
        const areaCarouselTabButton = {
            backgroundColor: this.theme.colors.accent1,
            paddingTop: 2,
            paddingBottom: 3,
            borderRadius: 6,
        };

        return (
            <View style={this.theme.styles.areaCarouselHeader}>
                <Button
                    buttonStyle={[areaCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.SOCIAL)]}
                    containerStyle={areaCarouselTab}
                    titleStyle={this.theme.styles.areaCarouselTabTitle}
                    title="Social"
                    onPress={() => onButtonPress(CAROUSEL_TABS.SOCIAL)}
                />
                <Button
                    buttonStyle={[areaCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.HIRE)]}
                    containerStyle={areaCarouselTab}
                    titleStyle={this.theme.styles.areaCarouselTabTitle}
                    title="Hire"
                    onPress={() => onButtonPress(CAROUSEL_TABS.HIRE)}
                />
                <Button
                    buttonStyle={[areaCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.EVENTS)]}
                    containerStyle={areaCarouselTab}
                    titleStyle={this.theme.styles.areaCarouselTabTitle}
                    title="Events"
                    onPress={() => onButtonPress(CAROUSEL_TABS.EVENTS)}
                />
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CarouselTabsMenu);
