import { ConfirmButton } from '../components/Confirm.tsx';
import { useServices } from '../hooks.ts';
import { CopyBox } from './Settings.tsx';

/** Shown instead of the game when the save on this device can't be read. Nothing is overwritten until the player chooses. */
export function LoadError({ message, raw }: { message: string; raw: string }) {
  const { store } = useServices();
  return (
    <main className="screen load-error">
      <h1 className="screen-title">The save couldn&rsquo;t be read</h1>
      <p>{message}</p>
      <p>
        Your guild is still stored on this device and nothing has been changed. Copy the text below and keep it somewhere safe before
        doing anything else. It can be fixed by hand, or loaded again by a newer version of the game.
      </p>
      <CopyBox text={raw} fileName="the-guild-unreadable-save.json" />
      <ConfirmButton
        label="Start a new guild"
        warning="The unreadable save is kept as the backup copy, and a new guild with four founders takes its place."
        confirmLabel="Start a new guild"
        onConfirm={() => store.newGuild()}
        danger
      />
    </main>
  );
}
