import { useState, type FormEvent } from 'react';
import {
  NAME_MAX_LENGTH,
  SLOTS,
  canChangeGear,
  equipFromStash,
  getSurvivor,
  nameProblem,
  renameSurvivor,
  unequip,
  type GameState,
  type Slot,
  type Survivor,
} from '../../engine/index.ts';
import { BondBar, Meter, Vitals } from '../components/Bars.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { goBack, navigate, useServices } from '../hooks.ts';
import type { SheetTab } from '../route.ts';
import {
  SLOT_NAMES,
  bonds,
  chronicleByDay,
  daysSurvived,
  derived,
  findAnySurvivor,
  hiddenTraitCount,
  itemView,
  lifeSummary,
  originLine,
  pronounLabel,
  stashFor,
  statRows,
  survivorStatus,
  traitGroups,
} from '../view.ts';

interface Props {
  state: GameState;
  id: string;
  tab: SheetTab;
  day: number;
}

const TAB_LABELS: Record<SheetTab, string> = { stats: 'Stats and gear', bonds: 'Bonds', story: 'Chronicle' };

export function SurvivorSheet({ state, id, tab, day }: Props) {
  const s = findAnySurvivor(state, id);
  if (!s) {
    return (
      <div className="sheet">
        <BackLink to="roster" />
        <p className="empty">This survivor isn&rsquo;t in the guild&rsquo;s records any more.</p>
      </div>
    );
  }
  const dead = s.status === 'dead';
  const tabs: SheetTab[] = dead ? ['stats', 'story'] : ['stats', 'bonds', 'story'];
  const current = tabs.includes(tab) ? tab : 'stats';

  return (
    <article className="sheet" aria-labelledby="sheet-name">
      <BackLink to={dead ? 'memorial' : 'roster'} />
      <SheetHeader survivor={s} day={day} />

      <div className="sheet-tabs" role="tablist" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={t === current}
            aria-controls="sheet-panel"
            className="sheet-tab"
            onClick={() => navigate({ screen: 'survivor', id, tab: t }, { replace: true })}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div id="sheet-panel" role="tabpanel" aria-labelledby={`tab-${current}`}>
        {current === 'stats' && (
          <>
            <StatsPanel survivor={s} />
            <TraitsPanel survivor={s} />
            {!dead && <GearPanel state={state} survivor={s} />}
          </>
        )}
        {current === 'bonds' && <BondsPanel state={state} survivor={s} />}
        {current === 'story' && <ChroniclePanel survivor={s} />}
      </div>
    </article>
  );
}

