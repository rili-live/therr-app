import connection, { IConnection } from './connection';
import MediaStore from './MediaStore';
import MomentsStore from './MomentsStore';
import SpacesStore from './SpacesStore';

class Store {
    db: IConnection;

    media: MediaStore;

    moments: MomentsStore;

    spaces: SpacesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.media = new MediaStore(this.db);

        this.moments = new MomentsStore(this.db, this.media);

        this.spaces = new SpacesStore(this.db, this.media);
    }
}

export default new Store(connection);
