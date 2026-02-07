import ApiService from './ApiService';
import CampaignsService from './CampaignsService';
import ForumsService from './ForumsService';
import MapsService,
{
    IPlacesAutoCompleteArgs,
    IPlaceDetailsArgs,
    IGetSpaceEngagementArgs,
    IGetSpaceMetricsArgs,
} from './MapsService';
import MessagesService from './MessagesService';
import NotificationsService from './NotificationsService';
import PushNotificationsService from './PushNotificationsService';
import ReactionsService from './ReactionsService';
import UserConnectionsService from './UserConnectionsService';
import UsersService from './UsersService';
// HABITS services
import HabitGoalsService, { ICreateHabitGoalBody, IUpdateHabitGoalBody } from './HabitGoalsService';
import PactsService, { ICreatePactBody } from './PactsService';
import HabitCheckinsService, { ICreateCheckinBody, IUpdateCheckinBody } from './HabitCheckinsService';
import StreaksService from './StreaksService';

export {
    ApiService,
    CampaignsService,
    ForumsService,
    MapsService,
    IGetSpaceEngagementArgs,
    IGetSpaceMetricsArgs,
    IPlacesAutoCompleteArgs,
    IPlaceDetailsArgs,
    MessagesService,
    NotificationsService,
    PushNotificationsService,
    ReactionsService,
    UserConnectionsService,
    UsersService,
    // HABITS services
    HabitGoalsService,
    ICreateHabitGoalBody,
    IUpdateHabitGoalBody,
    PactsService,
    ICreatePactBody,
    HabitCheckinsService,
    ICreateCheckinBody,
    IUpdateCheckinBody,
    StreaksService,
};