function BackLink({ to }: { to: 'roster' | 'memorial' }) {
  return (
    <div className="sheet-nav">
      <button type="button" className="back" onClick={() => goBack({ screen: to })}>
        <span aria-hidden="true">&lsaquo;</span> {to === 'roster' ? 'Roster' : 'Memorial Wall'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- header

function SheetHeader({ survivor: s, day }: { survivor: Survivor; day: number }) {
  const [renaming, setRenaming] = useState(false);
  const dead = s.status === 'dead';
  const status = survivorStatus(s, day);
  return (
    <header className="sheet-head">
      <div className="sheet-id">
        <Portrait survivor={s} size={148} memorial={dead} className="sheet-portrait" />
        <div className="sheet-names">
          <h2 id="sheet-name" className="sheet-name">
            <span className="first">{s.firstName}</span>
            {s.nickname && <span className="nick">&ldquo;{s.nickname}&rdquo;</span>}
            <span className="last">{s.lastName}</span>
          </h2>
          <p className="sheet-origin">{originLine(s)}</p>
          <p className="sheet-pronouns">{pronounLabel(s)}</p>
          {!dead && !renaming && (
            <button type="button" className="btn btn-small btn-quiet rename-btn" onClick={() => setRenaming(true)}>
              Rename
            </button>
          )}
        </div>
      </div>
      {renaming && <RenameForm survivor={s} onDone={() => setRenaming(false)} />}
      <p className="backstory">{s.backstory}</p>
      {dead ? (
        <div className="death">
          <p>
            Died on day {s.diedDay}. {s.causeOfDeath ? `${s.causeOfDeath}.` : ''}
          </p>
          <p className="death-days">
            {daysSurvived(s, day)} days with the guild, {s.counters.runs} {s.counters.runs === 1 ? 'run' : 'runs'}.
          </p>
        </div>
      ) : (
        <div className="sheet-condition">
          <p className={`status status-${status.tone}`}>{status.label}</p>
          <Vitals survivor={s} />
        </div>
      )}
    </header>
  );
}

function RenameForm({ survivor: s, onDone }: { survivor: Survivor; onDone: () => void }) {
  const { store } = useServices();
  const [first, setFirst] = useState(s.firstName);
  const [last, setLast] = useState(s.lastName);
  const problem = nameProblem(first) ?? nameProblem(last);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (problem) return;
    store.update((state) => renameSurvivor(state, s.id, first, last));
    onDone();
  };

  return (
    <form className="rename" onSubmit={submit}>
      <label>
        First name
        <input value={first} maxLength={NAME_MAX_LENGTH + 10} autoComplete="off" onChange={(e) => setFirst(e.target.value)} />
      </label>
      <label>
        Last name
        <input value={last} maxLength={NAME_MAX_LENGTH + 10} autoComplete="off" onChange={(e) => setLast(e.target.value)} />
      </label>
      {problem && <p className="field-error">{problem}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={problem !== undefined}>
          Save name
        </button>
        <button type="button" className="btn btn-quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- stats

function StatsPanel({ survivor: s }: { survivor: Survivor }) {
  const d = derived(s);
  return (
    <section className="panel" aria-labelledby="stats-title">
      <h3 id="stats-title" className="panel-title">
        Stats
      </h3>
      <ul className="stats">
        {statRows(s).map((r) => (
          <li key={r.id} className="stat">
            <span className="stat-value">{r.value}</span>
            <span className="stat-body">
              <span className="stat-name">{r.name}</span>
              {r.mod !== 0 && (
                <span className="stat-note">
                  {r.base} base, {r.mod > 0 ? `+${r.mod}` : r.mod} from traits and gear
                </span>
              )}
              {r.maxed ? (
                <span className="stat-note">As good as anyone gets.</span>
              ) : (
                s.status !== 'dead' && (
                  <Meter label="Practice" value={r.practice} max={r.needed} reading={`${r.practice} / ${r.needed} to reach ${r.base + 1}`} kind="practice" />
                )
              )}
            </span>
          </li>
        ))}
      </ul>
      <dl className="derived">
        <div>
          <dt>Max HP</dt>
          <dd>{d.maxHp}</dd>
        </div>
        <div>
          <dt>Carries</dt>
          <dd>{d.carry} loot</dd>
        </div>
        <div>
          <dt>{d.stressResist >= 0 ? 'Shrugs off' : 'Takes extra'}</dt>
          <dd>{Math.abs(d.stressResist)}% stress</dd>
        </div>
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- traits

function TraitsPanel({ survivor: s }: { survivor: Survivor }) {
  const groups = traitGroups(s);
  const hidden = s.status !== 'dead' && hiddenTraitCount(s) > 0;
  return (
    <section className="panel" aria-labelledby="traits-title">
      <h3 id="traits-title" className="panel-title">
        Traits
      </h3>
      {groups.length === 0 && <p className="empty">No traits yet. They come with time and trouble.</p>}
      {groups.map((g) => (
        <div key={g.kind} className={`trait-group kind-${g.kind}`}>
          <h4 className="trait-kind">{g.name}</h4>
          <ul className="traits">
            {g.traits.map((t) => (
              <li key={t.id}>
                <details className="trait">
                  <summary>{t.name}</summary>
                  <p>{t.description}</p>
                  <p className="trait-gained">{t.gained}</p>
                  {t.expires && <p className="trait-gained">{t.expires}</p>}
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {hidden && <p className="hint">There&rsquo;s something about {s.firstName} that hasn&rsquo;t shown itself yet.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- gear

function GearPanel({ state, survivor: s }: { state: GameState; survivor: Survivor }) {
  const [open, setOpen] = useState<Slot | null>(null);
  const editable = canChangeGear(s);
  return (
    <section className="panel" aria-labelledby="gear-title">
      <h3 id="gear-title" className="panel-title">
        Gear
      </h3>
      {!editable && <p className="hint">Gear can be changed when {s.firstName} is back at the Depot.</p>}
      <ul className="gear">
        {SLOTS.map((slot) => (
          <GearSlot
            key={slot}
            state={state}
            survivor={s}
            slot={slot}
            editable={editable}
            open={open === slot}
            onToggle={() => setOpen(open === slot ? null : slot)}
            onDone={() => setOpen(null)}
          />
        ))}
      </ul>
      <p className="stash-count">
        {state.stash.length === 0 ? 'The stash is empty.' : `${state.stash.length} ${state.stash.length === 1 ? 'item' : 'items'} in the stash.`}
      </p>
    </section>
  );
}

interface SlotProps {
  state: GameState;
  survivor: Survivor;
  slot: Slot;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}

function GearSlot({ state, survivor: s, slot, editable, open, onToggle, onDone }: SlotProps) {
  const { store } = useServices();
  const item = s.equipment[slot];
  const view = item ? itemView(item) : undefined;
  const options = stashFor(state, slot);
  const pickerId = `picker-${slot}`;

  const equip = (uid: string): void => {
    store.update((st) => {
      equipFromStash(st, getSurvivor(st, s.id), uid);
    });
    onDone();
  };
  const takeOff = (): void => {
    store.update((st) => {
      unequip(st, getSurvivor(st, s.id), slot);
    });
    onDone();
  };

  return (
    <li className="gear-slot">
      <div className="gear-row">
        <div className="gear-item">
          <span className="slot-name">{SLOT_NAMES[slot]}</span>
          {view ? (
            <>
              <span className="item-name">
                {view.name}
                {view.cherished && <span className="cherished"> Cherished</span>}
              </span>
              {view.stats && <span className="item-stats">{view.stats}</span>}
              <span className="item-desc">{view.description}</span>
            </>
          ) : (
            <span className="item-empty">Nothing</span>
          )}
        </div>
        {editable && (item || options.length > 0) && (
          <button type="button" className="btn btn-small" aria-expanded={open} aria-controls={pickerId} onClick={onToggle}>
            {item ? 'Change' : 'Equip'}
          </button>
        )}
      </div>
      {open && (
        <div id={pickerId} className="picker">
          {options.length === 0 ? (
            <p className="hint">Nothing in the stash fits here.</p>
          ) : (
            <ul>
              {options.map((it) => {
                const v = itemView(it);
                return (
                  <li key={it.uid}>
                    <button type="button" className="pick" onClick={() => equip(it.uid)}>
                      <span className="item-name">{v.name}</span>
                      <span className="item-stats">{v.stats || v.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {item && (
            <button type="button" className="btn btn-small btn-quiet" onClick={takeOff}>
              Put it in the stash
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- bonds

function BondsPanel({ state, survivor: s }: { state: GameState; survivor: Survivor }) {
  const list = bonds(state, s);
  return (
    <section className="panel" aria-labelledby="bonds-title">
      <h3 id="bonds-title" className="panel-title">
        How {s.firstName} gets on with everyone
      </h3>
      {list.length === 0 ? (
        <p className="empty">Nobody else is in the guild yet.</p>
      ) : (
        <ul className="bonds">
          {list.map((b) => (
            <li key={b.other.id}>
              <button type="button" className={`bond label-${b.label}`} onClick={() => navigate({ screen: 'survivor', id: b.other.id, tab: 'bonds' })}>
                <Portrait survivor={b.other} size={56} decorative />
                <span className="bond-body">
                  <span className="bond-name">
                    {b.other.firstName} {b.other.lastName}
                  </span>
                  <span className="bond-label">
                    {b.labelName}, {b.score > 0 ? `+${b.score}` : b.score}
                  </span>
                  <BondBar score={b.score} />
                  {b.ties.map((t) => (
                    <span key={t} className="bond-tie">
                      {t}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- chronicle

function ChroniclePanel({ survivor: s }: { survivor: Survivor }) {
  const days = chronicleByDay(s);
  return (
    <section className="journal" aria-labelledby="journal-title">
      <h3 id="journal-title" className="journal-title">
        The life of {s.firstName} {s.lastName}
      </h3>
      <p className="journal-counts">{lifeSummary(s).join(', ')}.</p>
      <ol className="journal-days">
        {days.map((d) => (
          <li key={d.day} className="journal-day">
            <h4 className="journal-date">Day {d.day}</h4>
            <ul>
              {d.entries.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
