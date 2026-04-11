---
name: android-debug
description: Run Android emulator/device, capture filtered React Native logs from ADB/logcat, and diagnose errors with source mapping. Designed for token-efficient remote debugging.
user-invocable: true
allowed-tools: Bash(adb *), Bash(timeout *), Bash(cd TherrMobile*), Bash(npm --prefix TherrMobile *), Read, Grep, Glob
argument-hint: [status|start|logs|errors|connect <ip>] [--lines <n>] [--clear] [--crash] [--run]
---

# Android Debug

Capture and diagnose React Native logs from a connected Android device or emulator via ADB. Built for **token efficiency** — never dump raw logcat. Always filter, truncate, and summarize.

## Token Budget Rules (CRITICAL)

These rules override all other instructions when they conflict:

1. **Never capture more than 80 lines** of log output in a single invocation. Use `--lines` to control (default: 40).
2. **Always filter** logcat to React Native tags only — never use `adb logcat` without tag filters.
3. **Strip timestamps** from output when they aren't needed for diagnosis (most cases).
4. **Summarize** before presenting: group repeated errors, count occurrences, show unique stack frames only.
5. **Map to source files** immediately — don't show raw bundle line numbers without attempting to resolve them.
6. **Never stream logcat** — always use dump mode (`-d`) or line-count mode (`-t <N>`). This prevents runaway token consumption.

## Subcommands

### `status` (default if no argument)

Check device connectivity and debug environment readiness. Run these in parallel:

```bash
adb devices -l 2>&1
```
```bash
adb shell pm list packages 2>&1 | grep therr
```

Report concisely (**5 lines max**):
- **Connected**: List device(s) — model, transport (usb/wifi), state
- **Not connected**: Say so. Suggest `connect <ip>` for WiFi or check USB cable.
- **Unauthorized**: Tell user to check their device screen for the USB debugging authorization prompt and tap "Allow".
- **App installed**: Whether `app.therrmobile` is installed on the device
- **Offline**: Device visible but unresponsive — suggest `adb kill-server && adb start-server`

### `start`

Start emulator and/or prepare debug environment. Run from repo root.

1. **Check if a device/emulator is already connected**:
   ```bash
   adb devices 2>&1 | grep -c -E "emulator|device$"
   ```
   If already connected, skip launch and say so.

2. **Launch emulator** (if no device connected):
   ```bash
   cd TherrMobile && npm run android:emulator
   ```
   The script backgrounds itself — don't wait for it to return.

3. **Wait for device boot** (max 30s, will not block forever):
   ```bash
   timeout 30 adb wait-for-device 2>&1
   ```
   If it times out, report failure and suggest checking Android Studio AVD manager.

4. **Optionally build & install app** if user says `start --run`:
   ```bash
   cd TherrMobile && npm run android
   ```
   This also starts Metro bundler. If Metro is already running on port 8081, this will use the existing instance.

Report: device state + whether `--run` is needed to install the app.

### `connect <ip>`

Connect to a device over WiFi for remote debugging. The `<ip>` should be the device's local IP address (find it in device Settings > About Phone > IP address).

```bash
adb connect <ip>:5555 2>&1
```

Then verify:
```bash
adb devices -l 2>&1
```

**If connection fails**, suggest these steps in order:
1. Ensure device and development machine are on the **same WiFi network**
2. If switching from USB to WiFi: connect USB first, run `adb tcpip 5555`, then disconnect USB and retry `adb connect`
3. On Android 11+, try **Wireless Debugging** in Developer Options (uses a different pairing flow: `adb pair <ip>:<port>` with a pairing code, then `adb connect`)
4. Check that no firewall is blocking port 5555

**After successful connection**, set up port forwarding for the backend APIs:
```bash
adb reverse tcp:7770 tcp:7770 2>&1
adb reverse tcp:7743 tcp:7743 2>&1
adb reverse tcp:8081 tcp:8081 2>&1
```
This mirrors what `npm run android:device` does, allowing the app on the phone to reach localhost services.

