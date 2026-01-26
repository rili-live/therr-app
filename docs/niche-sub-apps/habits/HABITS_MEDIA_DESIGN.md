# HABITS Media Design (Proof Uploads)

## Executive Summary

The Therr media system uses Google Cloud Storage with signed URLs for secure uploads. Content is moderated via Sightengine API. For HABITS, we repurpose this for "proof uploads" - photos/videos that verify habit completion. The existing infrastructure is fully reusable with minor additions for proof-specific verification.

**Reuse Level**: 90% - Full infrastructure reusable, add proof verification workflow

---

## Current Implementation

### Upload Flow

```
Mobile App
    ↓
GET /maps-service/moments/signed-url/public?action=write&filename=photo.jpg
    ↓
Generate signed URL (Google Cloud Storage v4)
    ↓
Return { url, path }
    ↓
Mobile uploads file directly to GCS
    ↓
POST /maps-service/moments (with media paths)
    ↓
Async content safety check (Sightengine)
    ↓
Store moment with media references
```

### Signed URL Generation

```typescript
// maps-service/src/handlers/helpers/index.ts
const fetchSignedUrl = async (
  userId: string,
  requestId: string,
  filename: string,
  bucket: string,
  action: 'read' | 'write'
): Promise<[string, string]> => {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const filePath = `${userId}/${baseName}_${requestId}${ext}`;

  const options = {
    version: 'v4' as const,
    action,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes for write
  };

  const [url] = await storage
    .bucket(bucket)
    .file(filePath)
    .getSignedUrl(options);

  return [url, filePath];
};
```

### Storage Buckets

```bash
# Environment Variables
BUCKET_PUBLIC_USER_DATA=dev-therr-public-user-data
BUCKET_PRIVATE_USER_DATA=dev-therr-private-user-data
```

---

## Database Schema

### Media Table

```sql
CREATE TABLE main.media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fromUserId UUID NOT NULL REFERENCES users(id),
    altText VARCHAR DEFAULT '',
    type VARCHAR NOT NULL,
    path VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_user ON media(fromUserId);
```

### Media Types

```typescript
// therr-js-utilities/src/constants/Content.ts
const mediaTypes = {
  USER_IMAGE_PUBLIC: 'user-image-public',
  USER_IMAGE_PRIVATE: 'user-image-private',
};
```

### Content Media Reference

Two approaches in current codebase:

**Legacy (moments.mediaIds)**
```sql
mediaIds TEXT DEFAULT ''  -- Comma-separated UUIDs: "abc123,def456"
```

**New (moments.medias)**
```sql
medias JSONB  -- [{path: "user/...", type: "user-image-public"}]
```

---

## Key Files & Code Paths

### Backend (maps-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/handlers/helpers/index.ts` | URL generation | `fetchSignedUrl()`, `checkIsMediaSafeForWork()` |
| `src/store/MediaStore.ts` | Media CRUD | `create()`, `getByIds()` |
| `src/handlers/moments.ts` | Uses media | `createMoment()` line 163-349 |

### Mobile (therr-react)

| File | Purpose |
|------|---------|
| `src/services/MapsService.ts` | API client for signed URLs |

---

## API Endpoints

### Get Signed URL

```
GET /maps-service/{areaType}/signed-url/{bucket}
  Query: {
    action: 'read' | 'write',
    filename: string
  }
  Headers: Authorization: Bearer <token>
  Response: { url: string, path: string }

Buckets:
  - public: BUCKET_PUBLIC_USER_DATA
  - private: BUCKET_PRIVATE_USER_DATA
```

### Direct Upload to GCS

```
PUT {signedUrl}
  Headers: Content-Type: image/jpeg
  Body: <file binary>
  Response: 200 OK (from Google Cloud Storage)
```

---

## Content Safety (Sightengine)

### Implementation

```typescript
// maps-service/src/handlers/helpers/index.ts
const checkIsMediaSafeForWork = async (signedUrl: string): Promise<boolean> => {
  try {
    const response = await axios.get(
      'https://api.sightengine.com/1.0/check-workflow.json',
      {
        params: {
          url: signedUrl,
          workflow: process.env.SIGHTENGINE_WORKFLOW_ID,
          api_user: process.env.SIGHTENGINE_API_KEY,
          api_secret: process.env.SIGHTENGINE_API_SECRET,
        },
      }
    );

    return response.data?.summary?.action === 'accept';
  } catch (error) {
    console.error('Sightengine check failed:', error);
    return false; // Default to unsafe on error
  }
};
```

