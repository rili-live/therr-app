import connection, { IConnection } from './connection';
import CategoriesStore from './CategoriesStore';
import DirectMessagesStore from './DirectMessagesStore';
import ForumsStore from './ForumsStore';
import ForumMessagesStore from './ForumMessagesStore';

class Store {
    db: IConnection;

    categories: CategoriesStore;

    directMessages: DirectMessagesStore;

    forums: ForumsStore;

    forumMessages: ForumMessagesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.categories = new CategoriesStore(this.db);
        this.directMessages = new DirectMessagesStore(this.db);
        this.forums = new ForumsStore(this.db);
        this.forumMessages = new ForumMessagesStore(this.db);
    }
}

export default new Store(connection);
