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

const ProgressiveImage: React.FC<IProgressiveImageProps> = ({
    src,
    alt,
    className,
    fallbackSrc,
    radius,
    fetchPriority,
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
                onLoad={() => setIsLoaded(true)}
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
