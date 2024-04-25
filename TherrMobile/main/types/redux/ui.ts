import Immutable from 'seamless-immutable';

export interface IPrefetchState {
    isLoadingActiveEvents?: boolean;
    isLoadingActiveMoments?: boolean;
    isLoadingActiveSpaces?: boolean;
    isLoadingActiveThoughts?: boolean;
    isLoadingAchievements?: boolean;
    isLoadingUsers?: boolean;
    isLoadingGroups?: boolean;
}

export interface IUIState extends Immutable.ImmutableObject<any>{
    prefetch: IPrefetchState;
}

export enum UIActionTypes {
    PREFETCH_LOADING = 'prefetch_loading',
    PREFETCH_COMPLETE = 'prefech_complete',
}
