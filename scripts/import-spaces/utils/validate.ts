/**
 * Validates space data before insert.
 */
import { ISpaceInsertParams } from '../transforms/mapToSpace';

export interface IValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSpace(space: ISpaceInsertParams): IValidationResult {
  const errors: string[] = [];

  if (!space.notificationMsg || space.notificationMsg.trim().length === 0) {
    errors.push('Missing name (notificationMsg)');
  }

  if (!space.latitude || !space.longitude) {
    errors.push('Missing coordinates');
  }

  if (space.latitude < -90 || space.latitude > 90) {
    errors.push(`Invalid latitude: ${space.latitude}`);
  }

  if (space.longitude < -180 || space.longitude > 180) {
    errors.push(`Invalid longitude: ${space.longitude}`);
  }

  if (!space.message || space.message.trim().length === 0) {
    errors.push('Missing message');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
