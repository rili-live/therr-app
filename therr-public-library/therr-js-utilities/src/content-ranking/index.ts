export {
    ContentAlgorithms,
    CONTENT_ALGORITHM_VALUES,
    DEFAULT_CONTENT_ALGORITHM,
    isContentAlgorithm,
    normalizeContentAlgorithm,
} from './algorithms';
export type { IAlgorithmProfile, IAlgorithmWeights } from './algorithms';

export {
    boolFromEnv,
    getAlgorithmProfile,
    getAllAlgorithmProfiles,
    getDefaultAlgorithmProfile,
    numberFromEnv,
} from './profiles';

export {
    applyAuthorDiversity,
    getGeoTerm,
    getHotnessTerm,
    getInterestTerm,
    rankByScore,
    scoreContent,
} from './score';
export type { IScoreComponents } from './score';

export {
    getAgeHoursSqlExpression,
    getGeoSqlExpression,
    getHotnessSqlExpression,
    getScoreSqlExpression,
} from './sql-score';
export type { ISqlScoreColumns } from './sql-score';
