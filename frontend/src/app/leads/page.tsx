
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  LogOut,
  BriefcaseBusiness,
  Filter,
  LoaderCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Converted",
  "Lost",
] as const;

type LeadStatus = (typeof STATUSES)[number];

type Lead = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  assigned_to: number | null;
  client_user_id?: number | null;
};

type CRMUser = {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "salesperson" | "client";
  is_active: boolean;
};

type LeadForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  notes: string;
  assigned_to: string;
  client_user_id: string;
};

const EMPTY_FORM: LeadForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "New",
  notes: "",
  assigned_to: "",
  client_user_id: "",
};

export default function LeadsPage() {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [roleLoading, setRoleLoading] = useState(true);
  const [salespeople, setSalespeople] = useState<CRMUser[]>([]);
  const [clients, setClients] = useState<CRMUser[]>([]);

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

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load leads. Please try again.");
      }

      const data: Lead[] = await response.json();
      setLeads(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, handleUnauthorized]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  
  const loadAdminData = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setRoleLoading(false);
      return;
    }

    try {
      const meResponse = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (meResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!meResponse.ok) return;

      const me = await meResponse.json();
      setCurrentRole(me.role ?? "");

      if (me.role === "admin") {
        const usersResponse = await fetch(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (usersResponse.status === 401) {
          handleUnauthorized();
          return;
        }

        if (usersResponse.ok) {
          const users: CRMUser[] = await usersResponse.json();

setSalespeople(
  users.filter(
    (user) => user.role === "salesperson" && user.is_active
  )
);

setClients(
  users.filter(
    (user) => user.role === "client" && user.is_active
  )
);
        }
      }
    } catch {
      // Could not load the user's role.
    } finally {
      setRoleLoading(false);
    }
  }, [getToken, handleUnauthorized]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }

  function openAddForm() {
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(lead: Lead) {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      company: lead.company ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      status: lead.status,
      notes: lead.notes ?? "",
      assigned_to: lead.assigned_to == null ? "" : String(lead.assigned_to),
      client_user_id: lead.client_user_id == null ? "" : String(lead.client_user_id),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingLead(null);
    setForm(EMPTY_FORM);
  }

  async function saveLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

     const payload = {
  name: form.name.trim(),
  company: form.company.trim() || null,
  email: form.email.trim() || null,
  phone: form.phone.trim() || null,
  status: form.status,
  notes: form.notes.trim() || null,
  ...(currentRole === "admin"
    ? {
        assigned_to: form.assigned_to
          ? Number(form.assigned_to)
          : null,
        client_user_id: form.client_user_id
          ? Number(form.client_user_id)
          : null,
      }
    : {}),
};

      const isEditing = editingLead !== null;

      const response = await fetch(
        isEditing
          ? `${API_URL}/api/leads/${editingLead.id}`
          : `${API_URL}/api/leads`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Could not save the lead.");
      }

      closeForm();
      setSuccess(
        isEditing
          ? "Lead updated successfully."
          : "Lead created successfully."
      );

      await loadLeads();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the lead."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(lead: Lead, status: LeadStatus) {
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Could not update lead status.");
      }

      setSuccess(`Status updated for ${lead.name}.`);
      await loadLeads();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update status."
      );
    }
  }

  async function deleteLead(lead: Lead) {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Could not delete lead.");
      }

      setSuccess(`${lead.name} was deleted.`);
      await loadLeads();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete the lead."
      );
    }
  }

  const filteredLeads = leads.filter((lead) => {
    const text = [
      lead.name,
      lead.company ?? "",
      lead.email ?? "",
      lead.phone ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "All" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center text-xl font-extrabold tracking-tight text-slate-900">
            <Image
                        src="/geni5-logo.png"
                        alt="Geni5"
                        width={100}
                        height={36}
                        priority
                        className="h-8 w-auto object-contain object-left"
                      /> 
            <span className="ml-3 hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">
              CRM Workspace
            </span>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] p-5 md:px-10 md:py-9">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-indigo-600"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-indigo-600">
              <Users size={22} />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">CRM workspace</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Leads</h1>
            <p className="mt-2 text-slate-500">
              Manage contacts, track sales progress, and view lead details.
            </p>
          </div>

          {(currentRole === "admin" || currentRole === "salesperson") && (
  <button
    type="button"
    onClick={openAddForm}
    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
  >
    <Plus size={19} />
    Add lead
  </button>
)}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard title="Total leads" value={leads.length} />
          <StatCard
            title="Active leads"
            value={leads.filter(
              (l) => !["Converted", "Lost"].includes(l.status)
            ).length}
          />
          <StatCard
            title="Converted leads"
            value={leads.filter((l) => l.status === "Converted").length}
          />
        </div>

        {showForm && (
          <form
            onSubmit={saveLead}
            className="mt-8 grid gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.25)] sm:grid-cols-2 md:p-7"
          >
            <div className="flex items-center justify-between sm:col-span-2">
              <h2 className="text-lg font-bold">
                {editingLead ? "Edit lead" : "Add a new lead"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <label className="grid gap-1 text-sm font-medium">
              Contact name *
              <input
                required
                maxLength={150}
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Company
              <input
                maxLength={150}
                value={form.company}
                onChange={(e) =>
                  setForm({ ...form, company: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Email
              <input
                type="email"
                maxLength={255}
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Phone
              <input
                maxLength={30}
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as LeadStatus,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            {currentRole === "admin" && (
  <>
    <label className="grid gap-1 text-sm font-medium sm:col-span-2">
      Assigned salesperson
      <select
        value={form.assigned_to}
        onChange={(e) =>
          setForm({ ...form, assigned_to: e.target.value })
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
      >
        <option value="">Unassigned</option>
        {salespeople.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name} ({person.email})
          </option>
        ))}
      </select>

      {salespeople.length === 0 && (
        <span className="text-xs font-normal text-slate-500">
          No active salespeople found. Create or activate a salesperson in Users.
        </span>
      )}
    </label>

    <label className="grid gap-1 text-sm font-medium sm:col-span-2">
      Link client account
      <select
        value={form.client_user_id}
        onChange={(e) =>
          setForm({ ...form, client_user_id: e.target.value })
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
      >
        <option value="">No linked client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.full_name} ({client.email})
          </option>
        ))}
      </select>

      {clients.length === 0 && (
        <span className="text-xs font-normal text-slate-500">
          No active clients found. Create or activate a client in Users.
        </span>
      )}
    </label>
  </>
)}

            <label className="grid gap-1 text-sm font-medium sm:col-span-2">
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/15 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingLead
                    ? "Save changes"
                    : "Create lead"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {success}
          </p>
        )}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 md:p-6">
            <div>
              <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><BriefcaseBusiness size={19} /></div><div><h2 className="text-lg font-bold tracking-tight">All leads</h2><p className="mt-1 text-sm text-slate-500">View and manage your lead pipeline</p></div></div>
              <p className="mt-1 text-sm text-slate-500">
                {filteredLeads.length} leads shown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
                <Search size={18} className="text-slate-400" />
                <input
                  aria-label="Search leads"
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-36 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400 sm:w-52"
                />
              </div>

              <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400" /><select
                aria-label="Filter leads by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select></div>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs text-slate-500 md:px-6"><span>{filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"} found</span><span>{statusFilter === "All" ? "All statuses" : `Status: ${statusFilter}`}</span></div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-indigo-600" />Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center md:p-16">
              <Users className="mx-auto text-slate-400" size={36} />
              <p className="mt-4 font-semibold text-slate-900">{search || statusFilter !== "All" ? "No matching leads" : "No leads yet"}</p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your search or status filter, or add a new lead to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Contact</th>
                    <th className="px-5 py-4 font-medium">Company</th>
                    <th className="px-5 py-4 font-medium">Email</th>
                    {currentRole === "admin" && <th className="px-5 py-4 font-medium">Assigned salesperson</th>}
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Created</th>
                    <th className="px-5 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="group transition-colors hover:bg-indigo-50/30">
                      <td className="whitespace-nowrap px-5 py-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-slate-900 transition hover:text-indigo-600 hover:underline"
                        >
                          {lead.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {lead.company || "—"}
                      </td>
                      <td className="px-5 py-4">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-indigo-600 transition hover:underline"
                          >
                            {lead.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      {currentRole === "admin" && (
                        <td className="px-5 py-4">
                          {salespeople.find((person) => person.id === lead.assigned_to)?.full_name ?? "Unassigned"}
                        </td>
                      )}
                     
<td className="px-5 py-4">
  {(currentRole === "admin" || currentRole === "salesperson") ? (
    <select
      aria-label={`Status for ${lead.name}`}
      value={lead.status}
      onChange={(e) =>
        void changeStatus(lead, e.target.value as LeadStatus)
      }
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-indigo-100 ${statusClass(lead.status)}`}
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  ) : (
    <span>{lead.status}</span>
  )}
</td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/leads/${lead.id}`}
                            title="View details"
                            aria-label={`View details for ${lead.name}`}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Eye size={16} />
                          </Link>
                          
{(currentRole === "admin" || currentRole === "salesperson") && (
  <button
    type="button"
    onClick={() => openEditForm(lead)}
    title="Edit lead"
    aria-label={`Edit ${lead.name}`}
    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
  >
    <Pencil size={16} />
  </button>
)}

{currentRole === "admin" && (
  <button
    type="button"
    onClick={() => void deleteLead(lead)}
    title="Delete lead"
    aria-label={`Delete ${lead.name}`}
    className="rounded-xl border border-red-100 bg-white p-2 text-red-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
  >
    <Trash2 size={16} />
  </button>
)}

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

function statusClass(status: LeadStatus) {
  switch (status) {
    case "New":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Contacted":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "Interested":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Converted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Lost":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(15,23,42,0.25)] transition hover:-translate-y-0.5 hover:shadow-md md:p-6">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
