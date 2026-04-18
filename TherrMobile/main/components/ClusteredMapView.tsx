import React, {
    useState,
    useRef,
    useCallback,
    forwardRef,
    useImperativeHandle,
    useMemo,
} from 'react';
import { Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { MapViewProps, Region } from 'react-native-maps';
import SuperCluster from 'supercluster';

interface ClusteredMapViewProps extends MapViewProps {
    clusterColor?: string;
    clusterTextColor?: string;
    clusterFontFamily?: string;
    onClusterPress?: (cluster: any, markers?: any[]) => void;
    animationEnabled?: boolean;
    spiderLineColor?: string;
}

const isMarkerElement = (
    child: React.ReactNode
): child is React.ReactElement<{ coordinate: { latitude: number; longitude: number } }> => {
    return (
        React.isValidElement(child) &&
        child.props !== null &&
        typeof child.props === 'object' &&
        'coordinate' in child.props
    );
};

const calculateBBox = (region: Region): [number, number, number, number] => {
    return [
        region.longitude - region.longitudeDelta / 2,
        region.latitude - region.latitudeDelta / 2,
        region.longitude + region.longitudeDelta / 2,
        region.latitude + region.latitudeDelta / 2,
    ];
};

const getZoomLevel = (region: Region, width: number): number => {
    return Math.ceil(Math.log2(360 * (width / 256) / region.longitudeDelta));
};

const getClusterStyle = (pointCount: number) => {
    if (pointCount >= 50) return { size: 64, fontSize: 20 };
    if (pointCount >= 25) return { size: 58, fontSize: 19 };
    if (pointCount >= 15) return { size: 54, fontSize: 18 };
    if (pointCount >= 10) return { size: 50, fontSize: 17 };
    if (pointCount >= 4) return { size: 40, fontSize: 16 };
    return { size: 36, fontSize: 15 };
};

const ClusteredMapView = forwardRef<MapView, ClusteredMapViewProps>(
    (
        {
            clusterColor = '#00B386',
            clusterTextColor = '#FFFFFF',
            clusterFontFamily,
            onClusterPress,
            onRegionChangeComplete,
            children,
            // Consumed but unused props (prevent passing to MapView)
            animationEnabled: _animationEnabled,
            spiderLineColor: _spiderLineColor,
            ...mapViewProps
        },
        ref
    ) => {
        const mapRef = useRef<MapView>(null);
        const { width } = useWindowDimensions();
        const [currentRegion, setCurrentRegion] = useState<Region | null>(null);

        useImperativeHandle(ref, () => mapRef.current as MapView);

        const allChildren = useMemo(
            () => React.Children.toArray(children),
            [children]
        );

        // Separate markers from other children and build the supercluster index
        const { cluster, markerChildren, otherChildren } = useMemo(() => {
            const markers: React.ReactElement[] = [];
            const others: React.ReactNode[] = [];
            allChildren.forEach((child) => {
                if (isMarkerElement(child)) {
                    markers.push(child);
                } else {
                    others.push(child);
                }
            });

            const sc = new SuperCluster({ radius: 80, maxZoom: 20, minZoom: 1 });
            sc.load(
                markers.map((m, i) => ({
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [
                            m.props.coordinate.longitude,
                            m.props.coordinate.latitude,
                        ],
                    },
                    properties: { index: i },
                }))
            );

            return { cluster: sc, markerChildren: markers, otherChildren: others };
        }, [allChildren]);

        // Compute visible clusters/markers for the current region
        const visibleItems = useMemo(() => {
            const region = currentRegion || mapViewProps.region || mapViewProps.initialRegion;
            if (!region || markerChildren.length === 0) return [];
            const bbox = calculateBBox(region as Region);
            const zoom = getZoomLevel(region as Region, width);
            return cluster.getClusters(bbox, zoom);
        }, [currentRegion, mapViewProps.region, mapViewProps.initialRegion, cluster, markerChildren.length, width]);

        const handleRegionChangeComplete = useCallback(
            (region: Region, details?: { isGesture: boolean }) => {
                setCurrentRegion(region);
                onRegionChangeComplete?.(region, details as any);
            },
            [onRegionChangeComplete]
        );

        const handleClusterPress = useCallback(
            (clusterFeature: any) => {
                if (!cluster) return;
                const leaves = cluster.getLeaves(clusterFeature.properties.cluster_id, Infinity);
                onClusterPress?.(clusterFeature, leaves);
                const coords = leaves.map((leaf: any) => ({
                    latitude: leaf.geometry.coordinates[1],
                    longitude: leaf.geometry.coordinates[0],
                }));
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 50, left: 50, right: 50, bottom: 50 },
                });
            },
            [cluster, onClusterPress]
        );

        return (
            <MapView
                {...mapViewProps}
                ref={mapRef}
                onRegionChangeComplete={handleRegionChangeComplete}
            >
                {otherChildren}
                {visibleItems.map((item: any) => {
                    if (item.properties.cluster) {
                        const { cluster_id, point_count } = item.properties;
                        const [longitude, latitude] = item.geometry.coordinates;
                        const { size, fontSize } = getClusterStyle(point_count);
                        return (
                            <Marker
                                key={`cluster-${cluster_id}`}
                                coordinate={{ latitude, longitude }}
                                style={{ zIndex: point_count + 1 }}
                                onPress={() => handleClusterPress(item)}
                            >
                                <View
                                    style={[
                                        styles.clusterInner,
                                        {
                                            backgroundColor: clusterColor,
                                            width: size,
                                            height: size,
                                            borderRadius: size / 2,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.clusterText,
                                            {
                                                color: clusterTextColor,
                                                fontSize,
                                                lineHeight: fontSize + 2,
                                                fontFamily: clusterFontFamily,
                                            },
                                        ]}
                                    >
                                        {point_count}
                                    </Text>
                                </View>
                            </Marker>
                        );
                    }

                    // Individual marker — render original element
                    const original = markerChildren[item.properties.index];
                    if (!original) return null;
                    return React.cloneElement(original, { key: `point-${item.properties.index}` });
                })}
            </MapView>
        );
    }
);

const styles = StyleSheet.create({
    clusterOuter: { justifyContent: 'center', alignItems: 'center' },
    clusterHalo: { position: 'absolute', opacity: 0.5 },
    clusterInner: { justifyContent: 'center', alignItems: 'center', zIndex: 1 },
    clusterText: { fontWeight: 'bold' },
});

export default React.memo(ClusteredMapView);
