import connection, { IConnection } from './connection';
import EventReactionsStore from './EventReactionsStore';
import MomentReactionsStore from './MomentReactionsStore';
import SpaceReactionsStore from './SpaceReactionsStore';
import ThoughtReactionsStore from './ThoughtReactionsStore';

class Store {
    db: IConnection;

    eventReactions: EventReactionsStore;

    momentReactions: MomentReactionsStore;

    spaceReactions: SpaceReactionsStore;

    thoughtReactions: ThoughtReactionsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.eventReactions = new EventReactionsStore(this.db);

        this.momentReactions = new MomentReactionsStore(this.db);

        this.spaceReactions = new SpaceReactionsStore(this.db);

        this.thoughtReactions = new ThoughtReactionsStore(this.db);
    }
}

export default new Store(connection);
