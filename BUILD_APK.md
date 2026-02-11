# Building APK for Vibee App

## Quick Steps

1. **Log in to Expo** (required first time):
   ```cmd
   npx eas-cli login
   ```
   - Enter your email/username when prompted
   - Follow the authentication steps (browser or code)

2. **Build the APK**:
   ```cmd
   npm run build:apk
   ```
   Or directly:
   ```cmd
   npx eas-cli build --platform android --profile preview
   ```

3. **Wait for build to complete** (10-20 minutes for first build)
   - You'll see build progress in the terminal
   - When complete, you'll get a download link for the APK

## Build Profiles

- **Preview** (APK): `npm run build:apk` - Creates an APK file for testing
- **Production** (APK): `npx eas-cli build --platform android --profile production` - Creates a production APK

## Notes

- First build takes longer (10-20 minutes)
- Subsequent builds are faster
- APK will be available for download from Expo's servers
- No Android SDK required - builds happen in the cloud

## Troubleshooting

### Git Error: "git command not found" or "git --help exited with status undefined"

If you see an error like:
```
git command not found. Install it before proceeding or set EAS_NO_VCS=1
git found, but git --help exited with status undefined.
```

**Solution 1: Install/Repair Git (Recommended)**
1. Download and install Git from: https://git-scm.com/download/win
2. Restart your terminal/command prompt
3. Verify installation: `git --version`
4. Try building again

**Solution 2: Use EAS without Git (Quick Fix)**
If you can't install Git or need a quick workaround, set the environment variable:
```cmd
set EAS_NO_VCS=1
npm run build:apk
```

Or in PowerShell:
```powershell
$env:EAS_NO_VCS=1
npm run build:apk
```

**Note:** Setting `EAS_NO_VCS=1` tells EAS CLI to work without version control. This is fine for building, but Git is recommended for proper project management.

### Gradle Build Failed: "Gradle build failed with unknown error"

If you see an error like:
```
🤖 Android build failed:
Gradle build failed with unknown error. See logs for the "Run gradlew" phase for more information.
```

**Step 1: Check Detailed Logs**
1. Click on the build URL provided in the error (e.g., `https://expo.dev/accounts/.../builds/...`)
2. Navigate to the "Run gradlew" phase in the build logs
3. Look for specific error messages (dependency errors, memory issues, compilation errors, etc.)

**Step 2: Common Solutions**

**Solution A: Clear Cache and Rebuild**
```cmd
npm cache clean --force
cd android
gradlew clean
cd ..
npm run build:apk
```

**Solution B: Update Dependencies**
```cmd
npm install
npx expo install --fix
npm run build:apk
```

**Solution C: Increase Gradle Memory (if memory-related)**
Edit `android/gradle.properties` and increase memory:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

**Solution D: Check for Dependency Conflicts**
1. Review the detailed build logs for specific dependency errors
2. Common issues:
   - Conflicting library versions
   - Missing native modules
   - Incompatible React Native/Expo versions

**Solution E: Try Building Locally First (for debugging)**
```cmd
cd android
gradlew assembleRelease
```
This helps identify the exact error before using EAS.

**Solution F: Update Build Configuration**
If the issue persists, you may need to:
1. Update `android/build.gradle` dependencies
2. Update Gradle wrapper version
3. Check `app.json` and `eas.json` for configuration issues

**Note:** The build logs URL contains the most detailed error information. Always check there first for specific error messages that can guide the fix.

