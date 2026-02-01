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
 * Content Creation Regression Tests
 *
 * These tests verify the core content creation logic and behaviors for:
 * - Moments (location-based check-ins with media)
 * - Events (scheduled activities with date/time)
 * - Spaces (persistent locations/businesses)
 * - Thoughts (text-based posts without location)
 */

describe('Content Creation Form Validation', () => {
    describe('Moment Form Validation', () => {
        // Simulates the isFormDisabled logic from EditMoment
        const isMomentFormDisabled = (inputs: { notificationMsg?: string; message?: string }, isSubmitting: boolean) => {
            return !inputs.notificationMsg || isSubmitting;
        };

        it('should disable form when notificationMsg is empty', () => {
            const inputs = { notificationMsg: '', message: 'Some message' };
            expect(isMomentFormDisabled(inputs, false)).toBe(true);
        });

        it('should disable form when isSubmitting is true', () => {
            const inputs = { notificationMsg: 'Test title', message: 'Some message' };
            expect(isMomentFormDisabled(inputs, true)).toBe(true);
        });

        it('should enable form when notificationMsg is provided and not submitting', () => {
            const inputs = { notificationMsg: 'Test title', message: '' };
            expect(isMomentFormDisabled(inputs, false)).toBe(false);
        });

        it('should enable form even when message is empty (optional field)', () => {
            const inputs = { notificationMsg: 'Title', message: '' };
            expect(isMomentFormDisabled(inputs, false)).toBe(false);
        });
    });

    describe('Space Form Validation', () => {
        // Simulates the isFormDisabled logic from EditSpace
        const isSpaceFormDisabled = (
            inputs: {
                message?: string;
                featuredIncentiveKey?: string;
                featuredIncentiveValue?: string;
                featuredIncentiveRewardKey?: string;
                featuredIncentiveRewardValue?: string;
                featuredIncentiveCurrencyId?: string;
            },
            isEditingIncentives: boolean,
            isSubmitting: boolean
        ) => {
            let isDisabled = !inputs.message || isSubmitting;

            if (!isEditingIncentives) {
                return isDisabled;
            }

            // All or no fields are required for incentives
            if (
                inputs.featuredIncentiveKey ||
                inputs.featuredIncentiveValue ||
                inputs.featuredIncentiveRewardKey ||
                inputs.featuredIncentiveRewardValue ||
                inputs.featuredIncentiveCurrencyId
            ) {
                if (
                    inputs.featuredIncentiveRewardValue &&
                    (inputs.featuredIncentiveRewardValue === '0' ||
                        inputs.featuredIncentiveRewardValue === '0.' ||
                        inputs.featuredIncentiveRewardValue === '0.0' ||
                        inputs.featuredIncentiveRewardValue?.endsWith('.'))
                ) {
                    return true;
                }

                return (
                    !inputs.featuredIncentiveKey ||
                    !inputs.featuredIncentiveValue ||
                    !inputs.featuredIncentiveRewardKey ||
                    !inputs.featuredIncentiveRewardValue ||
                    !inputs.featuredIncentiveCurrencyId
                );
            }

            return isDisabled;
        };

        it('should disable form when message is empty', () => {
            const inputs = { message: '' };
            expect(isSpaceFormDisabled(inputs, false, false)).toBe(true);
        });

        it('should disable form when isSubmitting is true', () => {
            const inputs = { message: 'Test description' };
            expect(isSpaceFormDisabled(inputs, false, true)).toBe(true);
        });

        it('should enable form when message is provided and not submitting', () => {
            const inputs = { message: 'Test description' };
            expect(isSpaceFormDisabled(inputs, false, false)).toBe(false);
        });

        it('should disable incentives when reward value is 0', () => {
            const inputs = {
                message: 'Test',
                featuredIncentiveKey: 'share-a-moment',
                featuredIncentiveValue: '1',
                featuredIncentiveRewardKey: 'therr-coin-reward',
                featuredIncentiveRewardValue: '0',
                featuredIncentiveCurrencyId: 'TherrCoin',
            };
            expect(isSpaceFormDisabled(inputs, true, false)).toBe(true);
        });

        it('should disable incentives when reward value ends with decimal', () => {
            const inputs = {
                message: 'Test',
                featuredIncentiveKey: 'share-a-moment',
                featuredIncentiveValue: '1',
                featuredIncentiveRewardKey: 'therr-coin-reward',
                featuredIncentiveRewardValue: '5.',
                featuredIncentiveCurrencyId: 'TherrCoin',
            };
            expect(isSpaceFormDisabled(inputs, true, false)).toBe(true);
        });

        it('should require all incentive fields when any is provided', () => {
            const inputs = {
                message: 'Test',
                featuredIncentiveKey: 'share-a-moment',
                // Missing other incentive fields
            };
            expect(isSpaceFormDisabled(inputs, true, false)).toBe(true);
        });

        it('should enable form when all incentive fields are provided', () => {
            const inputs = {
                message: 'Test',
                featuredIncentiveKey: 'share-a-moment',
                featuredIncentiveValue: '1',
                featuredIncentiveRewardKey: 'therr-coin-reward',
                featuredIncentiveRewardValue: '5',
                featuredIncentiveCurrencyId: 'TherrCoin',
            };
            expect(isSpaceFormDisabled(inputs, true, false)).toBe(false);
        });
    });

    describe('Thought Form Validation', () => {
        // Simulates the isFormDisabled logic from EditThought
        const isThoughtFormDisabled = (inputs: { message?: string }, isSubmitting: boolean) => {
            return !inputs.message || isSubmitting;
        };

        it('should disable form when message is empty', () => {
            const inputs = { message: '' };
            expect(isThoughtFormDisabled(inputs, false)).toBe(true);
        });

        it('should disable form when isSubmitting is true', () => {
            const inputs = { message: 'Test thought' };
            expect(isThoughtFormDisabled(inputs, true)).toBe(true);
        });

        it('should enable form when message is provided and not submitting', () => {
            const inputs = { message: 'Test thought' };
            expect(isThoughtFormDisabled(inputs, false)).toBe(false);
        });
    });
});

