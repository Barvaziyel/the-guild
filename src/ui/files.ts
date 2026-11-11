/**
 * Getting a file off the device: a download in a browser, the share sheet in
 * the Android app (WebViews don't do downloads).
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native.ts';

/** What the button should say. */
export function saveFileLabel(): string {
  return isNative() ? 'Share file' : 'Download file';
}

/** Hand the text over as a file. Resolves false if the player backed out of the share sheet. */
export async function saveTextFile(fileName: string, text: string): Promise<boolean> {
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: 'The Guild save', files: [uri] });
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
