import { MapsService } from 'therr-react/services';
import { Content } from 'therr-js-utilities/constants';

const signImageUrl = (isPublic: boolean, {
    action,
    filename,
}) => {
    const signUrl = isPublic ? MapsService.getSignedUrlPublicBucket : MapsService.getSignedUrlPrivateBucket;

    // TODO: This is too slow
    // Use public method for public moments
    return signUrl({
        action,
        filename,
    });
};

const fileToBuffer = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onabort = () => reject(new Error('file reading was aborted'));
    reader.onerror = () => reject(new Error('file reading has failed'));
    reader.onload = () => {
        // Do whatever you want with the file contents
        const binaryStr = reader.result;
        return resolve(binaryStr);
    };
    reader.readAsBinaryString(file);
});

const signAndUploadImage = (createArgs: any, files: any[]) => {
    const modifiedCreateArgs = { ...createArgs };
    const firstFile = files[0];
    const fileNameSplit = firstFile?.name?.split('.');
    const fileExtension = fileNameSplit ? `${fileNameSplit[fileNameSplit.length - 1]}` : 'jpeg';

    return signImageUrl(createArgs.isPublic, {
        action: 'write',
        filename: `content/${fileNameSplit[0].replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
    }).then((response) => {
        const signedUrl = response?.data?.url && response?.data?.url[0];
        modifiedCreateArgs.media = [{}];
        modifiedCreateArgs.media[0].type = createArgs.isPublic ? Content.mediaTypes.USER_IMAGE_PUBLIC : Content.mediaTypes.USER_IMAGE_PRIVATE;
        modifiedCreateArgs.media[0].path = response?.data?.path;

        const formData = new FormData();

        // TODO: Upload the file to Google Cloud
        return fileToBuffer(firstFile).then((buffer: string) => {
            formData.append('file', firstFile);

            // Upload to Google Cloud
            return fetch(
                signedUrl,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': firstFile.type,
                        'Content-Length': firstFile.size.toString(),
                        'Content-Disposition': 'inline',
                    },
                    body: buffer,
                },
            ).then(() => modifiedCreateArgs);
        });
    });
};

export {
    signImageUrl,
    signAndUploadImage,
};