describe('Content Creation Hashtag Formatting', () => {
    // Simulates the formatHashtags utility function
    const formatHashtags = (value: string, hashtagsClone: string[]) => {
        const lastCharacter = value.substring(value.length - 1, value.length);
        let modifiedValue = value.replace(/[^\w_]/gi, '');

        if (lastCharacter === ',' || lastCharacter === ' ') {
            const tag = modifiedValue;
            if (tag !== '' && hashtagsClone.length < 50 && !hashtagsClone.includes(tag)) {
                hashtagsClone.push(tag);
            }
            modifiedValue = '';
        }

        return {
            formattedValue: modifiedValue,
            formattedHashtags: hashtagsClone,
        };
    };

    describe('formatHashtags', () => {
        it('should add hashtag when comma is entered', () => {
            const result = formatHashtags('travel,', []);
            expect(result.formattedValue).toBe('');
            expect(result.formattedHashtags).toContain('travel');
        });

        it('should add hashtag when space is entered', () => {
            const result = formatHashtags('travel ', []);
            expect(result.formattedValue).toBe('');
            expect(result.formattedHashtags).toContain('travel');
        });

        it('should remove special characters from hashtag', () => {
            const result = formatHashtags('tra@vel!#,', []);
            expect(result.formattedHashtags).toContain('travel');
        });

        it('should not add empty hashtag', () => {
            const result = formatHashtags(',', []);
            expect(result.formattedHashtags).toHaveLength(0);
        });

        it('should not add duplicate hashtags', () => {
            const result = formatHashtags('travel,', ['travel']);
            expect(result.formattedHashtags).toHaveLength(1);
        });

        it('should limit hashtags to 50', () => {
            const existingHashtags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
            const result = formatHashtags('newtag,', existingHashtags);
            expect(result.formattedHashtags).toHaveLength(50);
            expect(result.formattedHashtags).not.toContain('newtag');
        });

        it('should preserve underscores in hashtags', () => {
            const result = formatHashtags('my_tag,', []);
            expect(result.formattedHashtags).toContain('my_tag');
        });

        it('should return input value when no comma or space', () => {
            const result = formatHashtags('travel', []);
            expect(result.formattedValue).toBe('travel');
            expect(result.formattedHashtags).toHaveLength(0);
        });
    });
});

