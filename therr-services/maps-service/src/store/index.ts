import connection, { IConnection } from './connection';
import MediaStore from './MediaStore';
import MomentsStore from './MomentsStore';

class Store {
    db: IConnection;

    media: MediaStore;

    moments: MomentsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.media = new MediaStore(this.db);

        this.moments = new MomentsStore(this.db, this.media);
    }
}

export default new Store(connection);
