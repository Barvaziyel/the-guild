/**
 * Build the Android app on this machine.
 *
 *   npm run apk              builds out/the-guild-<version>.apk
 *   npm run apk -- --install also installs it on a phone plugged in over USB
 *   npm run apk -- --debug   a debug build instead (no signing key needed)
 *
 * Steps: check Java 21 and the Android SDK, build the web app, copy it into
 * the Android project (cap sync), run Gradle, and copy the APK to out/.
 * See docs/ANDROID.md for the one-time setup.
 */
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAdb, findAndroidSdk, findJavaHome, findJavaTool, javaHelp, javaMajor, sdkHelp } from './toolchain.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const androidDir = join(root, 'android');
const isWindows = process.platform === 'win32';
const args = new Set(process.argv.slice(2));
const debug = args.has('--debug');
const install = args.has('--install');

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

/**
 * Runs a command and stops the build if it fails. On Windows, npm, npx and
 * gradlew.bat are batch files, which Node only starts through a shell; the
 * shell doesn't quote arguments, so anything that may hold a path with spaces
 * (adb and the APK path) runs without one.
 */
function run(cmd: string, cmdArgs: string[], opts: SpawnSyncOptions = {}): void {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`);
  const shell = isWindows && ['npm', 'npx', 'gradlew.bat'].includes(cmd);
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell, ...opts });
  if (result.error) fail(`Couldn't run ${cmd}: ${result.error.message}`);
  if (result.status !== 0) fail(`${cmd} ${cmdArgs[0] ?? ''} failed (exit code ${result.status}). The first error above is usually the one that matters.`);
}

// ---------------------------------------------------------------- toolchain

const java = findJavaTool('java');
if (!java) fail(`Couldn't find Java.\n\n${javaHelp()}`);
const major = javaMajor(java);
if (major === undefined || major < 21) fail(`Found Java ${major ?? '(unknown version)'}, but the build needs Java 21 or newer.\n\n${javaHelp()}`);
const javaHome = findJavaHome();

const sdk = findAndroidSdk(androidDir);
if (!sdk) fail(sdkHelp());
// Gradle reads the SDK location from local.properties (ignored by git).
const localProps = join(androidDir, 'local.properties');
if (!existsSync(localProps) || !readFileSync(localProps, 'utf8').includes('sdk.dir=')) {
  writeFileSync(localProps, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
}

const signed = existsSync(join(androidDir, 'keystore.properties'));
console.log(`Java ${major}${javaHome ? ` (${javaHome})` : ''}`);
console.log(`Android SDK: ${sdk}`);
if (!debug) {
  console.log(
    signed
      ? 'Signing with your release key (android/keystore.properties).'
      : "No release key yet (run `npm run keystore` once). Signing with this machine's debug key for now.",
  );
}

// ---------------------------------------------------------------- build

run('npm', ['run', 'build'], { cwd: root });
run('npx', ['cap', 'sync', 'android'], { cwd: root });

const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
run(gradlew, [debug ? 'assembleDebug' : 'assembleRelease', '--console=plain'], {
  cwd: androidDir,
  env: { ...process.env, ...(javaHome ? { JAVA_HOME: javaHome } : {}), ANDROID_HOME: sdk },
});

const variant = debug ? 'debug' : 'release';
const built = join(androidDir, 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`);
if (!existsSync(built)) fail(`Gradle finished but ${built} isn't there.`);

const version = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version;
mkdirSync(join(root, 'out'), { recursive: true });
const apk = join(root, 'out', `the-guild-${version}${debug ? '-debug' : ''}.apk`);
copyFileSync(built, apk);
console.log(`\nBuilt ${apk} (${(statSync(apk).size / 1024 / 1024).toFixed(1)} MB).`);

// ---------------------------------------------------------------- install

if (install) {
  const adb = findAdb(sdk);
  if (!adb) fail("Couldn't find adb (Android SDK > platform-tools). Install it from Android Studio's SDK Manager.");
  run(adb, ['install', '-r', apk]);
  console.log('\nInstalled. Open The Guild on the phone.');
} else {
  console.log(
    [
      '',
      'To put it on your phone, either:',
      '  - plug it in with USB debugging on and run: npm run apk:install',
      '  - or copy the .apk to the phone and open it (allow installing from that app when asked).',
      'An update installs over the old version and keeps the save, as long as it is signed with the same key.',
    ].join('\n'),
  );
}
