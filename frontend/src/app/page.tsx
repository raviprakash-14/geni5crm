
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Search,
  Plus,
  Building2,
  Mail,
  TrendingUp,
  Pencil,
  Trash2,
  X,
  Eye,
  LogOut,
  Clock,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  AlertCircle,
  Sparkles,
  MessagesSquare,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Converted",
  "Lost",
] as const;

type LeadStatus = (typeof STATUSES)[number];

type CRMUser = {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "salesperson" | "client";
};

type Lead = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone?: string | null;
  status: LeadStatus;
  notes?: string | null;
  created_at: string;
};

type FollowUp = {
  id: number;
  lead_id: number;
  title: string;
  due_at: string;
  notes: string | null;
  status: "Pending" | "Completed";
};

type LeadForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  notes: string;
};

const EMPTY_FORM: LeadForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "New",
  notes: "",
};

export default function Home() {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [currentUser, setCurrentUser] = useState<CRMUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);

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

      const headers = { Authorization: `Bearer ${token}` };
      const [response, followUpsResponse] = await Promise.all([
        fetch(`${API_URL}/api/leads`, { headers }),
        fetch(`${API_URL}/api/follow-ups`, { headers }),
      ]);

      if (response.status === 401 || followUpsResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load leads.");
      }

      const data: Lead[] = await response.json();
      setLeads(data);
      // Follow-ups are a dashboard enhancement; don't hide leads if this endpoint fails.
      if (followUpsResponse.ok) {
        const followUpData: FollowUp[] = await followUpsResponse.json();
        setFollowUps(followUpData);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load leads. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, handleUnauthorized]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

 