### `logs`

Capture filtered React Native logs. This is the primary debugging subcommand.

**Arguments:**
- `--lines <n>` — Number of log lines to capture (default: 40, max: 80)
- `--clear` — Clear logcat buffer before capturing (useful for fresh test runs)

**Step 1: Optionally clear buffer**
```bash
adb logcat -c 2>&1
```
If `--clear` is set, clear the buffer and tell the user to reproduce the issue. Wait for them to confirm before proceeding to Step 2.

**Step 2: Capture filtered logs**

Use `-t <N>` to get the last N lines (implies dump mode — exits immediately). Always filter to RN tags.

```bash
adb logcat -t <lines> ReactNative:V ReactNativeJS:V *:S 2>&1
```

Note: `-t <N>` means "last N lines", NOT a time duration. This is the primary line-count control — do NOT also pipe through `tail`.

**Step 3: Post-process before presenting**

- Remove logcat metadata prefix (date, PID, TID) unless debugging timing issues
- Group duplicate messages (show first occurrence + count)
- If output still exceeds 40 unique lines, truncate and note "... N earlier lines omitted"

**Step 4: Classify and present**

Tag each unique message as one of:
- `ERROR` — Red screen, JS exception, native crash
- `WARN` — Yellow box warnings
- `INFO` — General log output
- `NETWORK` — API call failures, timeout errors

Present errors first, then warnings. **Omit INFO entirely** unless user specifically asked for all logs.

### `errors`

Focused error capture — like `logs` but strictly errors/crashes only.

```bash
adb logcat -t <lines> ReactNative:E ReactNativeJS:E AndroidRuntime:E *:S 2>&1
```

Default `--lines` for errors subcommand: 60 (errors are higher value, worth more context).

If `--crash` flag is set, also capture the crash buffer:
```bash
adb logcat -d -b crash 2>&1 | tail -n 40
```

**Post-processing (MANDATORY):**

1. **Deduplicate** — If the same error appears multiple times, show it once with a count
2. **Extract JS stack traces** — Look for patterns like `at ComponentName (filename.js:line:col)` or `Module.filename.tsx`
3. **Map to source** — Use Grep to find the corresponding source file in `TherrMobile/main/`:
   ```
   Bundle reference: LoginScreen.tsx:42
   → Grep for "LoginScreen" in TherrMobile/main/routes/
   → TherrMobile/main/routes/Login/index.tsx:42
   ```
4. **Summarize** in this format (never present raw logcat):
   ```
   Found 3 unique errors (7 total occurrences):

   1. TypeError: Cannot read property 'map' of undefined (×4)
      → TherrMobile/main/routes/Notifications/index.tsx:87
      Cause: notifications array is undefined before API response

   2. Network request failed (×2)
      → therr-react/src/services/ (API layer)
      Cause: API endpoint unreachable — check backend services

   3. Warning: Each child in a list should have a unique "key" prop (×1)
      → TherrMobile/main/components/UserContent/AreaListItem.tsx:34
   ```

### Workflow: Clear-Reproduce-Capture

When the user is actively testing, use this sequence:

1. Clear logcat: `adb logcat -c`
2. Tell the user: "Buffer cleared. Reproduce the issue now and let me know when done."
3. After they confirm, capture: `adb logcat -t 60 ReactNative:E ReactNativeJS:E *:S`
4. Post-process and present findings per the rules above

This gives a clean signal with no noise from previous sessions.

## Source File Resolution

When errors reference JS bundle locations or component names, resolve to source files using Grep and Glob — **never hard-code paths that might be stale**.

### Resolution strategy

1. **Component/function names**: Grep `TherrMobile/main/` for the export or declaration:
   ```
   Grep pattern: "function ComponentName|const ComponentName|class ComponentName"
   Path: TherrMobile/main/
   ```

2. **Route names**: Routes map to `TherrMobile/main/routes/<RouteName>/index.tsx`. The route directory structure:
   - `TherrMobile/main/routes/Login/` → Login screens
   - `TherrMobile/main/routes/Map/` → Map screens
   - `TherrMobile/main/routes/Notifications/` → Notification screens
   - etc.

