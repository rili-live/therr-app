---
name: android-debug
description: Run Android emulator/device, capture filtered React Native logs from ADB/logcat, and diagnose errors with source mapping. Designed for token-efficient remote debugging.
user-invocable: true
allowed-tools: Bash(adb *), Bash(emulator *), Bash(cd TherrMobile*), Bash(npx react-native*), Bash(npm run android*), Bash(cat TherrMobile*), Read, Grep, Glob
argument-hint: [status|start|logs|errors|connect <ip>] [--lines <n>] [--since <time>] [--clear] [--crash]
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

## Subcommands

### `status` (default if no argument)

Check device connectivity and debug environment readiness.

```bash
adb devices -l 2>&1
```

Report concisely:
- **Connected**: List device(s) — model, transport (usb/wifi), state
- **Not connected**: Say so. Suggest `connect <ip>` for WiFi or check USB.
- **Metro bundler**: Check if port 8081 is in use: `adb shell "cat /proc/net/tcp 2>/dev/null" | head -5` (don't dump full output)

Output should be **3-5 lines max**.

### `start`

Start emulator and/or prepare debug environment. Run from repo root.

1. **Check if emulator already running**:
   ```bash
   adb devices 2>&1 | grep -c emulator
   ```
   If already running, skip launch and say so.

2. **Launch emulator** (if needed):
   ```bash
   cd TherrMobile && npm run android:emulator
   ```
   Don't wait for full boot — the command backgrounds itself.

3. **Wait for device** (max 30s):
   ```bash
   adb wait-for-device 2>&1
   ```
   Use a 30-second timeout. If it times out, report failure.

4. **Optionally install & run app** if user says `start --run`:
   ```bash
   cd TherrMobile && npm run android
   ```

Report: device state + whether Metro is needed.

### `connect <ip>`

Connect to a device over WiFi for remote debugging. The `<ip>` should be the device's local IP address.

```bash
adb connect <ip>:5555 2>&1
```

If already connected, say so. If connection fails, suggest:
- Ensure device and machine are on same WiFi network
- Run `adb tcpip 5555` first if switching from USB to WiFi
- Check firewall settings

### `logs`

Capture filtered React Native logs. This is the primary debugging subcommand.

**Arguments:**
- `--lines <n>` — Number of lines to capture (default: 40, max: 80)
- `--since <time>` — Time filter, e.g., `"30s ago"`, `"5m ago"` (default: last 60 seconds)
- `--clear` — Clear logcat buffer before capturing (useful for fresh runs)

**Step 1: Optionally clear buffer**
```bash
adb logcat -c 2>&1
```

**Step 2: Capture filtered logs**

Always use dump mode (`-d`) — never stream. Always filter to RN tags.

```bash
adb logcat -d -t "60" ReactNative:V ReactNativeJS:V *:S 2>&1 | tail -n <lines>
```

**Step 3: Post-process before presenting**

- Remove logcat metadata prefix (date, PID, TID) unless debugging timing issues
- Group duplicate messages (show first occurrence + count)
- If output exceeds 40 lines after filtering, truncate and note "... N earlier lines omitted"

**Step 4: Classify messages**

Tag each unique message as one of:
- `ERROR` — Red screen, JS exception, native crash
- `WARN` — Yellow box warnings
- `INFO` — General log output
- `NETWORK` — API call failures, timeout errors

Present errors first, then warnings. Omit INFO unless user specifically asked for all logs.

### `errors`

Focused error capture — like `logs` but strictly errors/crashes only.

```bash
adb logcat -d ReactNative:E ReactNativeJS:E AndroidRuntime:E *:S 2>&1 | tail -n <lines>
```

If `--crash` flag is set, also capture:
```bash
adb logcat -d -b crash 2>&1 | tail -n 40
```

**Post-processing (MANDATORY):**

1. **Deduplicate** — If the same error appears multiple times, show it once with a count
2. **Extract JS stack traces** — Look for patterns like `at Component (filename.js:line:col)` or `Module.filename.tsx`
3. **Map to source** — Use Grep/Glob to find the corresponding source file in `TherrMobile/`:
   ```
   Bundle reference: LoginScreen.tsx:42
   → TherrMobile/main/routes/Login/LoginScreen.tsx:42
   ```
4. **Summarize** in this format:
   ```
   Found 3 unique errors (7 total occurrences):

   1. TypeError: Cannot read property 'map' of undefined (×4)
      → TherrMobile/main/routes/Notifications/index.tsx:87
      Context: notifications array is undefined before API response

   2. Network request failed (×2)
      → TherrMobile/main/services/apiService.ts:23
      Context: API endpoint unreachable — check backend services

   3. Warning: Each child in a list should have a unique "key" prop (×1)
      → TherrMobile/main/components/UserContent/AreaListItem.tsx:34
   ```

### Special: Continuous monitoring (advanced)

If the user wants to monitor logs while testing (e.g., "watch for errors while I navigate the app"), use this pattern:

1. Clear logcat: `adb logcat -c`
2. Tell the user to perform their action
3. After they confirm, capture with `adb logcat -d` (dump mode, not streaming)
4. Process and present findings

**Never use streaming logcat** (`adb logcat` without `-d`). Always dump-and-filter. This prevents runaway token consumption.

## Source File Resolution

When errors reference JS bundle locations, resolve to source files:

1. **Component names**: Search `TherrMobile/main/` for the component name
   ```bash
   # Example: error mentions "NotificationsList"
   ```
   Use Grep to find: `function NotificationsList` or `const NotificationsList`

2. **Route names**: Map to `TherrMobile/main/routes/<RouteName>/`

3. **Common patterns**:
   | Error reference | Likely source |
   |----------------|---------------|
   | `Navigation` | `TherrMobile/main/routes/` + navigation config |
   | `Redux` / `dispatch` | `TherrMobile/main/redux/` or `therr-react/src/redux/` |
   | `AsyncStorage` | Storage utilities in `TherrMobile/main/utilities/` |
   | `Geolocation` | `TherrMobile/main/services/LocationService.ts` |
   | `Notifee` / `FCM` | `TherrMobile/main/services/NotificationService.ts` |

## Rules

- **Token efficiency is paramount**: Filter first, present second. When in doubt, show less.
- Never present raw logcat output to the user without post-processing.
- If ADB is not found or not in PATH, report clearly and suggest installation.
- If no device is connected, always suggest `status` first.
- When presenting errors, always attempt source file resolution — don't just show bundle references.
- For WiFi debugging: the device and development machine must be on the same network. Remind the user if connection fails.
- Run all ADB commands with `2>&1` to capture stderr (ADB errors are often on stderr).
- If logcat returns empty output, say so directly — don't re-run with broader filters (that wastes tokens).