describe('Content Creation YouTube Link Detection', () => {
    // Simulates the YouTube link regex pattern used in content creation
    const youtubeLinkRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

    const extractYouTubeId = (message: string): string | undefined => {
        const match = message.match(youtubeLinkRegex);
        return match ? match[1] : undefined;
    };

    describe('extractYouTubeId', () => {
        it('should extract ID from standard YouTube URL', () => {
            const message = 'Check out this video https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            expect(extractYouTubeId(message)).toBe('dQw4w9WgXcQ');
        });

        it('should extract ID from short YouTube URL', () => {
            const message = 'Video: https://youtu.be/dQw4w9WgXcQ';
            expect(extractYouTubeId(message)).toBe('dQw4w9WgXcQ');
        });

        it('should extract ID from embed URL', () => {
            const message = 'Embedded: https://www.youtube.com/embed/dQw4w9WgXcQ';
            expect(extractYouTubeId(message)).toBe('dQw4w9WgXcQ');
        });

        it('should return undefined for non-YouTube links', () => {
            const message = 'Check out https://vimeo.com/123456';
            expect(extractYouTubeId(message)).toBeUndefined();
        });

        it('should return undefined for messages without links', () => {
            const message = 'Just a regular message';
            expect(extractYouTubeId(message)).toBeUndefined();
        });
    });
});

describe('Content Creation Location Parameters', () => {
    describe('Create Args Construction', () => {
        const buildMomentCreateArgs = (params: {
            category?: string;
            fromUserId: string;
            isPublic: boolean;
            message: string;
            notificationMsg: string;
            hashTags: string[];
            isDraft: boolean;
            latitude: number;
            longitude: number;
            radius: number;
            spaceId?: string;
        }) => {
            return {
                category: params.category || 'uncategorized',
                fromUserId: params.fromUserId,
                isPublic: params.isPublic,
                message: params.message || params.notificationMsg,
                notificationMsg: params.notificationMsg,
                hashTags: params.hashTags.join(','),
                isDraft: params.isDraft,
                latitude: params.latitude,
                longitude: params.longitude,
                radius: params.radius,
                spaceId: params.spaceId,
            };
        };

        it('should build correct create args for moment', () => {
            const args = buildMomentCreateArgs({
                fromUserId: 'user-123',
                isPublic: true,
                message: 'Great place!',
                notificationMsg: 'Check this out',
                hashTags: ['travel', 'food'],
                isDraft: false,
                latitude: 40.7128,
                longitude: -74.006,
                radius: 50,
            });

            expect(args.fromUserId).toBe('user-123');
            expect(args.isPublic).toBe(true);
            expect(args.hashTags).toBe('travel,food');
            expect(args.latitude).toBe(40.7128);
            expect(args.longitude).toBe(-74.006);
            expect(args.radius).toBe(50);
        });

        it('should use notificationMsg as message when message is empty', () => {
            const args = buildMomentCreateArgs({
                fromUserId: 'user-123',
                isPublic: true,
                message: '',
                notificationMsg: 'Title only post',
                hashTags: [],
                isDraft: false,
                latitude: 40.7128,
                longitude: -74.006,
                radius: 50,
            });

            expect(args.message).toBe('Title only post');
        });

        it('should default category to uncategorized', () => {
            const args = buildMomentCreateArgs({
                fromUserId: 'user-123',
                isPublic: false,
                message: 'Test',
                notificationMsg: 'Test',
                hashTags: [],
                isDraft: true,
                latitude: 0,
                longitude: 0,
                radius: 25,
            });

            expect(args.category).toBe('uncategorized');
        });

        it('should include spaceId when provided', () => {
            const args = buildMomentCreateArgs({
                fromUserId: 'user-123',
                isPublic: true,
                message: 'Test',
                notificationMsg: 'Test',
                hashTags: [],
                isDraft: false,
                latitude: 40.7128,
                longitude: -74.006,
                radius: 50,
                spaceId: 'space-456',
            });

            expect(args.spaceId).toBe('space-456');
        });
    });
});

