# Claude Code Instructions - therr-client-web-dashboard

## Package Overview

- **Port**: 7071
- **Type**: React admin dashboard with SSR
- **Purpose**: Business/admin dashboard for campaign management, spaces, analytics
- **Features**: Campaign CRUD, space management, customer acquisition, influencer pairings

## Directory Structure

```
src/
├── components/
│   ├── Layout.tsx             # Main wrapper (nav, sidebar, footer)
│   ├── Sidebar.tsx            # Navigation sidebar with access control
│   ├── DashboardNavbar.tsx    # Top navigation
│   ├── forms/                 # Form components (12 files)
│   ├── nav-menu/              # Navigation menus
│   ├── charts/                # Chart visualizations
│   └── widgets/               # Reusable widgets
├── routes/
│   ├── index.tsx              # Route config (getRoutes factory)
│   ├── Dashboards/
│   │   ├── DashboardOverview.tsx        # User dashboard
│   │   ├── AdminDashboardOverview.tsx   # Admin metrics
│   │   └── OverviewModules/             # Dashboard widgets
│   ├── Campaigns/
│   │   ├── CampaignsOverview.tsx
│   │   ├── CreateEditCampaign.tsx
│   │   └── CampaignPerformance.tsx
│   ├── ManageSpaces/
│   ├── CustomerAcquisition/
│   ├── InfluencerPairings/
│   └── Documentation/
├── redux/
│   ├── actions/
│   │   └── UsersActions.ts    # Extends therr-react
│   └── reducers/
│       └── index.ts           # Uses getCombinedReducers
├── api/
│   ├── login.ts               # Facebook OAuth
│   └── facebook.ts
├── utilities/
│   └── getHostContext.ts      # Multi-tenant brand detection
├── styles/
│   ├── volt/                  # Volt theme framework
│   ├── components/
│   └── pages/
├── server-client.tsx          # Express SSR
├── store.tsx                  # Redux configuration
└── interceptors.ts            # Axios config
```

## Key Routes

| Route | Feature | Access |
|-------|---------|--------|
| `/dashboard` | User dashboard | EMAIL_VERIFIED |
| `/dashboard-admin` | Admin dashboard | SUPER_ADMIN |
| `/campaigns/overview` | Campaign list | EMAIL_VERIFIED |
| `/campaigns/create` | Create campaign | EMAIL_VERIFIED + MOBILE_VERIFIED |
| `/campaigns/:id/edit` | Edit campaign | EMAIL_VERIFIED + MOBILE_VERIFIED |
| `/campaigns/:id/view-results` | Performance | EMAIL_VERIFIED |
| `/spaces` | Manage spaces | EMAIL_VERIFIED + MOBILE_VERIFIED |
| `/claim-a-space` | Claim business | EMAIL_VERIFIED + MOBILE_VERIFIED |
| `/influencer-pairings` | Influencer discovery | EMAIL_VERIFIED |
| `/settings` | Account settings | EMAIL_VERIFIED |

## Key Patterns

### Access Control

Routes define access requirements:

```typescript
{
    path: '/campaigns-admin/overview',
    access: {
        type: AccessCheckType.ALL,
        levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
    },
    component: AdminCampaignsOverview,
}
```

### Multi-Tenant Brand Context

```typescript
// src/utilities/getHostContext.ts
// Detects hostname → determines brand variant
// Sets x-brand-variation header in requests
```

### Redux Extension

Same pattern as web client:

```typescript
import getCombinedReducers from 'therr-react/redux/reducers';
import { socketIO } from '../../socket-io-middleware';

export default getCombinedReducers(socketIO, {});
```

### Dashboard Variants

Base components with role-specific wrappers:
- `BaseDashboard.tsx` - Shared logic
- `DashboardOverview.tsx` - User view
- `AdminDashboardOverview.tsx` - Admin view

### Campaign Management

- `CreateEditCampaign.tsx` - Large form with validation
- Supports campaign assets (text, images, video)
- OAuth integration for Facebook/Instagram targeting

## Build & Dev

```bash
npm run dev           # Development with watch
npm run build         # Production build
npm start             # Start SSR server
npm test              # Run tests
```

## Important Notes

- Brand variation: `BrandVariations.DASHBOARD_THERR`
- Uses Volt theme framework (Bootstrap-based)
- OAuth2 landing page for social integrations
- Stripe payment callback handling
- Admin routes require `SUPER_ADMIN` access level
