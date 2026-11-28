/**
 * Getting a file off the device: a download in a browser, the share sheet in
 * the Android app (WebViews don't do downloads).
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native.ts';
import type { Disk } from './save-disk.ts';

/** What the button should say. */
export function saveFileLabel(): string {
  return isNative() ? 'Share file' : 'Download file';
}

/** Hand the text over as a file. Resolves false if the player backed out of the share sheet. */
export async function saveTextFile(fileName: string, text: string): Promise<boolean> {
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: 'The Depot save', files: [uri] });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * The app's own data folder, for the save's file and its daily copies
 * (`save-disk.ts`, 3.9.1). Kept under "the-guild/".
 */
export function appDisk(): Disk {
  const at = (path: string): { path: string; directory: Directory } => ({ path: `the-guild/${path}`, directory: Directory.Data });
  return {
    async read(path) {
      try {
        const { data } = await Filesystem.readFile({ ...at(path), encoding: Encoding.UTF8 });
        return typeof data === 'string' ? data : null;
      } catch {
        return null;
      }
    },
    async write(path, text) {
      await Filesystem.writeFile({ ...at(path), data: text, encoding: Encoding.UTF8, recursive: true });
    },
    async list(dir) {
      try {
        return (await Filesystem.readdir(at(dir))).files.map((f) => f.name);
      } catch {
        return [];
      }
    },
    async remove(path) {
      await Filesystem.deleteFile(at(path));
    },
  };
}
