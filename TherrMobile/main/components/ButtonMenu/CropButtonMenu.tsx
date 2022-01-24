import React from 'react';
import { connect } from 'react-redux';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ButtonMenu, mapStateToProps, mapDispatchToProps } from '.';

class CropButtonMenu extends ButtonMenu {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handleButtonPress = (name: string) => {
        const { onActionButtonPress } = this.props;

        onActionButtonPress && onActionButtonPress(name);
    };

    render() {
        const { translate, themeMenu } = this.props;

        return (
            <ButtonMenu {...this.props}>
                <Button
                    title={translate('menus.crop.buttons.cancel')}
                    buttonStyle={themeMenu.styles.buttons}
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={themeMenu.styles.buttonsTitle}
                    icon={
                        <MaterialIcons
                            name="close"
                            size={26}
                            style={themeMenu.styles.buttonIcon}
                        />
                    }
                    onPress={() => this.handleButtonPress('cancel')}
                />
                <Button
                    title={translate('menus.crop.buttons.aspectRatio')}
                    buttonStyle={themeMenu.styles.buttons}
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={themeMenu.styles.buttonsTitle}
                    icon={
                        <MaterialIcons
                            name="aspect-ratio"
                            size={26}
                            style={themeMenu.styles.buttonIcon}
                        />
                    }
                    onPress={() => this.handleButtonPress('aspectRatio')}
                />
                <Button
                    title={translate('menus.crop.buttons.rotate')}
                    buttonStyle={themeMenu.styles.buttons}
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={themeMenu.styles.buttonsTitle}
                    icon={
                        <MaterialIcons
                            name="crop-rotate"
                            size={26}
                            style={themeMenu.styles.buttonIcon}
                        />
                    }
                    onPress={() => this.handleButtonPress('rotate')}
                />
                <Button
                    title={translate('menus.crop.buttons.done')}
                    buttonStyle={themeMenu.styles.buttons}
                    containerStyle={themeMenu.styles.buttonContainer}
                    titleStyle={themeMenu.styles.buttonsTitle}
                    icon={
                        <MaterialIcons
                            name="check"
                            size={26}
                            style={themeMenu.styles.buttonIcon}
                        />
                    }
                    onPress={() => this.handleButtonPress('done')}
                />
            </ButtonMenu>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CropButtonMenu);