### Sightengine Models Available

- `nudity` - Detect nudity/NSFW content
- `wad` - Weapons, alcohol, drugs
- `offensive` - Profanity, hate speech
- `gore` - Violent/graphic content

### Async Processing

Content safety checks run asynchronously to avoid blocking:

```typescript
// In createMoment handler
// Create moment immediately
const moment = await MomentsStore.create(params);

// Check safety async (don't await)
checkMediaSafetyAsync(moment.id, moment.medias);

return res.json({ moment });

// Separate function
const checkMediaSafetyAsync = async (momentId, medias) => {
  for (const media of medias) {
    const isUnsafe = await checkIsMediaSafeForWork(media.signedUrl);
    if (isUnsafe) {
      await MomentsStore.update(momentId, {
        isMatureContent: true,
        isPublic: false,
      });
      break;
    }
  }
};
```

---

## Repurposing for HABITS: Proof Uploads

### Concept Mapping

| Therr Concept | HABITS Concept | Notes |
|---------------|----------------|-------|
| Moment media | Habit proof | Photo/video of completion |
| Public bucket | Shared proofs | Visible to pact partner |
| Private bucket | Private proofs | Personal archive |
| Content safety | Proof moderation | Same API, different rules |

### New Media Types

```typescript
// Add to therr-js-utilities/src/constants/Content.ts
const mediaTypes = {
  USER_IMAGE_PUBLIC: 'user-image-public',
  USER_IMAGE_PRIVATE: 'user-image-private',
  // NEW
  HABIT_PROOF_IMAGE: 'habit-proof-image',
  HABIT_PROOF_VIDEO: 'habit-proof-video',
};
```

### New Bucket (Optional)

```bash
BUCKET_HABIT_PROOFS=therr-habit-proofs
```

Or reuse existing private bucket with path prefix:
```
{userId}/habit-proofs/{habitGoalId}/{filename}_{requestId}.jpg
```

---

## New Schema: Habit Proofs

### Proof Table

```sql
CREATE TABLE habits.proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context
    userId UUID NOT NULL REFERENCES users(id),
    checkinId UUID NOT NULL REFERENCES habits.habit_checkins(id),
    habitGoalId UUID NOT NULL REFERENCES habits.habit_goals(id),
    pactId UUID REFERENCES habits.pacts(id),

    -- Media
    mediaType VARCHAR(50) NOT NULL,  -- 'image' | 'video'
    mediaPath VARCHAR NOT NULL,       -- GCS path
    thumbnailPath VARCHAR,            -- For videos

    -- Verification
    verificationStatus VARCHAR(20) DEFAULT 'pending',
    verifiedAt TIMESTAMP,
    verifiedBy UUID,                  -- Admin or auto
    rejectionReason TEXT,

    -- Metadata
    fileSizeBytes INTEGER,
    durationSeconds INTEGER,          -- For videos
    capturedAt TIMESTAMP,             -- EXIF timestamp
    location JSONB,                   -- Optional GPS from EXIF

    -- Safety
    isSafeForWork BOOLEAN DEFAULT true,
    moderationFlags JSONB,            -- Sightengine response

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proofs_checkin ON habits.proofs(checkinId);
CREATE INDEX idx_proofs_user ON habits.proofs(userId);
CREATE INDEX idx_proofs_status ON habits.proofs(verificationStatus);
```

### Verification Status Enum

```typescript
enum ProofVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',      // Needs manual review
  AUTO_VERIFIED = 'auto_verified',
}
```

---

## New API Endpoints

### Get Proof Upload URL

```
POST /habits-service/proofs/signed-url
  Body: {
    checkinId: string,
    filename: string,
    mediaType: 'image' | 'video'
  }
  Response: {
    uploadUrl: string,
    path: string,
    expiresAt: Date
  }
```

### Create Proof Record

```
POST /habits-service/proofs
  Body: {
    checkinId: string,
    mediaPath: string,
    mediaType: 'image' | 'video',
    fileSizeBytes?: number
  }
  Response: {
    proof,
    verificationStatus
  }
```

