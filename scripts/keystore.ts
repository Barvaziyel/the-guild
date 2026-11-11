/**
 * One-time setup: make the key that signs every release build of the app.
 *
 *   npm run keystore
 *
 * Writes android/the-guild-release.jks and android/keystore.properties (both
 * ignored by git). Android only installs an update over the app if it's signed
 * with the same key, so back both files up somewhere safe: losing them means
 * uninstalling the app (and its save, unless exported) to install a new build.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findJavaTool, javaHelp } from './toolchain.ts';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const storeName = 'the-guild-release.jks';
const storePath = join(androidDir, storeName);
const propsPath = join(androidDir, 'keystore.properties');

if (existsSync(propsPath) || existsSync(storePath)) {
  console.log(`There is already a signing key in ${androidDir}. Nothing to do.`);
  console.log('To start over, move keystore.properties and the .jks file somewhere else first.');
  process.exit(0);
}

const keytool = findJavaTool('keytool');
if (!keytool) {
  console.error(`Couldn't find keytool, which comes with Java.\n\n${javaHelp()}`);
  process.exit(1);
}

// PKCS12 keystores use one password for the store and the key.
const password = randomBytes(18).toString('base64url');
const alias = 'the-guild';
const result = spawnSync(
  keytool,
  [
    '-genkeypair',
    '-keystore', storePath,
    '-storetype', 'PKCS12',
    '-alias', alias,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-storepass', password,
    '-keypass', password,
    '-dname', 'CN=The Guild',
  ],
  { stdio: ['ignore', 'inherit', 'inherit'] },
);
if (result.status !== 0) {
  console.error('keytool failed; see above.');
  process.exit(1);
}

writeFileSync(
  propsPath,
  [
    '# Signs release builds of The Guild. Made by `npm run keystore`. Never commit this file.',
    `storeFile=${storeName}`,
    `storePassword=${password}`,
    `keyAlias=${alias}`,
    `keyPassword=${password}`,
    '',
  ].join('\n'),
);

console.log(`
Made a signing key:
  ${storePath}
  ${propsPath}

Back up BOTH files somewhere safe (a password manager or private cloud folder).
Every build signed with this key installs over the last one and keeps the save.
Without them, a new build has to replace the app, which wipes the save.

Next: npm run apk`);
