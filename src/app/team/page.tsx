'use client';

import { useState, useEffect, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import { STATUS_COLORS, STATUS_LABELS, TaskStatus } from '@/lib/types';

interface Role {
  id: string;
  name: string;
  description: string | null;
  color: string;
  holders: { id: string; name: string; initials: string; color: string }[];
  project_task_count: number;
  template_task_count: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  role_id: string | null;
  initials: string;
  color: string;
  role_data: { id: string; name: string; description: string | null; color: string } | null;
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

interface AssignmentItem {
  id: string;
  task_name: string;
  context_name: string;
  status: string;
  due_date: string | null;
  type: 'project' | 'template';
}

interface Toast {
  message: string;
  visible: boolean;
}

const AVATAR_COLORS = ['#0762C8', '#046A38', '#B29838', '#C8350D', '#437F94', '#1B365D', '#7C3AED', '#DB2777'];
const ROLE_COLORS = ['#0762C8', '#046A38', '#B29838', '#C8350D', '#437F94', '#1B365D', '#7C3AED', '#DB2777', '#6366f1', '#059669'];

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDigest, setShowDigest] = useState(false);

  // Add/Edit member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', role: '', role_id: '' as string, initials: '', color: AVATAR_COLORS[0] });

  // Delete/Reassign state
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [projectAssignments, setProjectAssignments] = useState<AssignmentItem[]>([]);
  const [templateAssignments, setTemplateAssignments] = useState<AssignmentItem[]>([]);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});

  // Inline new member in modal
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineForm, setInlineForm] = useState({ name: '', role: '', role_id: '' as string, initials: '', color: AVATAR_COLORS[0] });

  // Roles panel
  const [showRolesPanel, setShowRolesPanel] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', color: ROLE_COLORS[0] });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [deleteRoleReassignTo, setDeleteRoleReassignTo] = useState('');

  // Toast
  const [toast, setToast] = useState<Toast>({ message: '', visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3500);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [teamRes, tasksRes, rolesRes] = await Promise.all([
        fetch('/api/team'),
        fetch('/api/tasks/this-week'),
        fetch('/api/roles'),
      ]);

      const teamData = await teamRes.json();
      const tasksData = await tasksRes.json();
      const rolesData = await rolesRes.json();

      setTeam(Array.isArray(teamData) ? teamData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
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

  function autoInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
    return name.toUpperCase().substring(0, 2);
  }

  async function handleSaveMember() {
    const { name, role, role_id, initials, color } = memberForm;
    if (!name.trim()) return;

    // If a role is selected, use that role's name as the role string
    const selectedRole = roles.find(r => r.id === role_id);
    const roleStr = selectedRole ? selectedRole.name : role.trim();

    if (!roleStr) return;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      role: roleStr,
      initials: initials.trim() || autoInitials(name),
      color,
    };
    if (role_id) payload.role_id = role_id;
    else payload.role_id = null;

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
    setMemberForm({ name: '', role: '', role_id: '', initials: '', color: AVATAR_COLORS[0] });
    await fetchData();
  }

  function startEdit(member: TeamMember) {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name,
      role: member.role,
      role_id: member.role_id || '',
      initials: member.initials,
      color: member.color,
    });
    setShowAddMember(true);
  }

  async function startDelete(member: TeamMember) {
    setReassignments({});
    setShowInlineCreate(false);
    setInlineForm({ name: '', role: '', role_id: '', initials: '', color: AVATAR_COLORS[0] });

    const res = await fetch(`/api/team/${member.id}/assigned-tasks`);
    const data = await res.json();

    const projTasks: AssignmentItem[] = data.project_tasks || [];
    const tmplTasks: AssignmentItem[] = data.template_tasks || [];

    if (projTasks.length === 0 && tmplTasks.length === 0) {
      await fetch(`/api/team/${member.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectReassignments: [], templateReassignments: [] }),
      });
      showToast(`${member.name} removed from team`);
      await fetchData();
      return;
    }

    setDeletingMember(member);
    setProjectAssignments(projTasks);
    setTemplateAssignments(tmplTasks);
  }

  async function handleInlineCreateMember() {
    const { name, role, role_id, initials, color } = inlineForm;
    if (!name.trim()) return;

    const selectedRole = roles.find(r => r.id === role_id);
    const roleStr = selectedRole ? selectedRole.name : role.trim();
    if (!roleStr) return;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      role: roleStr,
      initials: initials.trim() || autoInitials(name),
      color,
    };
    if (role_id) payload.role_id = role_id;

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const newMember = await res.json();
    if (newMember.id) {
      const teamRes = await fetch('/api/team');
      const teamData = await teamRes.json();
      setTeam(Array.isArray(teamData) ? teamData : []);
      setShowInlineCreate(false);
      setInlineForm({ name: '', role: '', role_id: '', initials: '', color: AVATAR_COLORS[0] });
    }
  }

  async function confirmDelete() {
    if (!deletingMember) return;

    const projectReassignments = projectAssignments
      .filter(t => reassignments[t.id] && reassignments[t.id] !== '')
      .map(t => ({ taskId: t.id, newOwnerId: reassignments[t.id] }));

    const templateReassignments = templateAssignments
      .filter(t => reassignments[t.id] && reassignments[t.id] !== '')
      .map(t => {
        const newMember = team.find(m => m.id === reassignments[t.id]);
        const newOwnerName = newMember ? newMember.name.split(' ')[0] : 'Unassigned';
        return { taskId: t.id, newOwnerName };
      });

    await fetch(`/api/team/${deletingMember.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectReassignments, templateReassignments }),
    });

    const totalReassigned = projectReassignments.length + templateReassignments.length;
    const reassignedToIds = [...new Set([
      ...projectReassignments.map(r => r.newOwnerId),
      ...templateReassignments.map(r => {
        const m = team.find(tm => tm.name.split(' ')[0] === r.newOwnerName);
        return m?.id || '';
      }),
    ].filter(Boolean))];

    const ownerNames = reassignedToIds
      .map(id => team.find(m => m.id === id)?.name.split(' ')[0])
      .filter(Boolean);

    if (totalReassigned > 0 && ownerNames.length > 0) {
      showToast(`${deletingMember.name} removed - ${totalReassigned} task${totalReassigned !== 1 ? 's' : ''} reassigned to ${ownerNames.join(', ')}`);
    } else {
      showToast(`${deletingMember.name} removed from team`);
    }

    setDeletingMember(null);
    setProjectAssignments([]);
    setTemplateAssignments([]);
    setReassignments({});
    await fetchData();
  }

  // Roles CRUD
  async function handleSaveRole() {
    const { name, description, color } = roleForm;
    if (!name.trim()) return;

    if (editingRoleId) {
      await fetch(`/api/roles/${editingRoleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color }),
      });
      showToast(`Role "${name.trim()}" updated`);
    } else {
      await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color }),
      });
      showToast(`Role "${name.trim()}" created`);
    }

    setShowAddRole(false);
    setEditingRoleId(null);
    setRoleForm({ name: '', description: '', color: ROLE_COLORS[0] });
    await fetchData();
  }

  async function handleDeleteRole() {
    if (!deletingRole) return;

    const hasUsage = deletingRole.holders.length > 0 ||
      deletingRole.project_task_count > 0 ||
      deletingRole.template_task_count > 0;

    const payload: Record<string, unknown> = {};
    if (hasUsage && deleteRoleReassignTo) {
      payload.reassign_to_role_id = deleteRoleReassignTo;
    }

    const res = await fetch(`/api/roles/${deletingRole.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      const data = await res.json();
      const taskCount = data.total_task_count || 0;
      showToast(`This role has ${taskCount} task${taskCount !== 1 ? 's' : ''} assigned. Reassign them before deleting.`);
    } else {
      showToast(`Role "${deletingRole.name}" deleted`);
    }

    setDeletingRole(null);
    setDeleteRoleReassignTo('');
    await fetchData();
  }

  const allItems = [...projectAssignments, ...templateAssignments];

  function handleBulkReassign(newOwnerId: string) {
    const bulk: Record<string, string> = {};
    allItems.forEach(t => { bulk[t.id] = newOwnerId; });
    setReassignments(bulk);
  }

  const allReassigned = allItems.length === 0 ||
    allItems.every(t => reassignments[t.id] && reassignments[t.id] !== '');

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
                    <div className="text-xs text-fe-blue-gray">
                      {member.role_data ? (
                        <><span className="font-bold" style={{ color: member.role_data.color }}>{member.role_data.name}</span> &middot; </>
                      ) : (
                        <>{member.role} &middot; </>
                      )}
                      {memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''} this week
                    </div>
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

  // Roles Panel view
  if (showRolesPanel) {
    return (
      <div className="font-fira">
        {/* Toast */}
        {toast.visible && (
          <div className="fixed top-6 right-6 z-[60] animate-in slide-in-from-top-2">
            <div className="bg-fe-navy text-white px-5 py-3 rounded-lg shadow-lg text-sm font-fira flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {toast.message}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRolesPanel(false)}
              className="flex items-center gap-1 text-sm text-fe-blue-gray hover:text-fe-navy font-fira transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Team
            </button>
          </div>
          <button
            onClick={() => {
              setShowAddRole(true);
              setEditingRoleId(null);
              setRoleForm({ name: '', description: '', color: ROLE_COLORS[roles.length % ROLE_COLORS.length] });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Role
          </button>
        </div>

        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-6">Manage Roles</h1>

        {/* Add/Edit Role Modal */}
        {showAddRole && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">
                {editingRoleId ? 'Edit Role' : 'Add Role'}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Name</label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={e => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Marketing Lead"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Description</label>
                  <input
                    type="text"
                    value={roleForm.description}
                    onChange={e => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Color</label>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {ROLE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setRoleForm(prev => ({ ...prev, color: c }))}
                        className={`w-7 h-7 rounded-full border-2 transition-colors ${
                          roleForm.color === c ? 'border-fe-navy scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setShowAddRole(false); setEditingRoleId(null); }}
                  className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={!roleForm.name.trim()}
                  className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
                >
                  {editingRoleId ? 'Save Changes' : 'Add Role'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Role Confirm */}
        {deletingRole && (() => {
          const totalTasks = deletingRole.project_task_count + deletingRole.template_task_count;
          const hasUsage = deletingRole.holders.length > 0 || totalTasks > 0;
          const otherRoles = roles.filter(r => r.id !== deletingRole.id);

          return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <h2 className="font-barlow font-bold text-lg text-fe-navy mb-2">
                  Delete &ldquo;{deletingRole.name}&rdquo;?
                </h2>
                {hasUsage && (
                  <div className="mb-4">
                    <p className="text-sm text-fe-red mb-3">
                      This role has {totalTasks} task{totalTasks !== 1 ? 's' : ''} assigned
                      {deletingRole.holders.length > 0 ? ` and ${deletingRole.holders.length} member${deletingRole.holders.length !== 1 ? 's' : ''}` : ''}.
                      Reassign them to a different role before deleting.
                    </p>
                    <div>
                      <label className="block text-xs font-fira font-bold text-fe-navy mb-1">Reassign all to:</label>
                      <select
                        value={deleteRoleReassignTo}
                        onChange={e => setDeleteRoleReassignTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
                      >
                        <option value="">Select a role...</option>
                        {otherRoles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setDeletingRole(null); setDeleteRoleReassignTo(''); }}
                    className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteRole}
                    disabled={hasUsage && !deleteRoleReassignTo}
                    className="px-4 py-2 bg-fe-red text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-red/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {hasUsage && deleteRoleReassignTo ? 'Reassign & Delete' : 'Delete Role'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Roles Grid */}
        {roles.length === 0 ? (
          <p className="text-center text-fe-blue-gray py-8">No roles defined yet. Add your first role above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map(role => (
              <div key={role.id} className="bg-white rounded-xl border border-gray-100 p-5 group relative">
                <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingRoleId(role.id);
                      setRoleForm({ name: role.name, description: role.description || '', color: role.color });
                      setShowAddRole(true);
                    }}
                    className="p-1.5 rounded-lg text-fe-blue-gray hover:text-fe-blue hover:bg-fe-blue/10 transition-colors"
                    title="Edit role"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeletingRole(role)}
                    className="p-1.5 rounded-lg text-fe-blue-gray hover:text-fe-red hover:bg-red-50 transition-colors"
                    title="Delete role"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  <h3 className="font-barlow font-bold text-lg text-fe-navy">{role.name}</h3>
                </div>

                {role.description && (
                  <p className="text-sm text-fe-blue-gray mb-3">{role.description}</p>
                )}

                <div className="border-t border-gray-100 pt-3 mt-3">
                  {role.holders.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-fe-blue-gray">Held by:</span>
                      {role.holders.map(h => (
                        <div key={h.id} className="flex items-center gap-1.5">
                          <Avatar initials={h.initials} color={h.color} size="sm" />
                          <span className="text-xs font-fira text-fe-anthracite">{h.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600 font-fira">No one assigned</span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs text-fe-blue-gray">
                  <span>{role.project_task_count} project task{role.project_task_count !== 1 ? 's' : ''}</span>
                  <span>{role.template_task_count} template task{role.template_task_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="font-fira">
      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-[60] animate-in slide-in-from-top-2">
          <div className="bg-fe-navy text-white px-5 py-3 rounded-lg shadow-lg text-sm font-fira flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {toast.message}
          </div>
        </div>
      )}

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
              setMemberForm({ name: '', role: '', role_id: '', initials: '', color: AVATAR_COLORS[team.length % AVATAR_COLORS.length] });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
          <button
            onClick={() => setShowRolesPanel(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-fe-anthracite rounded-lg text-sm font-fira font-bold hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Manage Roles
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
                {roles.length > 0 ? (
                  <select
                    value={memberForm.role_id}
                    onChange={e => {
                      const roleId = e.target.value;
                      const selectedRole = roles.find(r => r.id === roleId);
                      setMemberForm(prev => ({
                        ...prev,
                        role_id: roleId,
                        role: selectedRole ? selectedRole.name : prev.role,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
                  >
                    <option value="">Select a role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={memberForm.role}
                    onChange={e => setMemberForm(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g., Operations Lead"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                )}
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
              {memberForm.name && (
                <div className="flex items-center gap-3 pt-2">
                  <Avatar initials={memberForm.initials || autoInitials(memberForm.name)} color={memberForm.color} size="md" />
                  <div>
                    <div className="font-barlow font-bold text-sm text-fe-navy">{memberForm.name}</div>
                    <div className="text-xs text-fe-blue-gray">
                      {memberForm.role_id
                        ? roles.find(r => r.id === memberForm.role_id)?.name || 'Role'
                        : memberForm.role || 'Role'}
                    </div>
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
                disabled={!memberForm.name.trim() || (!memberForm.role.trim() && !memberForm.role_id)}
                className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
              >
                {editingMemberId ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment Modal */}
      {deletingMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <Avatar initials={deletingMember.initials} color={deletingMember.color} size="md" />
              <div>
                <h2 className="font-barlow font-bold text-lg text-fe-navy">
                  Remove {deletingMember.name}
                </h2>
                <p className="text-xs text-fe-blue-gray">
                  {allItems.length} task{allItems.length !== 1 ? 's' : ''} must be reassigned first.
                </p>
              </div>
            </div>

            {/* Bulk reassign */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
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

            {/* Scrollable task sections */}
            <div className="overflow-y-auto flex-1 min-h-0 space-y-5">
              {projectAssignments.length > 0 && (
                <div>
                  <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-2">
                    Active Project Tasks ({projectAssignments.length})
                  </h3>
                  <div className="space-y-1.5">
                    {projectAssignments.map(task => (
                      <div key={task.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-fe-offwhite gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-fira text-fe-anthracite truncate">{task.task_name}</div>
                          <div className="text-xs text-fe-blue-gray">{task.context_name}</div>
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
                </div>
              )}

              {templateAssignments.length > 0 && (
                <div>
                  <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-2">
                    Template Tasks ({templateAssignments.length})
                  </h3>
                  <div className="space-y-1.5">
                    {templateAssignments.map(task => (
                      <div key={task.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50/50 gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-fira text-fe-anthracite truncate">{task.task_name}</div>
                          <div className="text-xs text-fe-blue-gray">{task.context_name}</div>
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
                </div>
              )}
            </div>

            {/* Inline create new member */}
            <div className="border-t border-gray-100 pt-4 mt-4 shrink-0">
              {!showInlineCreate ? (
                <button
                  onClick={() => setShowInlineCreate(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-fira text-fe-blue hover:text-fe-blue/80 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create new member to assign to
                </button>
              ) : (
                <div className="bg-fe-offwhite rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={inlineForm.name}
                      onChange={e => setInlineForm(prev => ({ ...prev, name: e.target.value, initials: autoInitials(e.target.value) }))}
                      placeholder="Name"
                      className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue"
                    />
                    {roles.length > 0 ? (
                      <select
                        value={inlineForm.role_id}
                        onChange={e => {
                          const roleId = e.target.value;
                          const selectedRole = roles.find(r => r.id === roleId);
                          setInlineForm(prev => ({
                            ...prev,
                            role_id: roleId,
                            role: selectedRole ? selectedRole.name : prev.role,
                          }));
                        }}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue bg-white"
                      >
                        <option value="">Select role...</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={inlineForm.role}
                        onChange={e => setInlineForm(prev => ({ ...prev, role: e.target.value }))}
                        placeholder="Role"
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {AVATAR_COLORS.slice(0, 6).map(c => (
                      <button
                        key={c}
                        onClick={() => setInlineForm(prev => ({ ...prev, color: c }))}
                        className={`w-5 h-5 rounded-full border-2 transition-colors ${
                          inlineForm.color === c ? 'border-fe-navy' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleInlineCreateMember}
                      disabled={!inlineForm.name.trim() || (!inlineForm.role.trim() && !inlineForm.role_id)}
                      className="px-3 py-1.5 bg-fe-blue text-white rounded-lg text-xs font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowInlineCreate(false)}
                      className="px-3 py-1.5 bg-gray-100 text-fe-anthracite rounded-lg text-xs hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex gap-3 mt-4 shrink-0">
              <button
                onClick={() => { setDeletingMember(null); setProjectAssignments([]); setTemplateAssignments([]); setReassignments({}); }}
                className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!allReassigned}
                className="px-4 py-2 bg-fe-red text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-red/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Remove Member
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
              <div className="font-fira text-sm text-center">
                {member.role_data ? (
                  <span style={{ color: member.role_data.color }} className="font-bold">
                    {member.role_data.name}
                  </span>
                ) : (
                  <span className="text-fe-blue-gray">{member.role}</span>
                )}
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
