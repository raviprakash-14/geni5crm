
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Settings,
  LogOut,
  UserPlus,
  RefreshCw,
  Trash2,
  MessagesSquare,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Role = "admin" | "salesperson" | "client";

type CRMUser = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

type UserForm = {
  full_name: string;
  email: string;
  password: string;
  role: "salesperson" | "client";
};

const EMPTY_FORM: UserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "salesperson",
};

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<CRMUser[]>([]);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState<CRMUser | null>(null);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }, [router]);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      return null;
    }

    return token;
  }, [handleUnauthorized]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();
      if (!token) return;

      const meResponse = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (meResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!meResponse.ok) {
        throw new Error("Could not verify your account.");
      }

      const me: CRMUser = await meResponse.json();
      setCurrentUser(me);

      if (me.role !== "admin") {
        setError("Only Geni5 Admins can access user management.");
        return;
      }

      const response = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load users.");
      }

      setUsers(await response.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load users. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, handleUnauthorized]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Could not create user.");
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      setSuccess("User created successfully.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: CRMUser, changes: Partial<CRMUser>) {
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(changes),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Could not update user.");
      }

      setSuccess("User updated successfully.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    }
  }

  async function deleteUser(user: CRMUser) {
    if (user.id === currentUser?.id) {
      setError("You cannot delete the account you are currently signed in with.");
      return;
    }

    const confirmed = window.confirm(
      `Delete the account for ${user.full_name} (${user.email})? This action cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ||
            "Could not delete user. The backend may not support deletion or this account may still be in use."
        );
      }

      setSuccess(`User ${user.full_name} was deleted successfully.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete user.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900 md:flex">
      <aside className="border-b border-slate-200/80 bg-white p-5 shadow-sm md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r md:p-6 md:shadow-none">
        <h1 className="text-2xl font-bold tracking-tight">
          <Image
            src="/geni5-logo.png"
            alt="Geni5"
            width={100}
            height={36}
            priority
            className="h-8 w-auto object-contain object-left"
          />  
          <span className="mt-1 block text-sm font-medium text-slate-500">
            CRM Workspace
          </span>
        </h1>

        <nav className="mt-10 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <LayoutDashboard size={19} />
            Dashboard
          </Link>

          <Link
            href="/leads"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Users size={19} />
            Leads
          </Link>
          <Link
            href="/messages"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            <MessagesSquare size={19} />
            Messages
          </Link>

          <Link
            href="/follow-ups"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <CalendarClock size={19} />
            Follow-ups
          </Link>

          <Link
            href="/users"
            className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 font-semibold text-indigo-700"
          >
            <UserPlus size={19} />
            Users
          </Link>

        </nav>

        <div className="mt-12 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Admin workspace</p>
          <p className="mt-1">Manage CRM accounts and permissions.</p>
        </div>

        <button
          onClick={logout}
          className="mt-6 flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={19} />
          Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-8 xl:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Workspace / Administration</p>
            <h2 className="mt-2 text-3xl font-bold">User management</h2>
            <p className="mt-2 text-slate-500">
              Create accounts and manage CRM access.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void loadUsers()}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 hover:bg-slate-100"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={() => {
                setError("");
                setSuccess("");
                setForm(EMPTY_FORM);
                setShowForm(!showForm);
              }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
            >
              <UserPlus size={18} />
              Add user
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Total accounts"
            value={users.length}
            detail="All registered CRM users"
            icon={<Users size={19} />}
          />
          <SummaryCard
            label="Active accounts"
            value={users.filter((user) => user.is_active).length}
            detail="Accounts currently enabled"
            icon={<UserPlus size={19} />}
          />
          <SummaryCard
            label="Inactive accounts"
            value={users.filter((user) => !user.is_active).length}
            detail="Accounts currently disabled"
            icon={<Settings size={19} />}
          />
        </section>

        {currentUser && currentUser.role !== "admin" && (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-800">
            User management is restricted to Geni5 Admins.
          </p>
        )}

        {showForm && (
          <form
            onSubmit={saveUser}
            className="mt-8 grid gap-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <h3 className="text-lg font-bold sm:col-span-2">
              Create a user
            </h3>

            <label className="grid gap-1 text-sm font-medium">
              Full name *
              <input
                required
                maxLength={150}
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Email *
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Temporary password *
              <input
                required
                type="password"
                minLength={12}
                maxLength={128}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
              />
              <span className="text-xs font-normal text-slate-500">
                Use at least 12 characters.
              </span>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Role *
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as UserForm["role"],
                  })
                }
                className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="salesperson">Salesperson</option>
                <option value="client">Client</option>
              </select>
            </label>

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create user"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="mt-6 rounded-xl bg-green-50 p-4 text-green-700">
            {success}
          </p>
        )}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h3 className="text-lg font-bold">CRM users</h3>
              <p className="mt-1 text-sm text-slate-500">
                {users.length} registered account{users.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-slate-500">Loading users...</p>
          ) : error && currentUser?.role !== "admin" ? (
            <p className="p-8 text-slate-500">Admin access is required.</p>
          ) : users.length === 0 ? (
            <p className="p-8 text-slate-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Name</th>
                    <th className="px-5 py-4 font-medium">Email</th>
                    <th className="px-5 py-4 font-medium">Role</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Joined</th>
                    <th className="px-5 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold">
                        {user.full_name}
                      </td>
                      <td className="px-5 py-4">{user.email}</td>
                      <td className="px-5 py-4">
                        <select
                          aria-label={`Role for ${user.full_name}`}
                          value={user.role}
                          disabled={user.id === currentUser?.id}
                          onChange={(e) =>
                            void updateUser(user, {
                              role: e.target.value as Role,
                            })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
                        >
                          <option value="admin">Admin</option>
                          <option value="salesperson">Salesperson</option>
                          <option value="client">Client</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={user.id === currentUser?.id}
                            onClick={() =>
                              void updateUser(user, {
                                is_active: !user.is_active,
                              })
                            }
className="inline-flex w-28 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            disabled={user.id === currentUser?.id}
                            onClick={() => void deleteUser(user)}
                            title={user.id === currentUser?.id ? "You cannot delete your own account" : `Delete ${user.full_name}`}
                            aria-label={`Delete user ${user.full_name}`}
                            className="inline-flex w-28 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}


function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">{icon}</div>
      </div>
    </article>
  );
}
