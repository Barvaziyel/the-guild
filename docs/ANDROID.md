# Building the Android app

The app is the same web game wrapped by [Capacitor](https://capacitorjs.com). You build the APK on your own computer with one command and install it on the phone, either over USB or by copying the file. Windows, macOS and Linux all work.

## One-time setup

1. **Node 22.18 or later**, as for the rest of the game, then `npm install` in the repo.
2. **Android Studio Otter (2025.2.1) or later** from [developer.android.com/studio](https://developer.android.com/studio). Open it once and let the setup wizard install the SDK. Then, under *More Actions → SDK Manager*:
   - *SDK Platforms*: tick **Android 16 (API 36)**.
   - *SDK Tools*: make sure **Android SDK Build-Tools**, **Android SDK Platform-Tools** and **Android SDK Command-line Tools** are ticked.
3. **Java 21.** Android Studio comes with one, and the build script finds it in the default install location. If you installed Android Studio somewhere else, or `npm run apk` says it can't find Java 21, point `JAVA_HOME` at Android Studio's bundled Java:

   | OS | Bundled Java |
   |---|---|
   | Windows | `C:\Program Files\Android\Android Studio\jbr` |
   | macOS | `/Applications/Android Studio.app/Contents/jbr/Contents/Home` |
   | Linux | `jbr` inside wherever you unpacked Android Studio, e.g. `~/android-studio/jbr` |

   The SDK is found the same way: from `ANDROID_HOME`, or Android Studio's default location (`%LOCALAPPDATA%\Android\Sdk`, `~/Library/Android/sdk`, `~/Android/Sdk`).
4. **The signing key:**

   ```bash
   npm run keystore
   ```

   This makes `android/the-guild-release.jks` and `android/keystore.properties` (git ignores both). **Back up both files** somewhere safe, like a password manager or a private cloud folder. Android only installs an update over the app if it is signed with the same key; with a different key you have to uninstall first, and that deletes the save.

## Building

```bash
npm run apk
```

This checks Java and the SDK, builds the web app, copies it into the Android project (`cap sync`), runs Gradle, and leaves the result in `out/the-guild-<version>.apk`. The first build downloads Gradle and the Android libraries, a few hundred MB, so give it several minutes; later builds take well under a minute.

Every build gets a higher version code than the last (it is the build time in minutes), so a new APK always installs over an older one. The version name comes from `package.json`.

`npm run apk -- --debug` makes a debug build instead (`out/the-guild-<version>-debug.apk`).

## Putting it on the phone

**Over USB** (quickest for repeat builds):

1. On the phone, open *Settings → About phone* and tap *Build number* seven times to unlock *Developer options*.
2. In *Developer options*, turn on *USB debugging*.
3. Plug the phone in and accept the "Allow USB debugging?" prompt.
4. Run `npm run apk:install`. It builds and installs in one go.

**By copying the file:** send `out/the-guild-<version>.apk` to the phone any way you like (a cable, Google Drive, Quick Share, email to yourself), then tap it in the Files app. Android asks you to allow installing apps from that source the first time. Play Protect may warn that it doesn't know the developer; choose *More details → Install anyway*.

## First launch

- **Notices:** open *Settings* and turn on *Tell me when crews come back*. Android asks for permission. Notices are scheduled with the system, so they arrive with the game closed, but Android may hold them back a few minutes to save battery.
  - Some phones (Samsung, Xiaomi, OnePlus and others) are aggressive about this. If notices don't arrive, set the app's battery use to *Unrestricted* in its App info.
- **Bringing a browser save over:** the app keeps its own save, separate from any browser. In the browser game, go to *Settings → Export save → Copy*; in the app, *Settings → Import save* and paste it.
- **The back button** goes back a screen, and on a main tab it puts the game in the background.

## Updating

Build again with `npm run apk` and install the new APK the same way. As long as it's signed with the same key, it installs over the old one and keeps the save.

If you ever have to change the key (for example, if you built before making the release key, or lost the key), the new build won't install over the old one ("App not installed" or "package conflicts"):

1. In the old app, *Settings → Export save → Share file* and keep the file somewhere off the phone, or copy the text.
2. Uninstall the old app.
3. Install the new one and import the save.

## Working on the native project

`android/` is a normal Android Studio project and is committed to git (only build output, `local.properties` and the signing files are ignored).

- `npm run android:sync` builds the web app and copies it into `android/`.
- `npm run android:open` opens the project in Android Studio, where you can run it on a phone or emulator and see its logs.

App icons and the splash screen are generated from the images in `assets/`:

```bash
npx @capacitor/assets@4.0.0 generate --android --iconBackgroundColor '#24332f' --iconBackgroundColorDark '#24332f' --splashBackgroundColor '#24332f' --splashBackgroundColorDark '#24332f'
```

The notification icon is a vector drawable, `android/app/src/main/res/drawable/ic_stat_guild.xml`.

## Troubleshooting

| Message | What to do |
|---|---|
| Couldn't find the Android SDK | Open Android Studio once so it installs the SDK, or set `ANDROID_HOME` to where it is. |
| Found Java 17, but the build needs Java 21 | Set `JAVA_HOME` to Android Studio's bundled Java (table above). |
| SDK location not found (from Gradle) | Delete `android/local.properties` and run `npm run apk` again; the script writes it. |
| Failed to install … INSTALL_FAILED_UPDATE_INCOMPATIBLE | The installed app has a different key. See *Updating*. |
| adb: no devices/emulators found | Check the cable, that USB debugging is on, and that you accepted the prompt on the phone. `adb devices` lists what it sees. |
