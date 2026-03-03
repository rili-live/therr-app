import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import {
    flip,
    offset,
    shift,
    useSpotlightTour,
    TourStep,
} from 'react-native-spotlight-tour';
import { buildStyles as buildTourStyles, MINIMUM_HORIZONTAL_PADDING } from './styles/navigation/tour';
import translator from './services/translator';

const themeTour = buildTourStyles('light');

const StepMatchUp = ({
    translate,
}) => {
    const { next, stop } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.matchUp')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.matchUp')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={stop}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.exit')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={next}
                    icon="arrow-right"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.next')}
                </PaperButton>
            </View>
        </View>
    );
};

const StepGps = ({
    translate,
}) => {
    const { previous, next } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.gps')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.gps')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={previous}
                    icon="arrow-left"
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.previous')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={next}
                    icon="arrow-right"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.next')}
                </PaperButton>
            </View>
        </View>
    );
};

const StepDiscovered = ({
    translate,
}) => {
    const { previous, next } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.discovered')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.discovered')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={previous}
                    icon="arrow-left"
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.previous')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={next}
                    icon="arrow-right"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.next')}
                </PaperButton>
            </View>
        </View>
    );
};

const StepCreate = ({
    translate,
}) => {
    const { next, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.create')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.create1')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.create2')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={previous}
                    icon="arrow-left"
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.previous')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={next}
                    icon="arrow-right"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.next')}
                </PaperButton>
            </View>
        </View>
    );
};

const StepMenu = ({
    translate,
}) => {
    const { next, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.menu')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.menu')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={previous}
                    icon="arrow-left"
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.previous')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={next}
                    icon="arrow-right"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.next')}
                </PaperButton>
            </View>
        </View>
    );
};

const StepConnect = ({
    translate,
}) => {
    const { next, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.connect')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.connect')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={previous}
                    icon="arrow-left"
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.previous')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={next}
                    icon="arrow-right"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.next')}
                </PaperButton>
            </View>
        </View>
    );
};

const StepMap = ({
    translate,
}) => {
    const { stop, previous } = useSpotlightTour();

    return (
        <View style={themeTour.styles.tooltipContainer}>
            <Text style={themeTour.styles.header}>{translate('modals.touringNavigationModal.headers.map')}</Text>
            <Text style={themeTour.styles.text}>{translate('modals.touringNavigationModal.tips.map')}</Text>
            <View style={themeTour.styles.actionsContainer}>
                <PaperButton
                    mode="outlined"
                    onPress={previous}
                    icon="arrow-left"
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.previous')}
                </PaperButton>
                <PaperButton
                    mode="contained"
                    onPress={stop}
                    icon="check"
                    contentStyle={themeTour.styles.actionButtonContentRight}
                    style={themeTour.styles.actionButton}
                >
                    {translate('modals.touringNavigationModal.done')}
                </PaperButton>
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
            floatingProps: {
                middleware: [offset({
                    alignmentAxis: 0,
                    crossAxis: 0,
                    mainAxis: 10,
                })],
                placement: 'top',
            },
            render: () => <StepMatchUp translate={translate} />,
        },
        {
            floatingProps: {
                middleware: [flip(), shift(), offset({
                    mainAxis: 10,
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
                middleware: [offset({
                    mainAxis: 10,
                })],
                placement: 'top',
            },
            render: () => <StepMap translate={translate} />,
        },
    ];
};

export default getTourSteps;
