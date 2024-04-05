import { eventCategories } from '../routes/EditEvent';
import { momentCategories } from '../routes/EditMoment';
import { spaceCategories } from '../routes/EditSpace';
import { thoughtCategories } from '../routes/EditThought';

const allCategories: string[] = [...new Set([...eventCategories, ...momentCategories, ...spaceCategories, ...thoughtCategories])];

const SELECT_ALL = 'selectAll';

export {
    allCategories,
    SELECT_ALL,
};