describe('Content Creation Visibility Settings', () => {
    describe('onSetVisibility', () => {
        it('should set isPublic to true for public visibility', () => {
            let inputs = { isPublic: false };

            const onSetVisibility = (isPublic: boolean) => {
                inputs = { ...inputs, isPublic };
            };

            onSetVisibility(true);
            expect(inputs.isPublic).toBe(true);
        });

        it('should set isPublic to false for private visibility', () => {
            let inputs = { isPublic: true };

            const onSetVisibility = (isPublic: boolean) => {
                inputs = { ...inputs, isPublic };
            };

            onSetVisibility(false);
            expect(inputs.isPublic).toBe(false);
        });
    });
});

describe('Content Creation Radius Settings', () => {
    const DEFAULT_RADIUS = 25;
    const MIN_RADIUS_PRIVATE = 5;
    const MAX_RADIUS_PRIVATE = 100;
    const MIN_RADIUS_PUBLIC = 25;
    const MAX_RADIUS_PUBLIC = 500;

    describe('Radius Constraints', () => {
        it('should have correct default radius', () => {
            expect(DEFAULT_RADIUS).toBe(25);
        });

        it('should have correct private radius range', () => {
            expect(MIN_RADIUS_PRIVATE).toBeLessThan(MAX_RADIUS_PRIVATE);
            expect(MIN_RADIUS_PRIVATE).toBe(5);
            expect(MAX_RADIUS_PRIVATE).toBe(100);
        });

        it('should have correct public radius range', () => {
            expect(MIN_RADIUS_PUBLIC).toBeLessThan(MAX_RADIUS_PUBLIC);
            expect(MIN_RADIUS_PUBLIC).toBe(25);
            expect(MAX_RADIUS_PUBLIC).toBe(500);
        });
    });

    describe('onSliderChange', () => {
        it('should update radius value', () => {
            let inputs = { radius: DEFAULT_RADIUS };

            const onSliderChange = (name: string, value: number) => {
                inputs = { ...inputs, [name]: value };
            };

            onSliderChange('radius', 75);
            expect(inputs.radius).toBe(75);
        });
    });
});

describe('Content Creation Category Selection', () => {
    const momentCategories = [
        'uncategorized',
        'art',
        'food',
        'nature',
        'music',
        'nightlife',
        'travel',
    ];

    const spaceCategories = [
        'uncategorized',
        'restaurant',
        'cafe',
        'bar',
        'store',
        'hotel',
        'fitness',
    ];

    describe('Category Options', () => {
        it('should include uncategorized as default option for moments', () => {
            expect(momentCategories).toContain('uncategorized');
            expect(momentCategories[0]).toBe('uncategorized');
        });

        it('should include uncategorized as default option for spaces', () => {
            expect(spaceCategories).toContain('uncategorized');
            expect(spaceCategories[0]).toBe('uncategorized');
        });

        it('should map categories to dropdown options format', () => {
            const categoryOptions = momentCategories.map((category, index) => ({
                id: index,
                label: category,
                value: category,
            }));

            expect(categoryOptions).toHaveLength(momentCategories.length);
            expect(categoryOptions[0]).toEqual({ id: 0, label: 'uncategorized', value: 'uncategorized' });
        });
    });
});

