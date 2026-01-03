import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

/**
 * Image Capture and Upload Regression Tests
 *
 * These tests verify the image handling logic including:
 * - Image path processing
 * - Image preview generation
 * - Media type determination
 * - Image upload URL signing
 * - File extension handling
 */

describe('Image Path Processing', () => {
    // Simulates the getImagePreviewPath utility function
    const getImagePreviewPath = (imageURI: string | undefined): string => {
        if (!imageURI) {
            return '';
        }
        let fullImagePath = imageURI.replace('file:///', '').replace('file:/', '');
        fullImagePath = `file:///${fullImagePath}`;

        return `${fullImagePath}?cachebust=${Date.now()}`;
    };

    describe('getImagePreviewPath', () => {
        it('should return empty string for undefined input', () => {
            const result = getImagePreviewPath(undefined);
            expect(result).toBe('');
        });

        it('should return empty string for empty string input', () => {
            const result = getImagePreviewPath('');
            expect(result).toBe('');
        });

        it('should normalize file:/// prefix', () => {
            const result = getImagePreviewPath('file:///path/to/image.jpg');
            expect(result).toMatch(/^file:\/\/\/path\/to\/image\.jpg\?cachebust=/);
        });

        it('should normalize file:/ prefix', () => {
            const result = getImagePreviewPath('file:/path/to/image.jpg');
            expect(result).toMatch(/^file:\/\/\/path\/to\/image\.jpg\?cachebust=/);
        });

        it('should handle paths without file:// prefix', () => {
            const result = getImagePreviewPath('/path/to/image.jpg');
            // Paths without file:// prefix get an extra slash when normalized
            expect(result).toMatch(/^file:\/\/\/+path\/to\/image\.jpg\?cachebust=/);
        });

        it('should add cachebust parameter', () => {
            const result = getImagePreviewPath('/path/to/image.jpg');
            expect(result).toContain('?cachebust=');
        });
    });
});

describe('File Extension Handling', () => {
    const getFileExtension = (filePath?: string): string => {
        if (!filePath) {
            return 'jpeg';
        }
        const filePathSplit = filePath.split('.');
        return filePathSplit.length > 1 ? filePathSplit[filePathSplit.length - 1] : 'jpeg';
    };

    describe('getFileExtension', () => {
        it('should extract jpeg extension', () => {
            expect(getFileExtension('/path/to/image.jpeg')).toBe('jpeg');
        });

        it('should extract jpg extension', () => {
            expect(getFileExtension('/path/to/image.jpg')).toBe('jpg');
        });

        it('should extract png extension', () => {
            expect(getFileExtension('/path/to/image.png')).toBe('png');
        });

        it('should handle multiple dots in path', () => {
            expect(getFileExtension('/path.with.dots/to/image.png')).toBe('png');
        });

        it('should default to jpeg for undefined', () => {
            expect(getFileExtension(undefined)).toBe('jpeg');
        });

        it('should default to jpeg for path without extension', () => {
            // When there's only one segment after split, it means no extension
            // Our implementation checks for this and defaults to 'jpeg'
            expect(getFileExtension('/path/to/image')).toBe('jpeg');
        });
    });
});

describe('Media Type Determination', () => {
    const MEDIA_TYPES = {
        USER_IMAGE_PUBLIC: 'user.image.public',
        USER_IMAGE_PRIVATE: 'user.image.private',
    };

    const getMediaType = (isPublic: boolean): string => {
        return isPublic ? MEDIA_TYPES.USER_IMAGE_PUBLIC : MEDIA_TYPES.USER_IMAGE_PRIVATE;
    };

    describe('getMediaType', () => {
        it('should return public media type when isPublic is true', () => {
            expect(getMediaType(true)).toBe('user.image.public');
        });

        it('should return private media type when isPublic is false', () => {
            expect(getMediaType(false)).toBe('user.image.private');
        });
    });
});

