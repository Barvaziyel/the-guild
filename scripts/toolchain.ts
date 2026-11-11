/**
 * Finding Java and the Android SDK on the machine that builds the app.
 * Android Studio bundles both; these helpers look where it puts them.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const exe = (name: string): string => (isWindows ? `${name}.exe` : name);

/** Where Android Studio keeps its bundled Java (JBR) on each OS. */
function studioJavaHomes(): string[] {
  if (process.platform === 'darwin') return ['/Applications/Android Studio.app/Contents/jbr/Contents/Home'];
  if (isWindows) {
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files';
    return [join(pf, 'Android', 'Android Studio', 'jbr')];
  }
  return [join(homedir(), 'android-studio', 'jbr'), '/opt/android-studio/jbr', '/usr/local/android-studio/jbr', '/snap/android-studio/current/jbr'];
}

/**
 * The Java to build with: JAVA_HOME or Android Studio's bundled Java, whichever
 * is 21 or newer (an older JAVA_HOME, often 17, is skipped). If neither is new
 * enough, the first one found, so the caller can say which version it saw.
 */
export function findJavaHome(): string | undefined {
  const homes = [process.env.JAVA_HOME, ...studioJavaHomes()].filter(
    (home): home is string => Boolean(home && existsSync(join(home, 'bin', exe('java')))),
  );
  return homes.find((home) => (javaMajor(join(home, 'bin', exe('java'))) ?? 0) >= 21) ?? homes[0];
}

/** A JDK tool (java, keytool): from the Java home we found, else whatever is on PATH. */
export function findJavaTool(name: 'java' | 'keytool'): string | undefined {
  const home = findJavaHome();
  if (home) return join(home, 'bin', exe(name));
  const probe = spawnSync(name, name === 'java' ? ['-version'] : ['-help'], { stdio: 'ignore', shell: isWindows });
  return probe.error ? undefined : name;
}

/** The major version of a java binary, e.g. 21. */
export function javaMajor(java: string): number | undefined {
  const out = spawnSync(java, ['-version'], { encoding: 'utf8', shell: isWindows && java === 'java' });
  const text = `${out.stderr ?? ''}${out.stdout ?? ''}`;
  const m = /version "(\d+)(?:\.(\d+))?/.exec(text);
  if (!m) return undefined;
  const major = Number(m[1]);
  return major === 1 ? Number(m[2]) : major;
}

export function javaHelp(): string {
  return [
    'The Android build needs Java 21. The easiest way is the one bundled with Android Studio (Otter or newer):',
    '  Windows: set JAVA_HOME to C:\\Program Files\\Android\\Android Studio\\jbr',
    '  macOS:   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"',
    '  Linux:   export JAVA_HOME=~/android-studio/jbr  (wherever Android Studio is unpacked)',
    'See docs/ANDROID.md.',
  ].join('\n');
}

/** Where Android Studio installs the SDK by default on each OS. */
function defaultSdkDirs(): string[] {
  if (process.platform === 'darwin') return [join(homedir(), 'Library', 'Android', 'sdk')];
  if (isWindows) return [join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk')];
  return [join(homedir(), 'Android', 'Sdk')];
}

/** sdk.dir from android/local.properties, if it's there. */
function localPropertiesSdk(androidDir: string): string | undefined {
  const file = join(androidDir, 'local.properties');
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('sdk.dir='));
  // Properties files escape ':' and '\' on Windows (C\:\\Users\\...).
  return line?.slice('sdk.dir='.length).replace(/\\(.)/g, '$1');
}

/** The Android SDK: ANDROID_HOME, ANDROID_SDK_ROOT, local.properties, or Android Studio's default. */
export function findAndroidSdk(androidDir: string): string | undefined {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, localPropertiesSdk(androidDir), ...defaultSdkDirs()];
  return candidates.find((dir): dir is string => Boolean(dir && existsSync(join(dir, 'platforms')) && existsSync(join(dir, 'build-tools'))));
}

export function sdkHelp(): string {
  return [
    "Couldn't find the Android SDK. Install Android Studio (Otter or newer), open it once and let it",
    'download the SDK (More Actions > SDK Manager: Android 16 / API 36 and the latest build tools).',
    'If the SDK lives somewhere unusual, set ANDROID_HOME to it. See docs/ANDROID.md.',
  ].join('\n');
}

export function findAdb(sdk: string | undefined): string | undefined {
  if (sdk) {
    const adb = join(sdk, 'platform-tools', exe('adb'));
    if (existsSync(adb)) return adb;
  }
  const probe = spawnSync('adb', ['version'], { stdio: 'ignore', shell: isWindows });
  return probe.error || probe.status !== 0 ? undefined : 'adb';
}
