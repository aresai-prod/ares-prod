import { useEffect, useState } from "react";
import type { OrgRole, PodAccess, Pod, User } from "../lib/types";
import { createOrgUser, fetchOrgUsers, updateOrgUser } from "../lib/api";

type TeamPanelProps = {
  pods: Pod[];
};

export default function TeamPanel({ pods }: TeamPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<OrgRole>("user");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgUsers()
      .then((data) => setUsers(data.users))
      .catch((err) => setStatus(err instanceof Error ? err.message : "Failed to load users"));
  }, []);

  async function handleCreate() {
    try {
      const podAccess: PodAccess[] = pods.map((pod) => ({ podId: pod.id, role: "viewer" }));
      const result = await createOrgUser({ email, name, role, podAccess });
      setUsers((prev) => [...prev, result.user]);
      setStatus(`User created. Temp password: ${result.tempPassword}`);
      setEmail("");
      setName("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  async function handleRoleChange(userId: string, nextRole: OrgRole) {
    const current = users.find((u) => u.id === userId);
    if (!current) return;
    const nextAccess =
      nextRole === "admin" ? pods.map((pod) => ({ podId: pod.id, role: "admin" as const })) : current.podAccess;
    const result = await updateOrgUser(userId, { role: nextRole, podAccess: nextAccess });
    setUsers((prev) => prev.map((user) => (user.id === result.user.id ? result.user : user)));
  }

  async function handlePodRoleChange(userId: string, podId: string, role: PodAccess["role"]) {
    const current = users.find((u) => u.id === userId);
    if (!current) return;
    const nextAccess: PodAccess[] = pods.map((pod) => {
      const existing = current.podAccess.find((entry) => entry.podId === pod.id);
      if (pod.id === podId) {
        return { podId, role };
      }
      return existing ?? { podId: pod.id, role: "viewer" };
    });
    const result = await updateOrgUser(userId, { podAccess: nextAccess });
    setUsers((prev) => prev.map((user) => (user.id === result.user.id ? result.user : user)));
  }

  return (
    <div className="drawer-panel">
      <div className="panel-header">
        <h2>Team</h2>
        <span className="panel-subtitle">Manage business users</span>
      </div>

      {status && <div className="error-banner">{status}</div>}

      <div className="team-form">
        <input value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
        <input value={email} placeholder="Email" onChange={(event) => setEmail(event.target.value)} />
        <select value={role} onChange={(event) => setRole(event.target.value as OrgRole)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button className="primary-button" onClick={handleCreate}>Add User</button>
      </div>

      <div className="team-list">
        {users.map((user) => (
          <div key={user.id} className="team-card">
            <div>
              <div className="team-name">{user.name}</div>
              <div className="panel-subtitle">{user.email}</div>
            </div>
            <div className="team-access">
              <select value={user.role} onChange={(event) => handleRoleChange(user.id, event.target.value as OrgRole)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="team-pods">
                {pods.map((pod) => {
                  const access = user.podAccess.find((entry) => entry.podId === pod.id);
                  return (
                    <div key={pod.id} className="team-pod-row">
                      <span>{pod.name}</span>
                      <select
                        value={access?.role ?? "viewer"}
                        onChange={(event) =>
                          handlePodRoleChange(user.id, pod.id, event.target.value as PodAccess["role"])
                        }
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
