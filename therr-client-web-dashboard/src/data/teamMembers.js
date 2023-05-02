import { faCalendarCheck, faComment } from '@fortawesome/free-solid-svg-icons';

const Profile1 = '/assets/img/team/profile-picture-1.jpg';
const Profile2 = '/assets/img/team/profile-picture-2.jpg';
const Profile3 = '/assets/img/team/profile-picture-3.jpg';
const Profile4 = '/assets/img/team/profile-picture-4.jpg';

export default [
    {
        id: 1,
        image: Profile1,
        name: 'Christopher Wood',
        statusKey: 'online',
        icon: faCalendarCheck,
        btnText: 'Invite',
    },
    {
        id: 2,
        image: Profile2,
        name: 'Jose Leos',
        statusKey: 'inMeeting',
        icon: faComment,
        btnText: 'Message',
    },
    {
        id: 3,
        image: Profile3,
        name: 'Bonnie Green',
        statusKey: 'offline',
        icon: faCalendarCheck,
        btnText: 'Invite',
    },
    {
        id: 4,
        image: Profile4,
        name: 'Neil Sims',
        statusKey: 'online',
        icon: faComment,
        btnText: 'Message',
    },
];