3. **Common module mapping** (use Grep to verify — these are starting points, not guaranteed paths):

   | Error keyword | Where to search |
   |--------------|----------------|
   | Navigation / route | `TherrMobile/main/components/Layout.tsx`, `TherrMobile/main/components/RootNavigation.ts` |
   | Redux / dispatch / store | `TherrMobile/main/redux/`, `therr-react/src/redux/` |
   | AsyncStorage / SecureStorage | `TherrMobile/main/utilities/SecureStorage.ts` |
   | Geolocation / location | `TherrMobile/main/utilities/requestLocationServiceActivation.ts`, `TherrMobile/main/redux/actions/LocationActions.ts` |
   | Notifee / FCM / push | `TherrMobile/main/utilities/pushNotifications.ts` |
   | API / network / fetch | `therr-react/src/services/` |
   | Translation / locale | `TherrMobile/main/services/translator.ts`, `TherrMobile/main/locales/` |

4. **When Grep returns no match**: Try broader patterns (e.g., partial component name) or search `therr-react/src/` for shared code. If still nothing, report the raw reference and note it couldn't be resolved.

## Common React Native Error Patterns

Quick-diagnosis table — check these before doing expensive source searches:

| Error message pattern | Likely cause | Quick fix direction |
|----------------------|-------------|-------------------|
| `TypeError: undefined is not an object` | Accessing property on null/undefined state before API loads | Add optional chaining or null check |
| `VirtualizedList: missing keys` | List items without `key` prop | Add `key={item.id}` to FlatList renderItem |
| `Network request failed` | Backend not running or port forwarding missing | Run `adb reverse tcp:7770 tcp:7770` |
| `Unable to resolve module` | Metro cache stale or missing dependency | `cd TherrMobile && npm start -- --reset-cache` |
| `Cannot read property of null (evaluating 'RNGestureHandlerModule.*')` | Native module not linked | `cd TherrMobile/android && ./gradlew clean` then rebuild |
| `Invariant Violation: requireNativeComponent` | Missing native dependency build | Rebuild: `cd TherrMobile && npm run android:clean && npm run android` |
| `FATAL EXCEPTION: mqt_native_modules` | Native crash in a module | Check `adb logcat -t 30 AndroidRuntime:E *:S` for the Java/Kotlin stack trace |
| `Error: Invalid hook call` | React version mismatch or hooks called outside component | Check for duplicate React copies in node_modules |

## Device Troubleshooting

| `adb devices` output | Meaning | Action |
|---------------------|---------|--------|
| `<serial> device` | Connected and authorized | Ready to use |
| `<serial> unauthorized` | USB debugging not approved | Tap "Allow USB debugging" on the device screen |
| `<serial> offline` | Connected but unresponsive | Run `adb kill-server && adb start-server` |
| _(empty list)_ | No device detected | Check USB cable, enable Developer Options + USB Debugging, or use `connect <ip>` for WiFi |
| `* daemon not running` | ADB server starting | Normal — wait for it to finish, then retry |

## Rules

- **Token efficiency is paramount**: Filter first, present second. When in doubt, show less.
- **Never present raw logcat output** — always post-process (deduplicate, classify, resolve sources).
- **Never use streaming logcat** (`adb logcat` without `-d` or `-t`). Always use dump-and-exit mode.
- If ADB is not found or not in PATH, report clearly: "ADB not found. Install Android SDK Platform Tools or set ANDROID_HOME."
- If no device is connected, run `status` first before attempting any other subcommand.
- When presenting errors, always attempt source file resolution via Grep — don't just show bundle references.
- Run all ADB commands with `2>&1` to capture stderr (ADB errors are often on stderr).
- If logcat returns empty output, say "No React Native log output found" — don't re-run with broader filters (that wastes tokens).
- After `connect`, always set up port forwarding (`adb reverse`) so the app can reach localhost backend services.
