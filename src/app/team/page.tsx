'use client';

import { useState, useEffect, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Holder {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: string;
}

interface WorkItem {
  id: string;
  kind: 'task' | 'deliverable';
  title: string;
  context: string;
  project_id: string | null;
  status: string;
  due_date: string | null;
}

interface RoleWorkspace {
  id: string;
  name: string;
  color: string;
  description: string | null;
  sort_order: number;
  holders: Holder[];
  task_count: number;
  deliverable_count: number;
  work_count: number;
  work: WorkItem[];
}

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
  vendor_role_id: string | null;
}

interface DigestItem extends WorkItem {
  role_id: string;
  role_name: string;
}

interface DigestPerson {
  id: string;
  name: string;
  initials: string;
  color: string;
  roles: { id: string; name: string; color: string }[];
  item_count: number;
  items: DigestItem[];
}

interface Toast {
  message: string;
  visible: boolean;
}

/* ------------------------------------------------------------------ */
/* Status pills                                                        */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: '#9CA3AF' },
  in_progress: { label: 'In Progress', color: '#0762C8' },
  in_review: { label: 'In Review', color: '#B29838' },
  approved: { label: 'Approved', color: '#437F94' },
  delivered: { label: 'Delivered', color: '#046A38' },
  done: { label: 'Done', color: '#046A38' },
  blocked: { label: 'Blocked', color: '#C8350D' },
};

function statusStyle(status: string) {
  return STATUS_STYLE[status] || { label: status || 'Unknown', color: '#647692' };
}

function StatusPill({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-fira font-semibold text-white"
      style={{ backgroundColor: s.color }}
    >
      {s.label}
    </span>
  );
}

