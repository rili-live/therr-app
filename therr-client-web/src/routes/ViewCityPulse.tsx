/* eslint-disable max-len */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { Cities } from 'therr-js-utilities/constants';
import { Stack } from '@mantine/core';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import {
    CityHero,
    CityAbout,
    CityNeighborhoods,
    CityTrendingSpaces,
    CityUpcomingEvents,
    CityMomentsWall,
    CityGroups,
    CityCategoryTiles,
    CityGettingAround,
    CityNearbyCities,
    CityCTA,
    CityAttributionFooter,
    ICityPulseData,
} from '../components/CityPulse';

interface IViewCityPulseRouterProps {
    navigation: { navigate: NavigateFunction };
    routeParams: { citySlug: string };
}

interface IViewCityPulseDispatchProps {
    getCityPulse: Function;
}

interface IStoreProps extends IViewCityPulseDispatchProps {
    map: any;
}

interface IViewCityPulseProps extends IViewCityPulseRouterProps, IStoreProps {
    locale: string;
    translate: (key: string, params?: any) => string;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getCityPulse: MapActions.getCityPulse,
}, dispatch);

export class ViewCityPulseComponent extends React.Component<IViewCityPulseProps> {
    componentDidMount() {
        const {
            routeParams, map, locale, getCityPulse, navigation,
        } = this.props;
        const city = Cities.CitySlugMap[routeParams.citySlug];

        if (!city) {
            setTimeout(() => navigation.navigate('/locations'));
            return;
        }

        // Use SSR preload if present; otherwise fetch client-side.
        if (!map?.cityPulse?.[routeParams.citySlug]) {
            getCityPulse(routeParams.citySlug, locale);
        }
    }

    /**
     * Order sections. When Therr has meaningful content (>= 3 populated sections),
     * push Therr above the fold; otherwise lead with the Wiki baseline so the
     * page still feels substantive for thin-data cities.
     */
    // eslint-disable-next-line class-methods-use-this
    getSectionOrder(pulse: ICityPulseData): 'therrFirst' | 'wikiFirst' {
        const therrSignals = [
            (pulse.therr.trendingSpaces?.length || 0) >= 6,
            (pulse.therr.upcomingEvents?.length || 0) >= 1,
            (pulse.therr.recentMoments?.length || 0) >= 9,
            (pulse.therr.topGroups?.length || 0) >= 1,
        ].filter(Boolean).length;

        return therrSignals >= 3 ? 'therrFirst' : 'wikiFirst';
    }

    public render(): JSX.Element | null {
        const { map, routeParams, translate } = this.props;
        const city = Cities.CitySlugMap[routeParams.citySlug];
        if (!city) return null;

        const pulse: ICityPulseData | undefined = map?.cityPulse?.[routeParams.citySlug];

        // Fallback "shell" pulse so the page renders while loading
        const effective: ICityPulseData = pulse || {
            city: {
                slug: city.slug,
                name: city.name,
                state: city.state,
                stateAbbr: city.stateAbbr,
                lat: city.lat,
                lng: city.lng,
            },
            therr: {
                trendingSpaces: [],
                upcomingEvents: [],
                recentMoments: [],
                topGroups: [],
                categoriesWithCounts: [],
            },
            wiki: {
                summary: null,
                sections: null,
                heroImageUrl: null,
                attributionUrl: null,
                license: 'CC-BY-SA-4.0',
            },
            nearbyCities: [],
        };

        const sectionProps = { pulse: effective, translate };
        const order = this.getSectionOrder(effective);

        const therrBlock = (
            <>
                <CityTrendingSpaces {...sectionProps} />
                <CityUpcomingEvents {...sectionProps} />
                <CityMomentsWall {...sectionProps} />
                <CityGroups {...sectionProps} />
                <CityCategoryTiles {...sectionProps} />
            </>
        );
        const wikiBlock = (
            <>
                <CityAbout {...sectionProps} />
                <CityNeighborhoods {...sectionProps} />
                <CityGettingAround {...sectionProps} />
            </>
        );

        return (
            <div id="page_view_city_pulse">
                <Stack gap="lg" p={{ base: 'sm', sm: 'xl' }} maw={920} mx="auto">
                    <CityHero {...sectionProps} />
                    {order === 'therrFirst' ? (
                        <>
                            {therrBlock}
                            {wikiBlock}
                        </>
                    ) : (
                        <>
                            {wikiBlock}
                            {therrBlock}
                        </>
                    )}
                    <CityNearbyCities {...sectionProps} />
                    <CityCTA {...sectionProps} />
                    <CityAttributionFooter {...sectionProps} />
                </Stack>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewCityPulseComponent)));
