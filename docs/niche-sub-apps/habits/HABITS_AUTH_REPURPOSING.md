# HABITS Authentication & Profiles Repurposing

## Executive Summary

The Therr authentication system is **fully reusable** for HABITS with minimal changes. It supports OAuth (Google, Apple, Facebook), email/password authentication, JWT tokens, and comprehensive user profiles. The main work involves hiding irrelevant profile fields (location-based features) and potentially adding habit-specific preferences.

**Reuse Level**: 95% - Only UI simplification and field hiding needed

---

## Current Implementation

### Authentication Methods Supported

| Method | Handler | Mobile Component |
|--------|---------|------------------|
| Email/Password | `auth.ts:login()` | `LoginForm.tsx` |
| Google OAuth | `user.ts:validateCredentials()` | `GoogleSignInButton` |
| Apple Sign-In | `user.ts:validateCredentials()` | `AppleSignInButton` |
| Facebook OAuth | `user.ts:validateCredentials()` | (via SSO flow) |

### Authentication Flow

```
Mobile App
    ↓
POST /users-service/auth/login
    ↓
Validate credentials (password or OAuth token)
    ↓
Create JWT token (10-30 day expiration)
    ↓
Return user data + token
    ↓
Store in Redux + AsyncStorage
    ↓
Socket.IO connects with token
```

### JWT Token Structure

```typescript
{
  id: string,              // User UUID
  userName: string,
  email: string,
  phoneNumber: string,
  isBlocked: boolean,
  isSSO: boolean,
  accessLevels: string[],  // ['user.default', 'EMAIL_VERIFIED']
  organizations: object,
  integrations: object,
  iat: number,
  exp: number              // 10 days (default) or 30 days (remember me)
}
```

### Access Levels

| Level | Description |
|-------|-------------|
| `DEFAULT` | New unverified user |
| `EMAIL_VERIFIED` | Email verified, profile complete |
| `EMAIL_VERIFIED_MISSING_PROPERTIES` | Email verified, needs name/phone |
| `MOBILE_VERIFIED` | Phone number verified |
| `DASHBOARD_SIGNUP` | Business dashboard access |

---

## Database Schema

### Users Table (Relevant Fields)

```sql
-- Core Identity
id UUID PRIMARY KEY
email VARCHAR UNIQUE NOT NULL
userName VARCHAR UNIQUE
firstName VARCHAR
lastName VARCHAR
displayName VARCHAR
phoneNumber VARCHAR(24) UNIQUE
password VARCHAR NOT NULL  -- bcrypt hashed

-- Authentication
accessLevels JSONB DEFAULT ['user.default']
verificationCodes JSONB DEFAULT {email: {}, mobile: {}}
integrationsAccess TEXT  -- Encrypted OAuth tokens
isBlocked BOOLEAN DEFAULT false
hasAgreedToTerms BOOLEAN DEFAULT false
oneTimePassword VARCHAR  -- For password reset

-- Profile Settings
settingsBio TEXT
settingsWebsite VARCHAR
settingsThemeName VARCHAR DEFAULT 'retro'
settingsIsProfilePublic BOOLEAN DEFAULT true
media JSONB  -- Profile picture

-- Location (TO HIDE FOR HABITS)
lastKnownLatitude DOUBLE
lastKnownLongitude DOUBLE
lastKnownLocation POINT

-- Business (TO HIDE FOR HABITS)
isBusinessAccount BOOLEAN DEFAULT false
isCreatorAccount BOOLEAN DEFAULT false
userAdministratorForumIds TEXT
userInvitedForumIds TEXT

-- Notification Preferences
settingsEmailMarketing BOOLEAN
settingsEmailInvites BOOLEAN
settingsEmailLikes BOOLEAN
settingsPushMarketing BOOLEAN
settingsPushInvites BOOLEAN
settingsPushReminders BOOLEAN
deviceMobileFirebaseToken VARCHAR

-- Engagement
loginCount INTEGER DEFAULT 0
createdAt TIMESTAMP
updatedAt TIMESTAMP
```

---

## Key Files & Code Paths

### Backend (users-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/handlers/auth.ts` | Login/logout/verify | `login()`, `logout()`, `verifyToken()` |
| `src/handlers/users.ts` | Registration/profile CRUD | `createUser()`, `updateUser()`, `getMe()` |
| `src/handlers/helpers/user.ts` | OAuth validation | `validateCredentials()`, `createUserHelper()` |
| `src/utilities/userHelpers.ts` | Token/password utils | `createUserToken()`, `hashPassword()` |
| `src/store/UsersStore.ts` | Database queries | SQL via Knex |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/routes/Login/index.tsx` | Login screen container |
| `main/routes/Login/LoginForm.tsx` | Login form with OAuth buttons |
| `main/routes/Register/index.tsx` | Registration screen |
| `main/routes/Register/RegisterForm.tsx` | Registration form |
| `main/components/GoogleSignInButton.tsx` | Google OAuth button |
| `main/components/AppleSignInButton.tsx` | Apple Sign-In button |

### Shared Library (therr-react)

| File | Purpose |
|------|---------|
| `src/redux/actions/Users.ts` | Auth Redux actions |
| `src/services/UsersService.ts` | API client methods |

---

## API Endpoints

### Authentication

```
POST /users-service/auth/login
  Body: { userName?, userEmail?, phoneNumber?, password, rememberMe? }
  Response: { id, email, accessLevels, idToken, ... }