const AVATAR_COLORS = ['#0762C8', '#046A38', '#B29838', '#C8350D', '#437F94', '#1B365D', '#7C3AED', '#DB2777'];

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function fmtDate(d: string | null): string {
  if (!d) return 'No date';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(d: string | null, status: string): boolean {
  if (!d) return false;
  if (['done', 'approved', 'delivered'].includes(status)) return false;
  const dt = new Date(d + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dt < today;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Tab = 'roles' | 'review';

export default function TeamPage() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('roles');

  // expanded role work lists
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // change-holder modal
  const [assigningRole, setAssigningRole] = useState<RoleWorkspace | null>(null);
  const [selectedHolderIds, setSelectedHolderIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // weekly digest
  const [digest, setDigest] = useState<DigestPerson[]>([]);
  const [digestWindow, setDigestWindow] = useState<'week' | 'all'>('week');
  const [digestRange, setDigestRange] = useState<{ start: string; end: string } | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const [toast, setToast] = useState<Toast>({ message: '', visible: false });
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3200);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (tab === 'review') fetchDigest(digestWindow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, digestWindow]);

  async function fetchData() {
    setLoading(true);
    try {
      const [rolesRes, teamRes] = await Promise.all([
        fetch('/api/roles-workspace'),
        fetch('/api/team'),
      ]);
      const rolesData = await rolesRes.json();
      const teamData = await teamRes.json();
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setTeam(Array.isArray(teamData) ? teamData : []);
    } catch (e) {
      console.error('Failed to load team workspace', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDigest(win: 'week' | 'all') {
    setDigestLoading(true);
    try {
      const res = await fetch(`/api/roles-workspace/weekly-digest?window=${win}`);
      const data = await res.json();
      setDigest(Array.isArray(data.people) ? data.people : []);
      setDigestRange({ start: data.week_start, end: data.week_end });
    } catch (e) {
      console.error('Failed to load digest', e);
    } finally {
      setDigestLoading(false);
    }
  }

  function openAssign(role: RoleWorkspace) {
    setAssigningRole(role);
    setSelectedHolderIds(role.holders.map((h) => h.id));
  }

  function toggleHolder(id: string) {
    setSelectedHolderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveHolders() {
    if (!assigningRole) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roles-workspace/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'role_holders',
          role_id: assigningRole.id,
          member_ids: selectedHolderIds,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const names = team.filter((m) => selectedHolderIds.includes(m.id)).map((m) => m.name);
      showToast(
        names.length
          ? `${assigningRole.name} → ${names.join(', ')}. Work reassigned.`
          : `${assigningRole.name} left unassigned.`
      );
      setAssigningRole(null);
      await fetchData();
    } catch (e) {
      showToast('Could not update role holder.');
    } finally {
      setSaving(false);
    }
  }

  const totalWork = roles.reduce((sum, r) => sum + r.work_count, 0);

  return (
    <div className="min-h-screen">
      <PageHeader
        eyebrow="Operations Center"
        title="Team & Roles"
        subtitle="Work is owned by roles. Assign a person to a role and everything that role owns follows them."
        actions={
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => setTab('roles')}
              className={`px-3 py-1.5 text-sm font-fira font-semibold border ${
                tab === 'roles'
                  ? 'bg-fe-navy text-white border-fe-navy'
                  : 'bg-white text-fe-navy border-fe-line'
              }`}
            >
              Roles & Work
            </button>
            <button
              onClick={() => setTab('review')}
              className={`px-3 py-1.5 text-sm font-fira font-semibold border ${
                tab === 'review'
                  ? 'bg-fe-navy text-white border-fe-navy'
                  : 'bg-white text-fe-navy border-fe-line'
              }`}
            >
              Weekly Review
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="fe-cards">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="fe-panel h-48 animate-pulse bg-white" />
          ))}
        </div>
      ) : tab === 'roles' ? (
        <RolesTab
          roles={roles}
          expanded={expanded}
          setExpanded={setExpanded}
          onAssign={openAssign}
          totalWork={totalWork}
        />
      ) : (
        <ReviewTab
          digest={digest}
          loading={digestLoading}
          window={digestWindow}
          setWindow={setDigestWindow}
          range={digestRange}
          onRefresh={() => fetchDigest(digestWindow)}
        />
      )}

      {/* Change-holder modal */}
      {assigningRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
          <div className="fe-panel bg-white w-full max-w-md">
            <div className="fe-panel-header">
              <h3 className="font-barlow font-bold text-fe-navy">
                Assign “{assigningRole.name}”
              </h3>
              <button
                onClick={() => setAssigningRole(null)}
                className="text-fe-blue-gray hover:text-fe-navy text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm font-fira text-fe-blue-gray mb-4">
                Choose who holds this role. Everything the role owns
                ({assigningRole.work_count} item{assigningRole.work_count === 1 ? '' : 's'})
                will be reassigned to them automatically. You can select more than one person.
              </p>
              <div className="space-y-1 max-h-72 overflow-y-auto border border-fe-line">
                {team.map((m) => {
                  const checked = selectedHolderIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleHolder(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-fe-line last:border-b-0 ${
                        checked ? 'bg-fe-blue/5' : 'bg-white hover:bg-fe-canvas'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 border flex items-center justify-center ${
                          checked ? 'bg-fe-blue border-fe-blue' : 'border-fe-line-strong bg-white'
                        }`}
                      >
                        {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                      </span>
                      <Avatar initials={m.initials} color={m.color} size="sm" />
                      <span className="font-fira text-sm text-fe-navy">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-fe-line">
              <button
                onClick={() => setAssigningRole(null)}
                className="px-3 py-1.5 text-sm font-fira border border-fe-line text-fe-navy bg-white"
              >
                Cancel
              </button>
              <button
                onClick={saveHolders}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-fira font-semibold bg-fe-blue text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save & reassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-fe-navy text-white px-4 py-2.5 text-sm font-fira z-50 no-print">
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Roles & Work tab                                                    */
/* ------------------------------------------------------------------ */

function RolesTab({
  roles,
  expanded,
  setExpanded,
  onAssign,
  totalWork,
}: {
  roles: RoleWorkspace[];
  expanded: Record<string, boolean>;
  setExpanded: (fn: (p: Record<string, boolean>) => Record<string, boolean>) => void;
  onAssign: (r: RoleWorkspace) => void;
  totalWork: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-6 mb-5 text-sm font-fira text-fe-blue-gray no-print">
        <span><strong className="text-fe-navy">{roles.length}</strong> roles</span>
        <span><strong className="text-fe-navy">{roles.filter((r) => r.holders.length).length}</strong> filled</span>
        <span><strong className="text-fe-navy">{totalWork}</strong> items of work owned</span>
      </div>

      <div className="fe-cards">
        {roles.map((role) => {
          const isOpen = expanded[role.id];
          const grouped = groupByContext(role.work);
          return (
            <div key={role.id} className="fe-panel bg-white flex flex-col">
              {/* color spine header */}
              <div className="flex items-stretch">
                <div className="w-1.5 shrink-0" style={{ backgroundColor: role.color }} />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-barlow font-bold text-fe-navy text-lg leading-tight">
                        {role.name}
                      </h3>
                      {role.description && (
                        <p className="text-xs font-fira text-fe-blue-gray mt-0.5 line-clamp-2">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* holder */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {role.holders.length ? (
                        <>
                          <div className="flex -space-x-1.5">
                            {role.holders.map((h) => (
                              <Avatar key={h.id} initials={h.initials} color={h.color} size="sm" title={h.name} />
                            ))}
                          </div>
                          <span className="font-fira text-sm text-fe-navy truncate">
                            {role.holders.map((h) => h.name).join(', ')}
                          </span>
                        </>
                      ) : (
                        <span className="font-fira text-sm text-fe-red">Unassigned</span>
                      )}
                    </div>
                    <button
                      onClick={() => onAssign(role)}
                      className="px-2.5 py-1 text-xs font-fira font-semibold border border-fe-line text-fe-navy bg-white hover:bg-fe-canvas shrink-0 no-print"
                    >
                      {role.holders.length ? 'Change' : 'Assign'}
                    </button>
                  </div>

                  {/* counts */}
                  <div className="mt-3 flex items-center gap-4 text-xs font-fira text-fe-blue-gray border-t border-fe-line pt-3">
                    <span><strong className="text-fe-navy">{role.task_count}</strong> tasks</span>
                    <span><strong className="text-fe-navy">{role.deliverable_count}</strong> deliverables</span>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [role.id]: !p[role.id] }))}
                      className="ml-auto text-fe-blue font-semibold no-print"
                      disabled={role.work_count === 0}
                    >
                      {role.work_count === 0 ? 'No work' : isOpen ? 'Hide work' : `View work (${role.work_count})`}
                    </button>
                  </div>
                </div>
              </div>

              {/* work list */}
              {isOpen && role.work_count > 0 && (
                <div className="border-t border-fe-line bg-fe-canvas/40">
                  {Object.entries(grouped).map(([context, items]) => (
                    <div key={context} className="px-4 py-3 border-b border-fe-line last:border-b-0">
                      <p className="fe-eyebrow mb-2">{context}</p>
                      <ul className="space-y-1.5">
                        {items.map((w) => (
                          <li key={`${w.kind}-${w.id}`} className="flex items-center gap-2 text-sm">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: w.kind === 'task' ? '#0762C8' : '#437F94' }}
                              title={w.kind}
                            />
                            <span className="font-fira text-fe-navy truncate flex-1">{w.title}</span>
                            {w.due_date && (
                              <span
                                className={`font-fira text-xs shrink-0 ${
                                  isOverdue(w.due_date, w.status) ? 'text-fe-red font-semibold' : 'text-fe-blue-gray'
                                }`}
                              >
                                {fmtDate(w.due_date)}
                              </span>
                            )}
                            <StatusPill status={w.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupByContext(work: WorkItem[]): Record<string, WorkItem[]> {
  const out: Record<string, WorkItem[]> = {};
  for (const w of work) {
    const key = w.context || 'General';
    (out[key] = out[key] || []).push(w);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Weekly Review tab                                                   */
/* ------------------------------------------------------------------ */

function ReviewTab({
  digest,
  loading,
  window: win,
  setWindow,
  range,
  onRefresh,
}: {
  digest: DigestPerson[];
  loading: boolean;
  window: 'week' | 'all';
  setWindow: (w: 'week' | 'all') => void;
  range: { start: string; end: string } | null;
  onRefresh: () => void;
}) {
  const rangeLabel =
    range && win === 'week'
      ? `${fmtDate(range.start)} – ${fmtDate(range.end)}`
      : 'All open work';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWindow('week')}
            className={`px-3 py-1.5 text-sm font-fira font-semibold border ${
              win === 'week' ? 'bg-fe-blue text-white border-fe-blue' : 'bg-white text-fe-navy border-fe-line'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setWindow('all')}
            className={`px-3 py-1.5 text-sm font-fira font-semibold border ${
              win === 'all' ? 'bg-fe-blue text-white border-fe-blue' : 'bg-white text-fe-navy border-fe-line'
            }`}
          >
            All Open
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-sm font-fira border border-fe-line text-fe-navy bg-white"
          >
            Refresh
          </button>
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-sm font-fira font-semibold bg-fe-navy text-white"
        >
          Print / Send
        </button>
      </div>

      {/* Printable header */}
      <div className="mb-5">
        <h2 className="font-barlow font-extrabold text-xl text-fe-navy leading-none">
          What&apos;s Due Per Person
        </h2>
        <p className="text-sm font-fira text-fe-blue-gray mt-1">
          Fundamental Edge · Weekly Review · {rangeLabel}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="fe-panel h-32 animate-pulse bg-white" />
          ))}
        </div>
      ) : digest.length === 0 ? (
        <div className="fe-panel bg-white p-10 text-center">
          <p className="font-fira text-fe-blue-gray">No people found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {digest.map((person) => (
            <div key={person.id} className="fe-panel bg-white break-inside-avoid">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-fe-line">
                <Avatar initials={person.initials} color={person.color} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-barlow font-bold text-fe-navy">{person.name}</h3>
                    {person.roles.map((r) => (
                      <span
                        key={r.id}
                        className="px-2 py-0.5 text-[10px] font-fira font-semibold text-white"
                        style={{ backgroundColor: r.color }}
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="font-barlow font-bold text-fe-navy text-lg shrink-0">
                  {person.item_count}
                </span>
              </div>

              {person.items.length === 0 ? (
                <p className="px-4 py-3 font-fira text-sm text-fe-blue-gray">
                  Nothing due {win === 'week' ? 'this week' : 'open'}.
                </p>
              ) : (
                <ul>
                  {person.items.map((w) => (
                    <li
                      key={`${w.kind}-${w.id}`}
                      className="flex items-center gap-3 px-4 py-2 border-b border-fe-line last:border-b-0"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: w.kind === 'task' ? '#0762C8' : '#437F94' }}
                      />
                      <span className="font-fira text-sm text-fe-navy flex-1 truncate">
                        {w.title}
                        <span className="text-fe-blue-gray"> · {w.context}</span>
                      </span>
                      {w.due_date && (
                        <span
                          className={`font-fira text-xs shrink-0 ${
                            isOverdue(w.due_date, w.status) ? 'text-fe-red font-semibold' : 'text-fe-blue-gray'
                          }`}
                        >
                          {isOverdue(w.due_date, w.status) ? 'Overdue · ' : ''}
                          {fmtDate(w.due_date)}
                        </span>
                      )}
                      <StatusPill status={w.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
