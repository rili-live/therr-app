import * as React from 'react';
import { Image } from '@mantine/core';

interface IProgressiveImageProps {
    src: string;
    alt: string;
    className?: string;
    fallbackSrc?: string;
    radius?: string;
    fetchPriority?: 'high' | 'low' | 'auto';
    // Fires once per loaded src with whether the image is effectively a single flat color.
    // Enables CORS-tagged fetch + canvas pixel sampling; pass only when you intend to hide the image.
    onBlankChange?: (isBlank: boolean) => void;
}

// Sample a small canvas and decide if the image is effectively a single flat color.
// Called after load; throws (and returns false) if the canvas is CORS-tainted.
const detectBlankImage = (img: HTMLImageElement): boolean => {
    if (!img.naturalWidth || !img.naturalHeight) return false;
    const sampleSize = 16;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
    }
    return (maxLum - minLum) < 8;
};

const ProgressiveImage: React.FC<IProgressiveImageProps> = ({
    src,
    alt,
    className,
    fallbackSrc,
    radius,
    fetchPriority,
    onBlankChange,
}) => {
    const [isLoaded, setIsLoaded] = React.useState(false);

    // Build a tiny blurred placeholder URL from the ImageKit source
    const placeholderSrc = React.useMemo(() => {
        if (!src || !src.includes('?tr=')) return undefined;
        return src.replace(/\?tr=(.*)/, '?tr=h-40,w-40,bl-30,q-50,f-auto');
    }, [src]);

    React.useEffect(() => {
        setIsLoaded(false);
    }, [src]);

    const handleLoad = React.useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoaded(true);
        if (!onBlankChange) return;
        try {
            onBlankChange(detectBlankImage(e.currentTarget));
        } catch {
            onBlankChange(false);
        }
    }, [onBlankChange]);

    // crossOrigin is required for canvas pixel sampling; only tag when needed to avoid affecting other callers.
    const crossOrigin = onBlankChange ? 'anonymous' : undefined;

    if (!placeholderSrc) {
        return (
            <Image
                src={src}
                alt={alt}
                className={className}
                fallbackSrc={fallbackSrc}
                radius={radius}
                fetchPriority={fetchPriority}
                crossOrigin={crossOrigin}
                onLoad={handleLoad}
            />
        );
    }

    const borderRadius = radius === 'md'
        ? 'var(--mantine-radius-md)'
        : undefined;

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius }}>
            {/* Full resolution image - always in DOM for SSR/SEO */}
            <Image
                src={src}
                alt={alt}
                className={className}
                fallbackSrc={fallbackSrc}
                radius={radius}
                fetchPriority={fetchPriority}
                crossOrigin={crossOrigin}
                onLoad={handleLoad}
            />
            {/* Blurred placeholder overlay - fades out when full image loads */}
            <Image
                src={placeholderSrc}
                alt=""
                aria-hidden="true"
                className={className}
                radius={radius}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    filter: 'blur(20px)',
                    transform: 'scale(1.1)',
                    opacity: isLoaded ? 0 : 1,
                    transition: 'opacity 0.3s ease-out',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
};

export default ProgressiveImage;
