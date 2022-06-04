import connection, { IConnection } from './connection';
import ExternalMediaIntegrationsStore from './ExternalMediaIntegrationsStore';
import MediaStore from './MediaStore';
import MomentsStore from './MomentsStore';
import SpacesStore from './SpacesStore';

class Store {
    db: IConnection;

    externalMediaIntegrations: ExternalMediaIntegrationsStore;

    media: MediaStore;

    moments: MomentsStore;

    spaces: SpacesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.externalMediaIntegrations = new ExternalMediaIntegrationsStore(this.db);

        this.media = new MediaStore(this.db);

        this.moments = new MomentsStore(this.db, this.media);

        this.spaces = new SpacesStore(this.db, this.media);
    }
}

export default new Store(connection);
