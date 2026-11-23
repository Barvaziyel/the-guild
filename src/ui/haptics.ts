/** A short buzz of the phone (3.1.0): the Haptics plugin in the app, the vibrate API in a browser that has one. */
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Buzz } from './sound-view.ts';

export function buzz(kind: Buzz): void {
  void Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => undefined);
}