useEffect(() => {
  let cancelled = false;

  async function loadCurrentUser() {
    try {
      const token = localStorage.getItem("access_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not identify the current user.");
      }

      const user: CRMUser = await response.json();

      if (cancelled) return;

      if (user.role === "client") {
        router.replace("/client/messages");
        return;
      }

      setCurrentUser(user);
      setAuthChecking(false);
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load your account details."
        );
        setAuthChecking(false);
      }
    }
  }

  void loadCurrentUser();

  return () => {
    cancelled = true;
  };
}, [handleUnauthorized, router]);


  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }

  function openAddForm() {
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setSuccess("");
    setError("");
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
    });
    setSuccess("");
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingLead(null);
    setForm(EMPTY_FORM);
  }

  function updateField<K extends keyof LeadForm>(
    field: K,
    value: LeadForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
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
      };

      const isEditing = editingLead !== null;
      const url = isEditing
        ? `${API_URL}/api/leads/${editingLead.id}`
        : `${API_URL}/api/leads`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

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
        err instanceof Error
          ? err.message
          : "Could not update status. Please try again."
      );
    }
  }

  async function deleteLead(lead: Lead) {
    const confirmed = window.confirm(
      `Delete ${lead.name}? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        err instanceof Error
          ? err.message
          : "Could not delete the lead. Please try again."
      );
    }
  }

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = [
      lead.name,
      lead.company ?? "",
      lead.email ?? "",
      lead.phone ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const converted = leads.filter(
    (lead) => lead.status === "Converted"
  ).length;

  const active = leads.filter(
    (lead) => !["Converted", "Lost"].includes(lead.status)
  ).length;

  const lost = leads.filter(
  (lead) => lead.status === "Lost"
).length;
  const pendingFollowUps = followUps
    .filter((item) => item.status === "Pending")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const overdueFollowUps = pendingFollowUps.filter(
    (item) => new Date(item.due_at).getTime() < Date.now()
  );
  const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  if (authChecking) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-500">
          Checking your session...
        </p>
      </div>
    </main>
  );
}

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900 md:flex">
      <aside className="border-r border-slate-200/80 bg-white p-5 shadow-sm md:sticky md:top-0 md:flex md:min-h-screen md:w-64 md:flex-col">
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
            className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 font-semibold text-indigo-700"
          >
            <LayoutDashboard size={19} />
            Dashboard
          </Link>

          
<Link
  href="/leads"
  className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
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
  className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
>
  <CalendarClock size={19} />
  Follow-ups
</Link>

{currentUser?.role === "admin" && (
  <Link
    href="/users"
    className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
  >
    <Users size={19} />
    Users
  </Link>
)}

          
        </nav>
        <nav className="mt-10 space-y-2">
  {/* Keep your existing Dashboard, Leads,
      Follow-ups and role-based Users links */}
</nav>

{/* Sign out — visible directly below navigation */}
<button
  type="button"
  onClick={logout}
  className="mt-5 flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
>
  <LogOut size={19} />
  Sign out
</button>

{/* Keep the workspace card below */}
<div className="mt-auto rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 text-sm text-slate-600">
  <p className="font-semibold text-slate-800">Sales workspace</p>
  <p className="mt-1">
    Keep your leads and follow-ups organized.
  </p>
</div>
        
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <header className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-500"><span>Workspace</span><span className="text-slate-300">/</span><span className="text-indigo-600">Overview</span></p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you{currentUser?.full_name ? `, ${currentUser.full_name.split(" ")[0]}` : ""}.</h2>
            <p className="mt-2 text-slate-500">
              Here&apos;s your sales workspace at a glance. Here&apos;s what needs your attention today.
              {currentUser && (
                <span className="ml-2 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold capitalize text-indigo-700">
                  {currentUser.role}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <Plus size={19} />
            Add lead
          </button>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total leads"
            value={leads.length}
            icon={<Users size={21} />}
          />
          <StatCard
            title="Active leads"
            value={active}
            icon={<TrendingUp size={21} />}
          />
          <StatCard
            title="Converted leads"
            value={converted}
            icon={<Building2 size={21} />}
          />
          <StatCard
  title="Lost leads"
  value={lost}
  icon={<Users size={21} />}
/>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-600"><Sparkles size={17} /><span className="text-xs font-bold uppercase tracking-[0.16em]">Pipeline overview</span></div>
                <h3 className="mt-2 text-xl font-bold tracking-tight">Lead health</h3>
                <p className="mt-1 text-sm text-slate-500">Understand how your contacts are progressing.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">{conversionRate}% converted</span>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${conversionRate}% of leads are converted`}>
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${conversionRate}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STATUSES.map((status) => {
                const count = leads.filter((lead) => lead.status === status).length;
                const color = status === "Converted" ? "bg-emerald-500" : status === "Lost" ? "bg-rose-500" : status === "Interested" ? "bg-violet-500" : status === "Contacted" ? "bg-sky-500" : "bg-amber-500";
                return <div key={status} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} /><div className="min-w-0"><p className="text-lg font-bold">{count}</p><p className="truncate text-xs text-slate-500">{status}</p></div></div>;
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div><div className="flex items-center gap-2 text-indigo-600"><CalendarClock size={17} /><span className="text-xs font-bold uppercase tracking-[0.16em]">Stay on track</span></div><h3 className="mt-2 text-xl font-bold tracking-tight">Follow-ups</h3><p className="mt-1 text-sm text-slate-500">Your next actions and reminders.</p></div>
              <Link href="/follow-ups" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50">View all <ArrowUpRight size={15} /></Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Pending</p><p className="mt-1 text-2xl font-bold">{pendingFollowUps.length}</p></div>
              <div className={`rounded-xl p-4 ${overdueFollowUps.length ? "bg-rose-50" : "bg-emerald-50"}`}><p className={`text-sm ${overdueFollowUps.length ? "text-rose-700" : "text-emerald-700"}`}>Overdue</p><p className={`mt-1 text-2xl font-bold ${overdueFollowUps.length ? "text-rose-700" : "text-emerald-700"}`}>{overdueFollowUps.length}</p></div>
            </div>
            {pendingFollowUps.length > 0 ? <div className="mt-4 space-y-3">{pendingFollowUps.slice(0, 2).map((item) => { const lead = leads.find((candidate) => candidate.id === item.lead_id); const overdue = new Date(item.due_at).getTime() < Date.now(); return <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${overdue ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"}`}>{overdue ? <AlertCircle size={16} /> : <Clock size={16} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 truncate text-xs text-slate-500">{lead?.name ?? `Lead #${item.lead_id}`}</p><p className={`mt-1 text-xs font-medium ${overdue ? "text-rose-600" : "text-slate-500"}`}>{overdue ? "Overdue · " : "Due · "}{new Date(item.due_at).toLocaleString()}</p></div></div>; })}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={22} /><p className="mt-2 text-sm font-semibold text-slate-700">You&apos;re all caught up</p><p className="mt-1 text-xs text-slate-500">No pending follow-ups right now.</p></div>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold tracking-tight">Recently added leads</h3><p className="mt-1 text-sm text-slate-500">A quick look at your latest contacts.</p></div><Link href="/leads" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50">Manage leads <ArrowUpRight size={15} /></Link></div>
          {recentLeads.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Your recent leads will appear here when you add them.</p> : <div className="divide-y divide-slate-100">{recentLeads.map((lead) => <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">{lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="min-w-0"><Link href={`/leads/${lead.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-indigo-600">{lead.name}</Link><p className="mt-0.5 truncate text-xs text-slate-500">{lead.company || lead.email || "No company or email added"}</p></div></div><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lead.status === "Converted" ? "bg-emerald-50 text-emerald-700" : lead.status === "Lost" ? "bg-rose-50 text-rose-700" : lead.status === "Interested" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{lead.status}</span><span className="hidden text-xs text-slate-400 sm:inline">{new Date(lead.created_at).toLocaleDateString()}</span></div></div>)}</div>}
        </section>

        {showForm && (
          <form
            onSubmit={saveLead}
            className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 sm:grid-cols-2"
          >
            <div className="flex items-center justify-between sm:col-span-2">
              <h3 className="text-lg font-bold">
                {editingLead ? "Edit lead" : "Add a new lead"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-lg p-2 hover:bg-slate-100"
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
                onChange={(e) => updateField("name", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Company
              <input
                maxLength={150}
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Email
              <input
                type="email"
                maxLength={255}
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Phone
              <input
                maxLength={30}
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as LeadStatus)
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium sm:col-span-2">
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
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
                className="rounded-lg border border-slate-300 px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="mt-6 rounded-xl bg-green-50 p-4 text-green-700"
          >
            {success}
          </p>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
            <div>
              <h3 className="text-lg font-bold">Leads</h3>
              <p className="mt-1 text-sm text-slate-500">
                Manage your sales contacts and their progress.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
                <Search size={18} className="text-slate-400" />
                <input
                  aria-label="Search leads"
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-36 bg-transparent py-2 outline-none sm:w-44"
                />
              </div>

              <select
                aria-label="Filter leads by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-slate-500">Loading leads...</p>
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Users
                className="mx-auto text-slate-400"
                size={36}
              />
              <p className="mt-3 font-semibold">No leads found</p>
              <p className="mt-1 text-sm text-slate-500">
                Try another search or add a new lead.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Contact</th>
                    <th className="px-5 py-4 font-medium">Company</th>
                    <th className="px-5 py-4 font-medium">Email</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Created</th>
                    <th className="px-5 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-indigo-50/40">
                      <td className="whitespace-nowrap px-5 py-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
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
                            className="flex items-center gap-2 text-indigo-600"
                          >
                            <Mail size={15} />
                            {lead.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <select
                          aria-label={`Status for ${lead.name}`}
                          value={lead.status}
                          onChange={(e) =>
                            void changeStatus(
                              lead,
                              e.target.value as LeadStatus
                            )
                          }
                          className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/leads/${lead.id}`}
                            aria-label={`View details for ${lead.name}`}
                            title="View details"
                            className="rounded-lg border border-indigo-100 p-2 text-indigo-600 hover:bg-indigo-50"
                          >
                            <Eye size={16} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => openEditForm(lead)}
                            aria-label={`Edit ${lead.name}`}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                          >
                            <Pencil size={16} />
                          </button>

                          {currentUser?.role === "admin" && (
                            <button
                              type="button"
                              onClick={() => void deleteLead(lead)}
                              aria-label={`Delete ${lead.name}`}
                              title="Delete lead"
                              className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
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

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">{icon}</span>
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-400">Across your current workspace</p>
    </div>
  );
}
