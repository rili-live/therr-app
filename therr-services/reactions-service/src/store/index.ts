import connection, { IConnection } from './connection';
import EventReactionsStore from './EventReactionsStore';
import MomentReactionsStore from './MomentReactionsStore';
import SpaceReactionsStore from './SpaceReactionsStore';
import ThoughtReactionsStore from './ThoughtReactionsStore';
import UserListsStore from './UserListsStore';
import UserListItemsStore from './UserListItemsStore';

class Store {
    db: IConnection;

    eventReactions: EventReactionsStore;

    momentReactions: MomentReactionsStore;

    spaceReactions: SpaceReactionsStore;

    thoughtReactions: ThoughtReactionsStore;

    userLists: UserListsStore;

    userListItems: UserListItemsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.eventReactions = new EventReactionsStore(this.db);

        this.momentReactions = new MomentReactionsStore(this.db);

        this.spaceReactions = new SpaceReactionsStore(this.db);

        this.thoughtReactions = new ThoughtReactionsStore(this.db);

        this.userLists = new UserListsStore(this.db);

        this.userListItems = new UserListItemsStore(this.db);
    }
}

export default new Store(connection);
