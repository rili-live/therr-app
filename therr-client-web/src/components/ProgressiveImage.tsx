import * as React from 'react';
import { Image } from '@mantine/core';

interface IProgressiveImageProps {
    src: string;
    alt: string;
    className?: string;
    fallbackSrc?: string;
    radius?: string;
    fetchPriority?: 'high' | 'low' | 'auto';
}

/**
 * Progressive image component that shows a tiny blurred placeholder
 * while the full-resolution image loads (blur-up effect).
 * Works with ImageKit URLs by appending blur and resize transforms.
 */
const ProgressiveImage: React.FC<IProgressiveImageProps> = ({
    src,
    alt,
    className,
    fallbackSrc,
    radius,
    fetchPriority,
}) => {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const imgRef = React.useRef<HTMLImageElement>(null);

    // Build a tiny blurred placeholder URL from the ImageKit source
    const placeholderSrc = React.useMemo(() => {
        if (!src || !src.includes('?tr=')) return undefined;
        // Replace size params with tiny size + blur
        return src.replace(/\?tr=(.*)/, '?tr=h-40,w-40,bl-30,q-50,f-auto');
    }, [src]);

    React.useEffect(() => {
        setIsLoaded(false);
    }, [src]);

    // Check if the image was already cached/loaded before React hydrated
    React.useEffect(() => {
        if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
            setIsLoaded(true);
        }
    }, []);

    if (!placeholderSrc) {
        return (
            <Image
                src={src}
                alt={alt}
                className={className}
                fallbackSrc={fallbackSrc}
                radius={radius}
                fetchPriority={fetchPriority}
            />
        );
    }

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radius === 'md' ? 'var(--mantine-radius-md)' : undefined }}>
            {/* Blurred placeholder - always rendered, hidden once full image loads */}
            {!isLoaded && (
                <Image
                    src={placeholderSrc}
                    alt=""
                    className={className}
                    radius={radius}
                    style={{
                        filter: 'blur(20px)',
                        transform: 'scale(1.1)',
                    }}
                />
            )}
            {/* Full resolution image */}
            <Image
                ref={imgRef}
                src={src}
                alt={alt}
                className={className}
                fallbackSrc={fallbackSrc}
                radius={radius}
                fetchPriority={fetchPriority}
                onLoad={() => setIsLoaded(true)}
                style={!isLoaded ? {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                } : undefined}
            />
        </div>
    );
};

export default ProgressiveImage;