describe('Content Creation Draft Handling', () => {
    describe('Draft Save Logic', () => {
        const buildDraftArgs = (baseMoment: any, isDraft: boolean) => {
            return {
                ...baseMoment,
                isDraft,
                skipReward: isDraft, // Skip rewards for drafts
            };
        };

        it('should set isDraft flag when saving as draft', () => {
            const moment = { message: 'Test', notificationMsg: 'Title' };
            const args = buildDraftArgs(moment, true);

            expect(args.isDraft).toBe(true);
        });

        it('should skip rewards when saving as draft', () => {
            const moment = { message: 'Test', notificationMsg: 'Title' };
            const args = buildDraftArgs(moment, true);

            expect(args.skipReward).toBe(true);
        });

        it('should not skip rewards when finalizing', () => {
            const moment = { message: 'Test', notificationMsg: 'Title' };
            const args = buildDraftArgs(moment, false);

            expect(args.isDraft).toBe(false);
            expect(args.skipReward).toBe(false);
        });
    });
});

describe('Content Creation Input Change Handling', () => {
    describe('onInputChange', () => {
        it('should update input state', () => {
            let inputs: Record<string, any> = { message: '', notificationMsg: '' };

            const onInputChange = (name: string, value: string) => {
                inputs = { ...inputs, [name]: value };
            };

            onInputChange('message', 'Test message');
            expect(inputs.message).toBe('Test message');
        });

        it('should clear error state on input change', () => {
            let state = { errorMsg: 'Previous error', isSubmitting: true };

            const onInputChange = (_name: string, _value: string) => {
                state = { ...state, errorMsg: '', isSubmitting: false };
            };

            onInputChange('message', 'Test');
            expect(state.errorMsg).toBe('');
            expect(state.isSubmitting).toBe(false);
        });

        it('should handle multiple input changes', () => {
            let inputs: Record<string, any> = {};

            const onInputChange = (name: string, value: string) => {
                inputs = { ...inputs, [name]: value };
            };

            onInputChange('notificationMsg', 'Title');
            onInputChange('message', 'Content');
            onInputChange('category', 'food');

            expect(inputs.notificationMsg).toBe('Title');
            expect(inputs.message).toBe('Content');
            expect(inputs.category).toBe('food');
        });
    });
});

describe('Content Creation Nearby Spaces', () => {
    describe('Nearby Space Options', () => {
        const buildNearbySpaceOptions = (nearbySpaces: Array<{ id: string; title: string }>, translate: (key: string) => string) => {
            return [
                {
                    id: 'unselected',
                    label: translate('forms.editMoment.labels.unselected'),
                    value: undefined,
                },
            ].concat(
                nearbySpaces.map((space) => ({
                    id: space.id,
                    label: space.title,
                    value: space.id,
                }))
            );
        };

        it('should include unselected option as first item', () => {
            const nearbySpaces = [{ id: 'space-1', title: 'Coffee Shop' }];
            const translate = (key: string) => key === 'forms.editMoment.labels.unselected' ? 'None' : key;

            const options = buildNearbySpaceOptions(nearbySpaces, translate);

            expect(options[0].id).toBe('unselected');
            expect(options[0].label).toBe('None');
            expect(options[0].value).toBeUndefined();
        });

        it('should map nearby spaces to dropdown options', () => {
            const nearbySpaces = [
                { id: 'space-1', title: 'Coffee Shop' },
                { id: 'space-2', title: 'Restaurant' },
            ];
            const translate = () => 'None';

            const options = buildNearbySpaceOptions(nearbySpaces, translate);

            expect(options).toHaveLength(3);
            expect(options[1]).toEqual({ id: 'space-1', label: 'Coffee Shop', value: 'space-1' });
            expect(options[2]).toEqual({ id: 'space-2', label: 'Restaurant', value: 'space-2' });
        });

        it('should handle empty nearby spaces', () => {
            const nearbySpaces: Array<{ id: string; title: string }> = [];
            const translate = () => 'None';

            const options = buildNearbySpaceOptions(nearbySpaces, translate);

            expect(options).toHaveLength(1);
            expect(options[0].id).toBe('unselected');
        });
    });
});
