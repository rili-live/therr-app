# Claude Code Instructions - therr-react

## Package Overview

- **Type**: Shared React library
- **Purpose**: Components, Redux state, API services shared between web and mobile
- **Consumers**: therr-client-web, therr-client-web-dashboard, TherrMobile

## Directory Structure

```
src/
├── components/
│   ├── forms/              # Form inputs with validation
│   │   ├── Input.tsx
│   │   ├── ButtonPrimary.tsx
│   │   ├── CheckBox.tsx
│   │   └── ...
│   ├── routing/            # Auth-aware route components
│   │   ├── AuthRoute.tsx
│   │   └── RedirectWithStatus.tsx
│   ├── AccessControl.tsx   # Permission-based rendering
│   └── PaginationControls.tsx
├── redux/
│   ├── actions/            # Async action creators
│   │   ├── UsersActions.ts
│   │   ├── ContentActions.ts
│   │   ├── CampaignActions.ts
│   │   └── ...
│   └── reducers/           # State reducers
│       ├── user.ts
│       ├── content.ts
│       └── index.ts        # combineReducers
├── services/               # API service clients
│   ├── UsersService.ts
│   ├── MapsService.ts
│   ├── MessagesService.ts
│   └── ...
├── types/                  # TypeScript definitions
│   └── redux/              # State shape types
├── constants/              # Validation rules
├── svg-icons/              # SVG icon library
├── wrappers/               # HOCs
└── index.js                # Export configuration
```

## Key Patterns

### Redux Actions

Actions are classes with methods that dispatch async thunks:

```typescript
import { UsersActions } from 'therr-react/redux/actions';

// Actions receive socket instance for real-time updates
const usersActions = new UsersActions(socketIO);

// In component
dispatch(usersActions.login(credentials));
dispatch(usersActions.search({ query: 'john' }));
```

### Redux Reducers

Combined reducer factory for consistent state shape:

```typescript
import getCombinedReducers from 'therr-react/redux/reducers';

// Returns combined reducer with: user, content, map, notifications, etc.
const rootReducer = getCombinedReducers();
```

### API Services

Singleton service classes using axios:

```typescript
import { UsersService, MapsService } from 'therr-react/services';

// Services export singleton instances
UsersService.authenticate(credentials);
MapsService.searchSpaces({ query: 'coffee' });
```

### Form Components

Class components with built-in validation:

```typescript
import { Input, ButtonPrimary } from 'therr-react/components';

<Input
    type="email"
    validations={['email', 'isRequired']}
    onChange={handleChange}
/>
```

Available validations: `email`, `isRequired`, `lettersOnly`, `numbersOnly`, `password`, `mobilePhoneNumber`

### Access Control

Render components conditionally based on user access:

```typescript
import { AccessControl } from 'therr-react/components';
import { AccessCheckType } from 'therr-react/types';

<AccessControl
    isAuthorized={isAdmin}
    publicComponent={<LoginPrompt />}
>
    <AdminPanel />
</AccessControl>
```

### Auth Routes (Web)

Protected routes with redirect:

```typescript
import { AuthRoute } from 'therr-react/components/routing';

<AuthRoute
    path="/dashboard"
    isAuthorized={user.isAuthenticated}
    redirectPath="/login"
>
    <Dashboard />
</AuthRoute>
```

## State Shape

Key state slices:

```typescript
interface IUserState {
    details: IUser;
    settings: IUserSettings;
    isAuthenticated: boolean;
    achievements: Record<string, IAchievement>;
    thoughts: IThought[];
}

interface IContentState {
    areas: IArea[];
    events: IEvent[];
    thoughts: IThought[];
    activeMoments: IMoment[];
}

interface IMapState {
    spaces: ISpace[];
    searchResults: ISearchResult[];
}
```

## Build & Distribution

- Built via webpack into `/lib/` directory
- UMD modules for web and React Native compatibility
- CSS bundled for form components

```bash
npm run build        # Production build
npm run build:dev    # Development build
npm run build:watch  # Watch mode
```

### Import Patterns

```typescript
// Components
import { Input, ButtonPrimary } from 'therr-react/components';

// Redux
import { UsersActions } from 'therr-react/redux/actions';
import getCombinedReducers from 'therr-react/redux/reducers';

// Services
import { UsersService } from 'therr-react/services';

// Types
import { IUserState, AccessCheckType } from 'therr-react/types';
```

## Adding New Features

### New Action Class

```typescript
// src/redux/actions/NewFeatureActions.ts
export default class NewFeatureActions {
    constructor(socketIO?) {
        this.socketIO = socketIO;
    }

    fetch = (params) => (dispatch) => {
        dispatch({ type: 'FETCH_PENDING' });
        return NewFeatureService.fetch(params)
            .then((response) => {
                dispatch({ type: 'FETCH_SUCCESS', data: response.data });
            });
    };
}

// Export from src/redux/actions/index.ts
```

### New Service

```typescript
// src/services/NewFeatureService.ts
class NewFeatureService {
    fetch(params) {
        return axios.get('/api/new-feature', { params });
    }
}

export default new NewFeatureService();

// Export from src/services/index.ts
```

## Important Notes

- **Platform agnostic**: Components must work in both React (web) and React Native contexts, or have platform variants
- **Seamless Immutable**: Redux state uses `seamless-immutable` library
- **Storage abstraction**: Supports localStorage (web) and AsyncStorage (mobile)
- Changes require rebuilding consuming packages (web, dashboard, mobile)