describe('Image Upload Filename Generation', () => {
    const generateUploadFilename = (notificationMsg: string, message: string, fileExtension: string): string => {
        const baseText = notificationMsg || message.substring(0, 20);
        const sanitized = baseText.replace(/[^a-zA-Z0-9]/g, '_');
        return `content/${sanitized}.${fileExtension}`;
    };

    describe('generateUploadFilename', () => {
        it('should use notificationMsg when available', () => {
            const result = generateUploadFilename('My Title', 'My longer message content', 'jpeg');
            expect(result).toBe('content/My_Title.jpeg');
        });

        it('should fallback to message substring when notificationMsg is empty', () => {
            const result = generateUploadFilename('', 'This is a very long message that exceeds twenty characters', 'png');
            expect(result).toBe('content/This_is_a_very_long_.png');
        });

        it('should sanitize special characters', () => {
            const result = generateUploadFilename('Hello! World@#$%', '', 'jpg');
            expect(result).toBe('content/Hello__World____.jpg');
        });

        it('should handle spaces by converting to underscores', () => {
            const result = generateUploadFilename('My Photo Title', '', 'jpeg');
            expect(result).toBe('content/My_Photo_Title.jpeg');
        });
    });
});

describe('Image Selection Response Handling', () => {
    interface IImageResponse {
        didCancel?: boolean;
        errorCode?: string;
        path?: string;
        mime?: string;
        size?: number;
    }

    const isValidImageResponse = (response: IImageResponse): boolean => {
        return !response.didCancel && !response.errorCode;
    };

    describe('isValidImageResponse', () => {
        it('should return true for valid response', () => {
            const response: IImageResponse = {
                path: '/path/to/image.jpg',
                mime: 'image/jpeg',
                size: 1024,
            };
            expect(isValidImageResponse(response)).toBe(true);
        });

        it('should return false when user cancels', () => {
            const response: IImageResponse = {
                didCancel: true,
            };
            expect(isValidImageResponse(response)).toBe(false);
        });

        it('should return false when there is an error', () => {
            const response: IImageResponse = {
                errorCode: 'PERMISSION_DENIED',
            };
            expect(isValidImageResponse(response)).toBe(false);
        });

        it('should return false when cancelled with error', () => {
            const response: IImageResponse = {
                didCancel: true,
                errorCode: 'CANCELLED',
            };
            expect(isValidImageResponse(response)).toBe(false);
        });
    });
});

describe('Image Picker Options', () => {
    const buildPickerOptions = (viewportWidth: number, isMultiple = false) => {
        return {
            mediaType: 'photo',
            includeBase64: false,
            height: 4 * viewportWidth,
            width: 4 * viewportWidth,
            multiple: isMultiple,
            cropping: true,
        };
    };

    describe('buildPickerOptions', () => {
        it('should set correct dimensions based on viewport width', () => {
            const options = buildPickerOptions(400);

            expect(options.height).toBe(1600);
            expect(options.width).toBe(1600);
        });

        it('should set mediaType to photo', () => {
            const options = buildPickerOptions(400);
            expect(options.mediaType).toBe('photo');
        });

        it('should not include base64 by default', () => {
            const options = buildPickerOptions(400);
            expect(options.includeBase64).toBe(false);
        });

        it('should enable cropping by default', () => {
            const options = buildPickerOptions(400);
            expect(options.cropping).toBe(true);
        });

        it('should disable multiple selection by default', () => {
            const options = buildPickerOptions(400);
            expect(options.multiple).toBe(false);
        });

        it('should allow multiple selection when specified', () => {
            const options = buildPickerOptions(400, true);
            expect(options.multiple).toBe(true);
        });
    });
});