### Get Proofs for Check-in

```
GET /habits-service/checkins/:checkinId/proofs
  Response: {
    proofs: [{
      id, mediaPath, mediaType,
      verificationStatus, signedUrl
    }]
  }
```

### Admin: Verify/Reject Proof

```
PUT /habits-service/proofs/:id/verify
  Body: {
    status: 'verified' | 'rejected',
    reason?: string
  }
  Response: { proof }
```

---

## Proof Verification Workflow

### Automatic Verification

```typescript
// habits-service/src/handlers/proofs.ts

const createProof = async (req, res) => {
  const { checkinId, mediaPath, mediaType } = req.body;

  // 1. Create proof record
  const proof = await ProofsStore.create({
    userId: req.user.id,
    checkinId,
    mediaPath,
    mediaType,
    verificationStatus: 'pending',
  });

  // 2. Get signed URL for safety check
  const signedUrl = await getSignedReadUrl(mediaPath);

  // 3. Run safety check async
  verifyProofAsync(proof.id, signedUrl);

  return res.json({ proof });
};

const verifyProofAsync = async (proofId: string, signedUrl: string) => {
  try {
    // Check content safety
    const isSafe = await checkIsMediaSafeForWork(signedUrl);

    if (!isSafe) {
      await ProofsStore.update(proofId, {
        verificationStatus: 'flagged',
        isSafeForWork: false,
      });
      // Notify admin for review
      await notifyAdminForReview(proofId);
      return;
    }

    // Auto-verify if safe
    await ProofsStore.update(proofId, {
      verificationStatus: 'auto_verified',
      verifiedAt: new Date(),
      isSafeForWork: true,
    });

    // Update check-in with verified proof
    const proof = await ProofsStore.findById(proofId);
    await HabitCheckinsStore.update(proof.checkinId, {
      proofVerified: true,
    });
  } catch (error) {
    console.error('Proof verification failed:', error);
    await ProofsStore.update(proofId, {
      verificationStatus: 'pending',
    });
  }
};
```

### Fraud Prevention

```typescript
const validateProofUpload = async (req, res, next) => {
  const { checkinId } = req.body;
  const userId = req.user.id;

  // 1. Verify check-in belongs to user
  const checkin = await HabitCheckinsStore.findById(checkinId);
  if (checkin.userId !== userId) {
    return res.status(403).json({ error: 'Not your check-in' });
  }

  // 2. Check for duplicate proofs
  const existingProofs = await ProofsStore.findByCheckinId(checkinId);
  if (existingProofs.length >= 3) {
    return res.status(400).json({ error: 'Maximum 3 proofs per check-in' });
  }

  // 3. Rate limit (1 proof per minute per user)
  const recentProofs = await ProofsStore.findRecentByUser(userId, 60);
  if (recentProofs.length >= 5) {
    return res.status(429).json({ error: 'Too many uploads, try again later' });
  }

  next();
};
```

### EXIF Metadata Extraction

```typescript
// Optional: Verify photo was taken recently
const extractAndValidateExif = async (mediaPath: string) => {
  const buffer = await downloadFromGCS(mediaPath);
  const exifData = exifReader(buffer);

  const capturedAt = exifData?.DateTimeOriginal;

  if (capturedAt) {
    const capturedDate = new Date(capturedAt);
    const now = new Date();
    const hoursAgo = (now - capturedDate) / (1000 * 60 * 60);

    // Flag if photo is more than 24 hours old
    if (hoursAgo > 24) {
      return {
        isValid: false,
        reason: 'Photo appears to be from more than 24 hours ago',
        capturedAt,
      };
    }
  }

  return { isValid: true, capturedAt };
};
```

---

## Mobile Implementation

### Proof Upload Component

