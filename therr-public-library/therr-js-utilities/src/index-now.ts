import axios from 'axios';

const INDEXNOW_API_URL = 'https://api.indexnow.org/indexnow';

/**
 * Submits URLs to the IndexNow API for instant indexing by Bing, Yandex, and other participating search engines.
 * This is a fire-and-forget utility — errors are logged but never thrown.
 */
const submitToIndexNow = (urls: string[], apiKey: string, host = 'www.therr.com'): Promise<void> => {
    if (!apiKey || !urls.length) {
        return Promise.resolve();
    }

    return axios.post(INDEXNOW_API_URL, {
        host,
        key: apiKey,
        keyLocation: `https://${host}/${apiKey}.txt`,
        urlList: urls,
    }, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        timeout: 10000,
    }).then(() => {
        // eslint-disable-next-line no-console
        console.log(`[IndexNow] Successfully submitted ${urls.length} URL(s)`);
    }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[IndexNow] Failed to submit URLs: ${err?.message || 'Unknown error'}`);
    });
};

export default submitToIndexNow;
