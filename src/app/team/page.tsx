'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import { STATUS_COLORS, STATUS_LABELS, TaskStatus } from '@/lib/types';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

interface Task {
  id: string;
  task_name: string;
  project_id: string;
  status: string;
  due_date: string;
  owner_ids: string[];
  project_name: string;
}

interface AssignedTask {
  id: string;
  task_name: string;
  status: string;
  due_date: string;
  project_id: string;
  project_name: string;
  owner_ids: string[];
}

const AVATAR_COLORS = ['#0762C8', '#046A38', '#B29838', '#C8350D', '#437F94', '#1B365D', '#7C3AED', '#DB2777'];

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDigest, setShowDigest] = useState(false);

  // Add/Edit member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', role: '', initials: '', color: AVATAR_COLORS[0] });

  // Delete/Reassign state
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [teamRes, tasksRes] = await Promise.all([
        fetch('/api/team'),
        fetch('/api/tasks/this-week'),
      ]);

      const teamData = await teamRes.json();
      const tasksData = await tasksRes.json();

      setTeam(Array.isArray(teamData) ? teamData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTasksForMember(memberId: string) {
    return tasks.filter((t) => t.owner_ids?.includes(memberId));
  }

  function getCompletedForMember(memberId: string) {
    return tasks.filter(
      (t) => t.owner_ids?.includes(memberId) && t.status === 'done'
    );
  }

  // Auto-generate initials from name
  function autoInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
    return name.toUpperCase().substring(0, 2);
  }

  async function handleSaveMember() {
    const { name, role, initials, color } = memberForm;
    if (!name.trim() || !role.trim()) return;

    const payload = {
      name: name.trim(),
      role: role.trim(),
      initials: initials.trim() || autoInitials(name),
      color,
    };

    if (editingMemberId) {
      await fetch(`/api/team/${editingMemberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setShowAddMember(false);
    setEditingMemberId(null);
    setMemberForm({ name: '', role: '', initials: '', color: AVATAR_COLORS[0] });
    await fetchData();
  }

  function startEdit(member: TeamMember) {
    setEditingMemberId(member.id);
    setMemberForm({ name: member.name, role: member.role, initials: member.initials, color: member.color });
    setShowAddMember(true);
  }

  async function startDelete(member: TeamMember) {
    setReassignments({});

    const res = await fetch(`/api/team/${member.id}/assigned-tasks`);
    const data = await res.json();
    const tasks = Array.isArray(data) ? data : [];

    if (tasks.length === 0) {
      // No tasks — delete immediately, no modal
      await fetch(`/api/team/${member.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reassignments: [] }),
      });
      await fetchData();
      return;
    }

    // Has tasks — show reassignment modal
    setDeletingMember(member);
    setAssignedTasks(tasks);
  }

  async function confirmDelete() {
    if (!deletingMember) return;

    // Build reassignment payload
    const reassignmentList = Object.entries(reassignments)
      .filter(([, newOwnerId]) => newOwnerId !== '')
      .map(([taskId, newOwnerId]) => ({ taskId, newOwnerId }));

    await fetch(`/api/team/${deletingMember.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignments: reassignmentList }),
    });

    setDeletingMember(null);
    setAssignedTasks([]);
    setReassignments({});
    await fetchData();
  }

  function handleBulkReassign(newOwnerId: string) {
    const bulk: Record<string, string> = {};
    assignedTasks.forEach(t => { bulk[t.id] = newOwnerId; });
    setReassignments(bulk);
  }

  const allReassigned = assignedTasks.length === 0 ||
    assignedTasks.every(t => reassignments[t.id] && reassignments[t.id] !== '');

  const otherMembers = team.filter(m => m.id !== deletingMember?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-fe-navy font-fira text-lg">Loading team...</div>
      </div>
    );
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Weekly Digest view
  if (showDigest) {
    return (
      <div className="font-fira">
        <div className="flex items-center justify-between mb-6 no-print">
          <button
            onClick={() => setShowDigest(false)}
            className="flex items-center gap-1 text-sm text-fe-blue-gray hover:text-fe-navy font-fira transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Team
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-fe-navy text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-navy/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>

        <div className="mb-6">
          <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Weekly Digest</h1>
          <p className="text-sm text-fe-blue-gray mt-1">{weekLabel}</p>
        </div>

        <div className="space-y-6">
          {team.map(member => {
            const memberTasks = getTasksForMember(member.id);
            if (memberTasks.length === 0) return null;

            return (
              <div key={member.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar initials={member.initials} color={member.color} size="md" />
                  <div>
                    <div className="font-barlow font-bold text-lg text-fe-navy">{member.name}</div>
                    <div className="text-xs text-fe-blue-gray">{member.role} &middot; {memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''} this week</div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs text-fe-blue-gray font-fira font-normal">Task</th>
                      <th className="text-left py-2 text-xs text-fe-blue-gray font-fira font-normal">Project</th>
                      <th className="text-left py-2 text-xs text-fe-blue-gray font-fira font-normal">Due</th>
                      <th className="text-right py-2 text-xs text-fe-blue-gray font-fira font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberTasks.map(task => (
                      <tr key={task.id} className="border-b border-gray-50 last:border-b-0">
                        <td className="py-2 font-fira text-fe-anthracite">{task.task_name}</td>
                        <td className="py-2 font-fira text-fe-blue-gray">{task.project_name}</td>
                        <td className="py-2 font-fira text-fe-blue-gray">
                          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-fira font-bold"
                            style={{
                              backgroundColor: `${STATUS_COLORS[task.status as TaskStatus] || '#9CA3AF'}15`,
                              color: STATUS_COLORS[task.status as TaskStatus] || '#9CA3AF',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[task.status as TaskStatus] || '#9CA3AF' }}
                            />
                            {STATUS_LABELS[task.status as TaskStatus] || task.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {team.every(m => getTasksForMember(m.id).length === 0) && (
            <p className="text-center text-fe-blue-gray py-8">No tasks due this week.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="font-fira">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">
          Team
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowAddMember(true);
              setEditingMemberId(null);
              setMemberForm({ name: '', role: '', initials: '', color: AVATAR_COLORS[team.length % AVATAR_COLORS.length] });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
          <button
            onClick={() => setShowDigest(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-navy text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-navy/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Weekly Digest
          </button>
        </div>
      </div>

      {/* Add/Edit Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">
              {editingMemberId ? 'Edit Team Member' : 'Add Team Member'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Name</label>
                <input
                  type="text"
                  value={memberForm.name}
                  onChange={e => {
                    const name = e.target.value;
                    setMemberForm(prev => ({
                      ...prev,
                      name,
                      initials: prev.initials === autoInitials(prev.name) || !prev.initials
                        ? autoInitials(name)
                        : prev.initials,
                    }));
                  }}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Role</label>
                <input
                  type="text"
                  value={memberForm.role}
                  onChange={e => setMemberForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g., Operations Lead"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Initials</label>
                  <input
                    type="text"
                    value={memberForm.initials}
                    onChange={e => setMemberForm(prev => ({ ...prev, initials: e.target.value.toUpperCase().substring(0, 2) }))}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Color</label>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {AVATAR_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setMemberForm(prev => ({ ...prev, color: c }))}
                        className={`w-7 h-7 rounded-full border-2 transition-colors ${
                          memberForm.color === c ? 'border-fe-navy scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Preview */}
              {memberForm.name && (
                <div className="flex items-center gap-3 pt-2">
                  <Avatar initials={memberForm.initials || autoInitials(memberForm.name)} color={memberForm.color} size="md" />
                  <div>
                    <div className="font-barlow font-bold text-sm text-fe-navy">{memberForm.name}</div>
                    <div className="text-xs text-fe-blue-gray">{memberForm.role || 'Role'}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowAddMember(false); setEditingMemberId(null); }}
                className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMember}
                disabled={!memberForm.name.trim() || !memberForm.role.trim()}
                className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
              >
                {editingMemberId ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment Modal (only shown when member has assigned tasks) */}
      {deletingMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={deletingMember.initials} color={deletingMember.color} size="md" />
              <div>
                <h2 className="font-barlow font-bold text-lg text-fe-navy">
                  Remove {deletingMember.name}
                </h2>
                <p className="text-xs text-fe-blue-gray">
                  {assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''} must be reassigned first.
                </p>
              </div>
            </div>

            {/* Bulk reassign */}
            {otherMembers.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-fira text-fe-blue-gray">Reassign all to:</span>
                <select
                  onChange={e => { if (e.target.value) handleBulkReassign(e.target.value); }}
                  defaultValue=""
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                >
                  <option value="">Choose...</option>
                  {otherMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Task-by-task reassignment */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {assignedTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-fe-offwhite gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-fira text-fe-anthracite truncate">{task.task_name}</div>
                    <div className="text-xs text-fe-blue-gray">{task.project_name}</div>
                  </div>
                  <select
                    value={reassignments[task.id] || ''}
                    onChange={e => setReassignments(prev => ({ ...prev, [task.id]: e.target.value }))}
                    className={`shrink-0 px-2 py-1 border rounded text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue ${
                      reassignments[task.id] ? 'border-fe-blue bg-fe-blue/5' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Reassign to...</option>
                    {otherMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setDeletingMember(null); setAssignedTasks([]); setReassignments({}); }}
                className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!allReassigned}
                className="px-4 py-2 bg-fe-red text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-red/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reassign & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {team.map((member) => {
          const memberTasks = getTasksForMember(member.id);
          const completedTasks = getCompletedForMember(member.id);
          const totalThisWeek = memberTasks.length;
          const completedThisWeek = completedTasks.length;
          const completionRate =
            totalThisWeek > 0
              ? Math.round((completedThisWeek / totalThisWeek) * 100)
              : null;

          return (
            <div
              key={member.id}
              className="bg-white rounded-xl border border-gray-100 p-6 group relative"
            >
              {/* Edit/Delete buttons */}
              <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                <button
                  onClick={() => startEdit(member)}
                  className="p-1.5 rounded-lg text-fe-blue-gray hover:text-fe-blue hover:bg-fe-blue/10 transition-colors"
                  title="Edit member"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => startDelete(member)}
                  className="p-1.5 rounded-lg text-fe-blue-gray hover:text-fe-red hover:bg-red-50 transition-colors"
                  title="Remove member"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="flex justify-center mb-3">
                <Avatar
                  initials={member.initials}
                  color={member.color}
                  size="lg"
                />
              </div>

              <div className="font-barlow font-bold text-lg text-center text-fe-navy">
                {member.name}
              </div>
              <div className="font-fira text-sm text-fe-blue-gray text-center">
                {member.role}
              </div>

              <div className="border-t border-gray-100 my-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-fe-blue-gray">
                    Tasks This Week
                  </span>
                  <span className="font-bold">{totalThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-fe-blue-gray">
                    Completed This Week
                  </span>
                  <span className="font-bold">{completedThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-fe-blue-gray">
                    Completion Rate
                  </span>
                  <span className="font-bold">
                    {completionRate !== null ? `${completionRate}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {totalThisWeek > 8 && (
                <div className="bg-amber-50 text-amber-700 rounded-lg p-2 text-xs mt-4 text-center">
                  Heavy workload this week
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
