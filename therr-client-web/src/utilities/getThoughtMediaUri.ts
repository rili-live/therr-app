import { Content } from 'therr-js-utilities/constants';
import getUserContentUri from './getUserContentUri';

/**
 * The display URL for a thought's attached image, if it has a renderable one.
 *
 * Reads `media` (normalized to an array by `ThoughtsStore` on every read path) and falls
 * back to the raw `medias` column shape. Only the first image is used — the composer
 * attaches one.
 *
 * Public-bucket media only. Private thought media resolves through
 * `POST /maps-service/media/signed-urls`, an extra round trip no web thought surface
 * makes today; rendering it against the public endpoint would produce a broken image
 * rather than an error.
 */
const getThoughtMediaUri = (thought: any, height?: number, width?: number): string | null => {
    const medias = thought?.media || thought?.medias;

    if (!Array.isArray(medias)) {
        return null;
    }

    const media = medias.find((m) => m?.path && m?.type === Content.mediaTypes.USER_IMAGE_PUBLIC);

    return media ? getUserContentUri(media, height, width) : null;
};

export default getThoughtMediaUri;
