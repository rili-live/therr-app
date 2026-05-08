export interface IPrefetchState {
    isLoadingActiveEvents?: boolean;
    isLoadingActiveMoments?: boolean;
    isLoadingActiveSpaces?: boolean;
    isLoadingActiveThoughts?: boolean;
    isLoadingAchievements?: boolean;
    isLoadingUsers?: boolean;
    isLoadingGroups?: boolean;
}

export interface ISoftOptInPushRequest {
    titleKey?: string;
    bodyKey?: string;
}

export interface IUIState {
    prefetch: IPrefetchState;
    pendingSoftOptInPush: ISoftOptInPushRequest | null;
}

export enum UIActionTypes {
    PREFETCH_LOADING = 'prefetch_loading',
    PREFETCH_COMPLETE = 'prefech_complete',
    REQUEST_SOFT_OPT_IN_PUSH = 'request_soft_opt_in_push',
    CLEAR_SOFT_OPT_IN_PUSH = 'clear_soft_opt_in_push',
}