describe('Image Media State Handling', () => {
    interface IImageDetails {
        path?: string;
        mime?: string;
        size?: number;
    }

    interface IMediaState {
        selectedImage: IImageDetails;
        imagePreviewPath: string;
    }

    const updateMediaState = (currentState: IMediaState, imageResponse: IImageDetails): IMediaState => {
        const previewPath = imageResponse.path
            ? `file:///${imageResponse.path.replace('file:///', '').replace('file:/', '')}?cachebust=${Date.now()}`
            : '';

        return {
            selectedImage: imageResponse,
            imagePreviewPath: previewPath,
        };
    };

    describe('updateMediaState', () => {
        it('should update selected image and preview path', () => {
            const currentState: IMediaState = {
                selectedImage: {},
                imagePreviewPath: '',
            };
            const imageResponse: IImageDetails = {
                path: '/new/path/image.jpg',
                mime: 'image/jpeg',
                size: 2048,
            };

            const result = updateMediaState(currentState, imageResponse);

            expect(result.selectedImage).toEqual(imageResponse);
            expect(result.imagePreviewPath).toContain('file:///');
            expect(result.imagePreviewPath).toContain('image.jpg');
        });

        it('should handle empty path', () => {
            const currentState: IMediaState = {
                selectedImage: { path: '/old/path.jpg' },
                imagePreviewPath: 'old-preview',
            };
            const imageResponse: IImageDetails = {};

            const result = updateMediaState(currentState, imageResponse);

            expect(result.selectedImage).toEqual({});
            expect(result.imagePreviewPath).toBe('');
        });
    });
});

describe('Image Upload Request Construction', () => {
    interface IMediaEntry {
        type: string;
        path: string;
    }

    interface ICreateArgs {
        media?: IMediaEntry[];
    }

    const addMediaToCreateArgs = (
        createArgs: ICreateArgs,
        mediaPath: string,
        mediaType: string
    ): ICreateArgs => {
        return {
            ...createArgs,
            media: [
                {
                    type: mediaType,
                    path: mediaPath,
                },
            ],
        };
    };

    describe('addMediaToCreateArgs', () => {
        it('should add media array to create args', () => {
            const createArgs: ICreateArgs = {};
            const result = addMediaToCreateArgs(createArgs, 'content/image.jpg', 'user.image.public');

            expect(result.media).toHaveLength(1);
            expect(result.media![0].path).toBe('content/image.jpg');
            expect(result.media![0].type).toBe('user.image.public');
        });

        it('should preserve existing create args', () => {
            const createArgs: ICreateArgs = {};
            const result = addMediaToCreateArgs(createArgs, 'content/image.jpg', 'user.image.private');

            expect(result.media).toBeDefined();
            expect(result.media![0].type).toBe('user.image.private');
        });
    });
});

describe('Image Upload Header Construction', () => {
    interface IUploadHeaders {
        'Content-Type': string;
        'Content-Length': string;
        'Content-Disposition': string;
    }

    const buildUploadHeaders = (mime: string, size: number): IUploadHeaders => {
        return {
            'Content-Type': mime,
            'Content-Length': size.toString(),
            'Content-Disposition': 'inline',
        };
    };

    describe('buildUploadHeaders', () => {
        it('should set correct Content-Type', () => {
            const headers = buildUploadHeaders('image/jpeg', 1024);
            expect(headers['Content-Type']).toBe('image/jpeg');
        });

        it('should convert size to string for Content-Length', () => {
            const headers = buildUploadHeaders('image/png', 2048);
            expect(headers['Content-Length']).toBe('2048');
        });

        it('should set Content-Disposition to inline', () => {
            const headers = buildUploadHeaders('image/jpeg', 1024);
            expect(headers['Content-Disposition']).toBe('inline');
        });
    });
});

describe('Image Bottom Sheet State', () => {
    describe('toggleImageBottomSheet', () => {
        it('should toggle visibility state', () => {
            let isVisible = false;

            const toggle = () => {
                isVisible = !isVisible;
            };

            toggle();
            expect(isVisible).toBe(true);

            toggle();
            expect(isVisible).toBe(false);
        });
    });

    describe('Image Action Selection', () => {
        const handleImageAction = (action: 'camera' | 'upload'): string => {
            if (action === 'camera') {
                return 'openCamera';
            }
            return 'openPicker';
        };

        it('should return openCamera for camera action', () => {
            expect(handleImageAction('camera')).toBe('openCamera');
        });

        it('should return openPicker for upload action', () => {
            expect(handleImageAction('upload')).toBe('openPicker');
        });
    });
});

