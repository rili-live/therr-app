import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native';
import { Button } from 'react-native-elements';
import {
    flip,
    offset,
    shift,
    useSpotlightTour,
    TourStep,
} from 'react-native-spotlight-tour';
import { buildStyles as buildButtonStyles } from './styles/buttons';
import { buildStyles as buildConfirmModalStyles } from './styles/modal/confirmModal';
import { buildStyles as buildTourStyles, MINIMUM_HORIZONTAL_PADDING } from './styles/navigation/tour';
import spacingStyles from './styles/layouts/spacing';
import translator from './services/translator';

const themeButtons = buildButtonStyles('light');
const themeModal = buildConfirmModalStyles('light');
const themeTour = buildTourStyles('light');

const ModalButton = ({ title, hasBorderRight, onPress, themeButtons, themeModal }) => {
    const extraStyles = hasBorderRight ? { borderRightWidth: 1 } : {};

    return (
        <Button
            containerStyle={[themeModal.styles.buttonContainer, extraStyles]}
            buttonStyle={[themeButtons.styles.btnClear, spacingStyles.padMd]}
            titleStyle={themeButtons.styles.btnTitleBlack}
            raised={true}
            type="clear"
            onPress={onPress}
            title={title}
        />
    );
};

const StepMatchUp = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { next, stop } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.matchUp')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.matchUp')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.exit')}
                    onPress={stop}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.next')}
                    onPress={next}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

const StepGps = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { previous, next } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.gps')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.gps')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.previous')}
                    onPress={previous}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.next')}
                    onPress={next}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

const StepDiscovered = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { previous, next } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.discovered')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.discovered')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.previous')}
                    onPress={previous}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.next')}
                    onPress={next}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

const StepCreate = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { next, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.create')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.create1')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.create2')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.previous')}
                    onPress={previous}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.next')}
                    onPress={next}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

const StepMenu = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { next, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.menu')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.menu')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.previous')}
                    onPress={previous}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.next')}
                    onPress={next}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

const StepConnect = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { next, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.connect')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.connect')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.previous')}
                    onPress={previous}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.next')}
                    onPress={next}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

const StepMap = ({
    translate,
}) => {
    // You can also use the hook inside the step component!
    const { stop, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.map')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.map')}</Text>
            <View style={themeModal.styles.buttonsContainer}>
                <ModalButton
                    title={translate('modals.touringNavigationModal.previous')}
                    onPress={previous}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
                <ModalButton
                    title={translate('modals.touringNavigationModal.done')}
                    onPress={stop}
                    hasBorderRight={false}
                    themeModal={themeModal}
                    themeButtons={themeButtons}
                />
            </View>
        </View>
    );
};

interface IGetTourStepsArgs {
    locale?: string;
}

const getTourSteps: (args: IGetTourStepsArgs) => TourStep[] = ({ locale }) => {
    const translate = (key: string, params: any) =>
        translator(locale || 'en-us', key, params);
    return [
        // ...setup the steps
        {
            before: () => {
                return new Promise((resolve) => {
                    // This is necessary to allow the map route render the map buttons
                    // before starting the tour.
                    setTimeout(() => {
                        return resolve();
                    }, 500);

                    // TODO: Use reject() to cancel tour if user clicks before load
                });
            },
            floatingProps: {
                middleware: [offset({
                    mainAxis: 10,
                }), shift(), flip()],
                placement: 'top',
            },
            render: () => <StepMatchUp translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
                    // alignmentAxis: -20,
                    crossAxis: (MINIMUM_HORIZONTAL_PADDING / 2),
                })],
                placement: 'top',
            },
            render: () => <StepGps translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
                    // alignmentAxis: -20,
                    crossAxis: (MINIMUM_HORIZONTAL_PADDING / 2),
                })],
                placement: 'top',
            },
            render: () => <StepDiscovered translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
                    crossAxis: -(MINIMUM_HORIZONTAL_PADDING / 2),
                })],
                placement: 'top',
            },
            render: () => <StepCreate translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
                    crossAxis: -(MINIMUM_HORIZONTAL_PADDING / 2),
                })],
                placement: 'bottom',
            },
            render: () => <StepMenu translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
                    crossAxis: -(MINIMUM_HORIZONTAL_PADDING / 2),
                })],
                placement: 'top',
            },
            render: () => <StepConnect translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
                })],
                placement: 'top',
            },
            render: () => <StepMap translate={translate} />,
        },
    ];
};

export default getTourSteps;
