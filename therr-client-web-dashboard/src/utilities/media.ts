import { MapsService } from 'therr-react/services';
import { Content } from 'therr-js-utilities/constants';

interface ISignImageUrlArgs {
    action: string;
    filename: string;
    overrideFromUserId?: string;
}

const signImageUrl = (isPublic: boolean, {
    action,
    filename,
    overrideFromUserId,
}: ISignImageUrlArgs) => {
    const signUrl = isPublic ? MapsService.getSignedUrlPublicBucket : MapsService.getSignedUrlPrivateBucket;

    // TODO: This is too slow
    // Use public method for public moments
    return signUrl({
        action,
        filename,
        overrideFromUserId,
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
    reader.readAsArrayBuffer(file);
});

const signAndUploadImage = (createArgs: any, files: any[]) => {
    const modifiedCreateArgs = { ...createArgs };
    const firstFile = files[0];
    const fileNameSplit = firstFile?.name?.split('.');
    const fileExtension = fileNameSplit ? `${fileNameSplit[fileNameSplit.length - 1]}` : 'jpeg';

    return signImageUrl(createArgs.isPublic, {
        action: 'write',
        filename: `content/${fileNameSplit[0].replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
        overrideFromUserId: modifiedCreateArgs.overrideFromUserId,
    }).then((response) => {
        const signedUrl = response?.data?.url && response?.data?.url[0];
        modifiedCreateArgs.media = [{}];
        modifiedCreateArgs.media[0].type = createArgs.isPublic ? Content.mediaTypes.USER_IMAGE_PUBLIC : Content.mediaTypes.USER_IMAGE_PRIVATE;
        modifiedCreateArgs.media[0].path = response?.data?.path;

        // TODO: Upload the file to Google Cloud
        return fileToBuffer(firstFile).then((buffer: string) => fetch(
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
        ))
            .then(() => modifiedCreateArgs)
            .catch((err) => {
                console.log(err);
                return modifiedCreateArgs;
            });
    });
};

export {
    signImageUrl,
    signAndUploadImage,
};
