// import { Platform } from 'react-native';
import uuid from 'react-native-uuid';

const getImagePreviewPath = (imageURI) => {
    if (!imageURI) {
        return '';
    }
    let fullImagePath = imageURI.replace('file:///', '').replace('file:/', '');
    fullImagePath = `file:///${fullImagePath}`;

    return `${fullImagePath}?cachebust=${uuid.v4()}`;
};

const addAddressParams = (area, unsanitizedAddress) => {
    const modifiedArea = {
        ...area,
    };
    if (unsanitizedAddress.addressReadable) {
        modifiedArea.addressReadable = unsanitizedAddress.addressReadable;
        if (unsanitizedAddress.addressReadable.endsWith('USA')) {
            const split = unsanitizedAddress.addressReadable.split(', ');
            const stateNZip = split[split.length - 2];
            const state = stateNZip.split(' ')[0];
            const zip = stateNZip.split(' ')[1];
            modifiedArea.postalCode = zip;
            modifiedArea.addressStreetAddress = split[0];
            modifiedArea.addressRegion = state;
            modifiedArea.addressLocality = split[split.length - 3];
        }
    }
    if (unsanitizedAddress.addressWebsite) {
        modifiedArea.websiteUrl = unsanitizedAddress.addressWebsite;
    }
    if (unsanitizedAddress.addressIntlPhone) {
        modifiedArea.phoneNumber = unsanitizedAddress.addressIntlPhone;
    }
    if (unsanitizedAddress.addressOpeningHours) {
        const mapped = {};
        unsanitizedAddress.addressOpeningHours.forEach((day) => {
            const split = day.split(': ');
            if (split[1] !== 'Closed') {
                const timeEntry = split[1] === 'Open 24 hours' ? '00:00 AM – 11:59 PM' : split[1];
                if (!mapped[timeEntry]) {
                    mapped[timeEntry] = split[0].substring(0,2);
                } else {
                    mapped[timeEntry] = [mapped[timeEntry], split[0].substring(0,2)].join(',');
                }
            }
        });
        const schema: string[] = [];
        for (const [key, value] of Object.entries(mapped)) {
            let keyLeft = key.split(' – ')[0];
            let keyRight = key.split(' – ')[1];
            if (keyLeft == null || keyRight == null) {
                console.log(key);
            }
            const isLeftPM = keyLeft.endsWith('PM');
            const isRightPM = keyRight.endsWith('PM');
            keyLeft = keyLeft.replace(' AM', '').replace(' PM', '');
            keyRight = keyRight.replace(' AM', '').replace(' PM', '');
            if (isLeftPM) {
                const leftSplit = keyLeft.split(':');
                keyLeft = `${Number(leftSplit[0]) + 12}:${leftSplit[1]}`;
            }
            if (isRightPM) {
                const rightSplit = keyRight.split(':');
                keyRight = `${Number(rightSplit[0]) + 12}:${rightSplit[1]}`;
            }
            schema.push(`${value} ${keyLeft}-${keyRight}`);
        };
        modifiedArea.openingHours = {
            schema,
            timezone: 'UTC',
            isConfirmed: true,
        };
    }
    if (unsanitizedAddress.addressRating) {
        modifiedArea.thirdPartyRatings = unsanitizedAddress.addressRating;
    }
    if (unsanitizedAddress.addressNotificationMsg) {
        modifiedArea.addressNotificationMsg = unsanitizedAddress.addressNotificationMsg;
    }

    return modifiedArea;
};

export {
    getImagePreviewPath,
    addAddressParams,
};
