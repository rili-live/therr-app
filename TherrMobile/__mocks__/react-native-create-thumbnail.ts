// Mock so capture utilities can be unit-tested without the native module.
export const createThumbnail = jest.fn(() =>
    Promise.resolve({ path: 'file:///tmp/mock-thumbnail.jpg', width: 100, height: 100 }));

export default { createThumbnail };
