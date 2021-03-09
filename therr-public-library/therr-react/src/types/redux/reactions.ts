import * as Immutable from 'seamless-immutable';

export interface IReactionsState extends Immutable.ImmutableObject<any> {
    myReactions: any;
}

export enum ReactionActionTypes {
    MOMENT_REACTION_CREATED = 'MOMENT_REACTION_CREATED',
    GET_MOMENT_REACTIONS = 'GET_MOMENT_REACTIONS',
    MOMENT_REACTION_UPDATED = 'MOMENT_REACTION_UPDATED',
}