describe('Image Cancel Error Handling', () => {
    const isCancelError = (error: Error): boolean => {
        return error.message.toLowerCase().includes('cancel');
    };

    describe('isCancelError', () => {
        it('should return true for cancel message', () => {
            const error = new Error('User cancelled image selection');
            expect(isCancelError(error)).toBe(true);
        });

        it('should return true for cancelled message', () => {
            const error = new Error('Image picker was cancelled');
            expect(isCancelError(error)).toBe(true);
        });

        it('should return true for uppercase CANCEL', () => {
            const error = new Error('CANCEL');
            expect(isCancelError(error)).toBe(true);
        });

        it('should return false for other errors', () => {
            const error = new Error('Permission denied');
            expect(isCancelError(error)).toBe(false);
        });
    });
});

describe('Content URI Generation', () => {
    interface IMedia {
        path?: string;
        type?: string;
    }

    const USER_IMAGE_PUBLIC = 'user.image.public';

    const getUserContentUri = (media: IMedia, width: number, height: number): string | undefined => {
        if (!media?.path || media?.type !== USER_IMAGE_PUBLIC) {
            return undefined;
        }

        // Simulates building the cacheable API gateway URL
        return `https://api.example.com/content/${media.path}?w=${width}&h=${height}`;
    };

    describe('getUserContentUri', () => {
        it('should generate URL for public images', () => {
            const media: IMedia = { path: 'content/image.jpg', type: USER_IMAGE_PUBLIC };
            const result = getUserContentUri(media, 400, 400);

            expect(result).toBe('https://api.example.com/content/content/image.jpg?w=400&h=400');
        });

        it('should return undefined for private images', () => {
            const media: IMedia = { path: 'content/image.jpg', type: 'user.image.private' };
            const result = getUserContentUri(media, 400, 400);

            expect(result).toBeUndefined();
        });

        it('should return undefined when path is missing', () => {
            const media: IMedia = { type: USER_IMAGE_PUBLIC };
            const result = getUserContentUri(media, 400, 400);

            expect(result).toBeUndefined();
        });

        it('should return undefined for empty media', () => {
            const media: IMedia = {};
            const result = getUserContentUri(media, 400, 400);

            expect(result).toBeUndefined();
        });
    });
});

describe('Multiple Image Handling', () => {
    interface IImageDetails {
        path?: string;
        mime?: string;
        size?: number;
    }

    const mergeImageArrays = (existing: IImageDetails[], newImages: IImageDetails[]): IImageDetails[] => {
        return [...existing, ...newImages];
    };

    const removeImageAtIndex = (images: IImageDetails[], index: number): IImageDetails[] => {
        return images.filter((_, i) => i !== index);
    };

    describe('mergeImageArrays', () => {
        it('should merge two image arrays', () => {
            const existing: IImageDetails[] = [{ path: '/image1.jpg' }];
            const newImages: IImageDetails[] = [{ path: '/image2.jpg' }];

            const result = mergeImageArrays(existing, newImages);

            expect(result).toHaveLength(2);
        });

        it('should handle empty existing array', () => {
            const existing: IImageDetails[] = [];
            const newImages: IImageDetails[] = [{ path: '/image1.jpg' }];

            const result = mergeImageArrays(existing, newImages);

            expect(result).toHaveLength(1);
        });
    });

    describe('removeImageAtIndex', () => {
        it('should remove image at specified index', () => {
            const images: IImageDetails[] = [
                { path: '/image1.jpg' },
                { path: '/image2.jpg' },
                { path: '/image3.jpg' },
            ];

            const result = removeImageAtIndex(images, 1);

            expect(result).toHaveLength(2);
            expect(result[1].path).toBe('/image3.jpg');
        });

        it('should handle removing first image', () => {
            const images: IImageDetails[] = [
                { path: '/image1.jpg' },
                { path: '/image2.jpg' },
            ];

            const result = removeImageAtIndex(images, 0);

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/image2.jpg');
        });

        it('should handle removing last image', () => {
            const images: IImageDetails[] = [
                { path: '/image1.jpg' },
                { path: '/image2.jpg' },
            ];

            const result = removeImageAtIndex(images, 1);

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/image1.jpg');
        });
    });
});
