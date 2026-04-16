import {
    body,
    header,
    param,
    query,
} from 'express-validator';

export const createUserListValidation = [
    header('x-userid').exists(),
    body('name').isString().isLength({ min: 1, max: 120 }),
    body('description').optional(),
    body('iconName').optional().isString(),
    body('colorHex').optional().isString().isLength({ max: 7 }),
    body('isPublic').optional().isBoolean(),
    body('isDefault').optional().isBoolean(),
];

export const getUserListsValidation = [
    header('x-userid').exists(),
    query('withPreviews').optional(),
];

export const getUserListByIdValidation = [
    header('x-userid').exists(),
    param('listId').isUUID(),
    query('limit').optional().isNumeric(),
    query('offset').optional().isNumeric(),
];

export const updateUserListValidation = [
    header('x-userid').exists(),
    param('listId').isUUID(),
    body('name').optional().isString().isLength({ min: 1, max: 120 }),
    body('description').optional(),
    body('iconName').optional().isString(),
    body('colorHex').optional().isString().isLength({ max: 7 }),
    body('isPublic').optional().isBoolean(),
    body('isDefault').optional().isBoolean(),
];

export const deleteUserListValidation = [
    header('x-userid').exists(),
    param('listId').isUUID(),
];

export const addSpaceToListValidation = [
    header('x-userid').exists(),
    param('listId').isUUID(),
    body('spaceId').isUUID(),
];

export const removeSpaceFromListValidation = [
    header('x-userid').exists(),
    param('listId').isUUID(),
    param('spaceId').isUUID(),
];

export const getListsForSpaceValidation = [
    header('x-userid').exists(),
    param('spaceId').isUUID(),
];
