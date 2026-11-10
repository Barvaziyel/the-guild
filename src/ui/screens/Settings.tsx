import { useRef, useState, type ChangeEvent } from 'react';
import { SAVE_VERSION, dayAt, serialize, type GameState } from '../../engine/index.ts';
import { ConfirmButton } from '../components/Confirm.tsx';
import { usePrefs, useServices } from '../hooks.ts';
import { fastForward, type FastForwardResult } from '../dev.ts';
import { exportFileName, parseImport } from '../persist.ts';

interface Props {
  state: GameState;
  now: number;
  day: number;
}

export function Settings({ state, now, day }: Props) {
  return (
    <section aria-labelledby="settings-title">
      <div className="screen-head">
        <h2 id="settings-title" className="screen-title">
          Settings
        </h2>
      </div>
      <GameSettings state={state} />
      <SaveSettings state={state} now={now} day={day} />
      <DeveloperSettings />
      <About />
    </section>
  );
}

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        <span className="toggle-help">{help}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function GameSettings({ state }: { state: GameState }) {
  const { store, prefs } = useServices();
  const { wobble } = usePrefs();
  return (
    <div className="panel">
      <h3 className="panel-title">Game</h3>
      <Toggle
        label="Mercy mode"
        help="Nobody dies. A wound that would kill someone leaves a scar instead. Crews already out keep the rules they left with."
        checked={state.settings.mercyMode}
        onChange={(on) =>
          store.update((s) => {
            s.settings.mercyMode = on;
          })
        }
      />
      <Toggle
        label="Hand-drawn lines"
        help="The wobble on portrait lines. Turn it off if lists scroll slowly on this phone."
        checked={wobble}
        onChange={(on) => prefs.set({ wobble: on })}
      />
    </div>
  );
}

// ---------------------------------------------------------------- save

function SaveSettings({ state, now, day }: Props) {
  const { store } = useServices();
  const [showExport, setShowExport] = useState(false);
  const backup = store.backup();

  return (
    <div className="panel">
      <h3 className="panel-title">Save</h3>
      <p className="panel-help">The game saves on this phone after every change. Export the save to keep a copy or move it to another device.</p>

      {showExport ? (
        <CopyBox text={serialize(state)} fileName={exportFileName(day)} />
      ) : (
        <button type="button" className="btn" onClick={() => setShowExport(true)}>
          Export save
        </button>
      )}

      <ImportSave current={state} now={now} />

      {backup && <RestoreBackup raw={backup} />}

      <div className="setting-block">
        <h4 className="setting-title">Start over</h4>
        <ConfirmButton
          label="Start a new guild"
          warning={`${state.guildName} on day ${day} is kept as the backup copy, which you can load again from here.`}
          confirmLabel="Start a new guild"
          onConfirm={() => store.newGuild()}
          danger
        />
      </div>
    </div>
  );
}

/** Save text with ways to get it off the phone. Also used on the unreadable-save screen. */
export function CopyBox({ text, fileName }: { text: string; fileName: string }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      area.current?.select();
      setCopied(document.execCommand?.('copy') ? 'yes' : 'failed');
    }
  };

  // Downloads work in a browser. The Android build (PR 8) may need the share sheet instead.
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="copybox">
      <textarea ref={area} readOnly value={text} rows={4} aria-label="Save text" onFocus={(e) => e.currentTarget.select()} />
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>
          Copy
        </button>
        <button type="button" className="btn" onClick={download}>
          Download file
        </button>
      </div>
      {copied === 'yes' && (
        <p className="ok-note" role="status">
          Copied.
        </p>
      )}
      {copied === 'failed' && (
        <p className="field-error" role="status">
          This phone wouldn&rsquo;t copy it. The text is selected; copy it by hand.
        </p>
      )}
    </div>
  );
}

function ImportSave({ current, now }: { current: GameState; now: number }) {
  const { store } = useServices();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<GameState | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const readFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setError(null);
    setPending(null);
  };

  const check = (): void => {
    const result = parseImport(text);
    if (result.ok) {
      setPending(result.state);
      setError(null);
    } else {
      setPending(null);
      setError(result.message);
    }
  };

  const load = (): void => {
    if (!pending) return;
    store.replace(pending);
    setDone(`Loaded ${pending.guildName}.`);
    setPending(null);
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="setting-block">
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Import save
        </button>
        {done && (
          <p className="ok-note" role="status">
            {done}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="setting-block">
      <h4 className="setting-title">Import save</h4>
      <label className="field">
        Paste the save text
        <textarea
          value={text}
          rows={4}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setPending(null);
            setError(null);
          }}
        />
      </label>
      <label className="field">
        Or choose a file
        <input type="file" accept=".json,.txt,application/json,text/plain" onChange={(e) => void readFile(e)} />
      </label>
      {error && <p className="field-error">{error}</p>}
      {pending ? (
        <div className="confirm">
          <p className="confirm-warning">
            This loads {pending.guildName}: {pending.survivors.length} survivors, day {dayAt(pending, now)}. It replaces {current.guildName}, which
            is kept as the backup copy.
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={load}>
              Load save
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={check} disabled={!text.trim()}>
            Check save
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setOpen(false);
              setText('');
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function RestoreBackup({ raw }: { raw: string }) {
  const { store } = useServices();
  const parsed = parseImport(raw);
  if (!parsed.ok) return null;
  const b = parsed.state;
  return (
    <div className="setting-block">
      <h4 className="setting-title">Backup copy</h4>
      <p className="panel-help">
        {b.guildName}, {b.survivors.length} survivors. This is the save that the last import or new guild replaced.
      </p>
      <ConfirmButton
        label="Load the backup"
        warning="The backup becomes your guild, and the current guild becomes the backup."
        confirmLabel="Load the backup"
        onConfirm={() => store.replace(b)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- developer

function DeveloperSettings() {
  const { store } = useServices();
  const [result, setResult] = useState<FastForwardResult | null>(null);

  const run = (): void => {
    let r: FastForwardResult | null = null;
    store.update((s) => {
      r = fastForward(s, Date.now(), { runs: 10 });
    });
    setResult(r);
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Developer</h3>
      <p className="panel-help">
        Until the run planner arrives, this plays ten runs at once with random crews at places up to danger 3, so the roster has some history.
        Supplies are topped up as needed and everyone rests three days between runs.
      </p>
      <ConfirmButton
        label="Play ten runs"
        warning="This moves the guild forward about a month. People may be hurt, change, or die. It can't be undone, so export the save first if you want to keep this moment."
        confirmLabel="Play ten runs"
        onConfirm={run}
      />
      {result && (
        <p className="ok-note" role="status">
          Played {result.runs} runs over {result.days} days.{' '}
          {result.deaths === 0 ? 'Everyone came home.' : `${result.deaths} ${result.deaths === 1 ? 'death' : 'deaths'}. See the Memorial Wall.`}
        </p>
      )}
    </div>
  );
}

function About() {
  return (
    <div className="panel about">
      <h3 className="panel-title">About</h3>
      <p>
        The Guild {__APP_VERSION__}, save format {SAVE_VERSION}.
      </p>
      <p>Type: Big Shoulders Stencil and Atkinson Hyperlegible Next, both under the SIL Open Font License.</p>
    </div>
  );
}
