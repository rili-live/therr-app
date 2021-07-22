import * as Immutable from 'seamless-immutable';

export interface IReactionsState extends Immutable.ImmutableObject<any> {
    myReactions: any;
}

export enum ReactionActionTypes {
    GET_MOMENT_REACTIONS = 'GET_MOMENT_REACTIONS',
    MOMENT_REACTION_CREATED_OR_UPDATED = 'MOMENT_REACTION_CREATED_OR_UPDATED',
}
