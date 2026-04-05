import connection, { IConnection } from './connection';
import EventsStore from './EventsStore';
import ExternalMediaIntegrationsStore from './ExternalMediaIntegrationsStore';
import MediaStore from './MediaStore';
import MomentsStore from './MomentsStore';
import SpacesStore from './SpacesStore';
import SpaceMetricsStore from './SpaceMetricsStore';
import SpaceIncentivesStore from './SpaceIncentivesStore';
import SpaceIncentiveCouponsStore from './SpaceIncentiveCouponsStore';
import SpacePairingFeedbackStore from './SpacePairingFeedbackStore';
import SpaceDisplayRequestsStore from './SpaceDisplayRequestsStore';

class Store {
    db: IConnection;

    events: EventsStore;

    externalMediaIntegrations: ExternalMediaIntegrationsStore;

    media: MediaStore;

    moments: MomentsStore;

    spaces: SpacesStore;

    spaceMetrics: SpaceMetricsStore;

    spaceIncentives: SpaceIncentivesStore;

    spaceIncentiveCoupons: SpaceIncentiveCouponsStore;

    spacePairingFeedback: SpacePairingFeedbackStore;

    spaceDisplayRequests: SpaceDisplayRequestsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.externalMediaIntegrations = new ExternalMediaIntegrationsStore(this.db);

        this.media = new MediaStore(this.db);

        this.events = new EventsStore(this.db, this.media);

        this.moments = new MomentsStore(this.db, this.media);

        this.spaces = new SpacesStore(this.db, this.media);

        this.spaceMetrics = new SpaceMetricsStore(this.db);

        this.spaceIncentives = new SpaceIncentivesStore(this.db);

        this.spaceIncentiveCoupons = new SpaceIncentiveCouponsStore(this.db);

        this.spacePairingFeedback = new SpacePairingFeedbackStore(this.db);

        this.spaceDisplayRequests = new SpaceDisplayRequestsStore(this.db);
    }
}

export default new Store(connection);
