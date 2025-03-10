import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { CAROUSEL_TABS } from '../../constants';
import { ITherrThemeColors } from '../../styles/themes';

interface ICarouselTabsMenuDispatchProps {
}

interface IStoreProps extends ICarouselTabsMenuDispatchProps {
}

// Regular component props
export interface ICarouselTabsMenuProps extends IStoreProps {
    activeTab: string;
    onButtonPress: Function;
    themeAreas: {
        styles: any;
        colors: ITherrThemeColors;
    },
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
    constructor(props) {
        super(props);

        this.state = {};
    }

    getButtonStyles = (name) => {
        const { activeTab, themeAreas } = this.props;

        if (name === activeTab) {
            return {
                backgroundColor: themeAreas.colors.primary5,
            };
        }

        return {};
    };

    render() {
        const { onButtonPress, themeAreas } = this.props;
        const areaCarouselTab = {
            ...themeAreas.styles.areaCarouselTab,
            flex: 1,
            paddingHorizontal: 2,
        };
        const areaCarouselTabButton = {
            backgroundColor: themeAreas.colors.primary3,
            paddingTop: 2,
            paddingBottom: 3,
            borderRadius: 6,
        };

        return (
            <View style={themeAreas.styles.areaCarouselHeader}>
                <Button
                    buttonStyle={[areaCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.SOCIAL)]}
                    containerStyle={areaCarouselTab}
                    titleStyle={themeAreas.styles.areaCarouselTabTitle}
                    title="Social"
                    onPress={() => onButtonPress(CAROUSEL_TABS.SOCIAL)}
                />
                <Button
                    buttonStyle={[areaCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.EVENTS)]}
                    containerStyle={areaCarouselTab}
                    titleStyle={themeAreas.styles.areaCarouselTabTitle}
                    title="Events"
                    onPress={() => onButtonPress(CAROUSEL_TABS.EVENTS)}
                />
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CarouselTabsMenu);