```typescript
// TherrMobile/main/components/ProofUploader.tsx

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const ProofUploader = ({ checkinId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleCapture = async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1920,
    });

    if (result.assets?.[0]) {
      await uploadProof(result.assets[0]);
    }
  };

  const handleSelectFromLibrary = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.assets?.[0]) {
      await uploadProof(result.assets[0]);
    }
  };

  const uploadProof = async (asset) => {
    setUploading(true);
    setProgress(0);

    try {
      // 1. Get signed URL
      const { uploadUrl, path } = await HabitsService.getProofSignedUrl({
        checkinId,
        filename: asset.fileName,
        mediaType: 'image',
      });

      // 2. Upload to GCS
      await uploadToGCS(uploadUrl, asset.uri, (progress) => {
        setProgress(progress);
      });

      // 3. Create proof record
      const proof = await HabitsService.createProof({
        checkinId,
        mediaPath: path,
        mediaType: 'image',
        fileSizeBytes: asset.fileSize,
      });

      onUploadComplete(proof);
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Proof (Optional)</Text>

      {uploading ? (
        <View style={styles.progressContainer}>
          <ProgressBar progress={progress} />
          <Text>{Math.round(progress * 100)}%</Text>
        </View>
      ) : (
        <View style={styles.buttons}>
          <TouchableOpacity onPress={handleCapture} style={styles.button}>
            <CameraIcon />
            <Text>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSelectFromLibrary} style={styles.button}>
            <GalleryIcon />
            <Text>From Library</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
```

### GCS Upload Helper

```typescript
// TherrMobile/main/utilities/upload.ts

const uploadToGCS = async (
  signedUrl: string,
  fileUri: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  const file = await fetch(fileUri);
  const blob = await file.blob();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', blob.type);
    xhr.send(blob);
  });
};
```

---

## Video Support (Premium Feature)

### Video Capture

```typescript
const handleCaptureVideo = async () => {
  const result = await launchCamera({
    mediaType: 'video',
    videoQuality: 'medium',
    durationLimit: 30, // 30 second max
  });

  if (result.assets?.[0]) {
    await uploadProof(result.assets[0], 'video');
  }
};
```

### Video Thumbnail Generation

```typescript
// Backend: Generate thumbnail on upload
const createVideoThumbnail = async (videoPath: string): Promise<string> => {
  // Use ffmpeg or cloud function
  const thumbnailPath = videoPath.replace(/\.\w+$/, '_thumb.jpg');

  await ffmpeg(videoPath)
    .screenshots({
      count: 1,
      folder: '/tmp',
      filename: 'thumb.jpg',
    });

  await storage.bucket(BUCKET).upload('/tmp/thumb.jpg', {
    destination: thumbnailPath,
  });

  return thumbnailPath;
};
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create `habits.proofs` table migration
- [ ] Add indexes for efficient queries

### Phase 2: Backend - Signed URLs
- [ ] Add proof-specific signed URL endpoint
- [ ] Create path pattern: `{userId}/habit-proofs/{habitGoalId}/{filename}`
- [ ] Set appropriate expiration times

### Phase 3: Backend - Proof CRUD
- [ ] Create `ProofsStore.ts`
- [ ] Create `proofs.ts` handler
- [ ] Add routes to router
- [ ] Integrate with check-in creation

### Phase 4: Content Safety
- [ ] Integrate Sightengine for proofs
- [ ] Implement async verification flow
- [ ] Add flagging for manual review
- [ ] Create admin review endpoint

### Phase 5: Mobile - Upload UI
- [ ] Create `ProofUploader` component
- [ ] Add camera capture
- [ ] Add library picker
- [ ] Add progress indicator
- [ ] Handle upload errors

### Phase 6: Mobile - Display
- [ ] Show proofs in check-in detail
- [ ] Show proof status badges
- [ ] Add proof viewer modal

### Phase 7: Fraud Prevention
- [ ] Add rate limiting
- [ ] Add duplicate detection
- [ ] Optional: EXIF timestamp validation
- [ ] Optional: Image hashing for reuse detection

### Phase 8: Video (Premium)
- [ ] Add video capture option
- [ ] Implement thumbnail generation
- [ ] Add video player component
- [ ] Gate behind premium subscription

---

## Security Considerations

### Access Control
- Proofs stored in private bucket
- Signed URLs required for viewing
- Only check-in owner and pact partner can view
- Admin access for moderation

### Data Retention
- Keep verified proofs for 90 days
- Archive to cold storage after 90 days
- Delete rejected proofs after 30 days
- Keep metadata for audit trail

### Privacy
- Strip EXIF location data before storage (optional)
- Don't expose internal paths to clients
- Use short-lived signed URLs (1 hour)