POST /users-service/auth/logout
  Headers: Authorization: Bearer <token>

POST /users-service/auth/verify-token
  Body: { idToken }
  Response: { valid: boolean, decoded?: TokenPayload }
```

### User Management

```
POST /users-service/users
  Body: { email, password, userName?, firstName?, lastName?, phoneNumber? }
  Response: { id, email, ... }

GET /users-service/users/me
  Headers: Authorization: Bearer <token>
  Response: { user, userSettings }

PUT /users-service/users/:id
  Body: { firstName?, lastName?, settingsBio?, ... }
  Response: { user }

POST /users-service/users/verify-account/:token
  Response: { user with EMAIL_VERIFIED }

POST /users-service/users/one-time-password
  Body: { email }
  Response: { success, message }
```

---

## Mobile Components

### Login Screen Structure

```
LoginForm
├── Email/Username Input
├── Password Input
├── "Forgot Password" Link
├── Login Button
├── OAuth Section
│   ├── GoogleSignInButton
│   └── AppleSignInButton (iOS only)
└── "Create Account" Link
```

### Registration Screen Structure

```
RegisterForm
├── Email Input
├── Username Input (optional)
├── Password Input
├── Confirm Password Input
├── Phone Number Input (optional)
├── Terms Agreement Checkbox
├── Register Button
└── OAuth Section (same as login)
```

---

## Repurposing for HABITS

### Fields to HIDE (via feature flags or UI removal)

**Location Fields** - Not needed for habit tracking:
- `lastKnownLatitude`
- `lastKnownLongitude`
- `lastKnownLocation`

**Business/Creator Fields** - Simplify to regular users:
- `isBusinessAccount`
- `isCreatorAccount`
- `isSuperUser`

**Forum/Content Fields** - Not used in HABITS:
- `userAdministratorForumIds`
- `userInvitedForumIds`
- `userRecentForumIds`

**Currency Fields** - Replace with streak system:
- `settingsTherrCoinTotal`
- `settingsAreaCoinTotal`

### Fields to Keep As-Is

- All authentication fields (email, password, OAuth)
- Basic profile (name, bio, website, profile picture)
- All notification preference fields
- Theme preferences

### Fields to ADD (Optional)

```sql
-- Habit Preferences
settingsPreferredReminderTime TIME  -- Daily reminder time
settingsTimezone VARCHAR(50)         -- For scheduling
settingsHabitCategories JSONB        -- Preferred habit types
settingsWeekStartDay INTEGER         -- 0=Sunday, 1=Monday

-- Gamification
currentLongestStreak INTEGER DEFAULT 0
allTimeLongestStreak INTEGER DEFAULT 0
totalHabitsCompleted INTEGER DEFAULT 0
```

---

## Implementation Checklist

### Phase 1: No-Code Changes (Feature Flags)
- [ ] Add feature flag: `HIDE_LOCATION_FIELDS`
- [ ] Add feature flag: `HIDE_BUSINESS_FEATURES`
- [ ] Add feature flag: `HIDE_CURRENCY_DISPLAY`
- [ ] Configure HABITS brand to use these flags

### Phase 2: Mobile UI Simplification
- [ ] Remove location permission requests from onboarding
- [ ] Hide business account toggle in settings
- [ ] Hide TherrCoin display in profile
- [ ] Simplify registration form (email + password only initially)

### Phase 3: Profile Enhancements (Optional)
- [ ] Add `settingsPreferredReminderTime` field migration
- [ ] Add `settingsTimezone` field migration
- [ ] Add timezone picker to settings screen
- [ ] Add reminder time picker to settings screen

### Phase 4: Onboarding Flow
- [ ] Create HABITS-specific onboarding screens
- [ ] Add "Invite Partner" as mandatory step after registration
- [ ] Skip location permissions entirely
- [ ] Focus on habit preference selection

---

## Code Snippets

### Feature Flag Check (Mobile)

```typescript
// In TherrMobile/main/routes/Settings/index.tsx
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';

const Settings = () => {
  const { isEnabled } = useFeatureFlags();

  return (
    <View>
      {!isEnabled('HIDE_LOCATION_FIELDS') && (
        <LocationSettingsSection />
      )}
      {!isEnabled('HIDE_BUSINESS_FEATURES') && (
        <BusinessAccountToggle />
      )}
      {/* Always show for HABITS */}
      <NotificationSettings />
      <ProfileSettings />
    </View>
  );
};
```

### Simplified Registration (Backend)

```typescript
// No changes needed - existing endpoint handles minimal registration
// Just ensure mobile only sends required fields:
{
  email: 'user@example.com',
  password: 'securePassword123',
  hasAgreedToTerms: true
}
// Optional fields (firstName, lastName, phoneNumber) can be added later
```

---

## Migration Notes

### Database
- No schema changes required for MVP
- Optional fields can be added via migration when needed
- Existing users table supports all HABITS requirements

### API
- All endpoints remain unchanged
- Client controls which fields to display/edit
- Feature flags control UI visibility

### Mobile
- Reuse existing Login/Register screens
- Apply HABITS branding via theme
- Hide irrelevant sections via feature flags

---

## Security Considerations

All existing security measures apply:
- bcrypt password hashing (10 salt rounds)
- JWT with HS256 signing
- OAuth token validation via provider SDKs
- Rate limiting on auth endpoints
- Email verification requirement

No additional security work needed for HABITS.
