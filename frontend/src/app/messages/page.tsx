"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  LoaderCircle,
  MessageCircle,
  MessagesSquare,
  Search,
  Send,
  UserRound,
} from "lucide-react";

const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api`;

type Lead = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

type Message = {
  id: number;
  lead_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: "admin" | "salesperson" | "client" | string;
  body: string;
  created_at: string;
};

type CurrentUser = { id: number; full_name?: string; role: string };
type Preview = { body: string; created_at: string };

function senderLabel(message: Message, currentUserId: number | undefined) {
  if (message.sender_id === currentUserId) return "You";

  const name = message.sender_name?.trim() || "Unknown sender";
  switch (message.sender_role) {
    case "admin":
      return `Admin · ${name}`;
    case "salesperson":
      return `Salesperson · ${name}`;
    case "client":
      return `Client · ${name}`;
    default:
      return name;
  }
}

export default function SalespersonMessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [query, setQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversationError, setConversationError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = useCallback(() => localStorage.getItem("access_token"), []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }, [router]);

  const headers = useCallback(
    (json = false): HeadersInit => {
      const accessToken = token();
      return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      };
    },
    [token],
  );
  useEffect(() => {
  if (!messagesLoading) {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }
}, [messages, messagesLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      const accessToken = token();
      if (!accessToken) {
        logout();
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [meResponse, leadsResponse] = await Promise.all([
          fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${API_URL}/leads`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (meResponse.status === 401 || leadsResponse.status === 401) {
          logout();
          return;
        }
        if (!meResponse.ok) throw new Error("Could not verify your account.");

        const currentUser: CurrentUser = await meResponse.json();
        if (currentUser.role !== "salesperson" && currentUser.role !== "admin") {
          router.replace(currentUser.role === "client" ? "/client/messages" : "/");
          return;
        }

        if (!leadsResponse.ok) {
          const data = await leadsResponse.json().catch(() => ({}));
          throw new Error(
            typeof data.detail === "string" ? data.detail : "Could not load leads.",
          );
        }

        const leadData: Lead[] = await leadsResponse.json();
        if (cancelled) return;

        setUser(currentUser);
        setLeads(leadData);
        setSelectedLeadId((current) =>
          current && leadData.some((lead) => lead.id === current)
            ? current
            : leadData[0]?.id ?? null,
        );

        const previewResults = await Promise.all(
          leadData.map(async (lead) => {
            try {
              const response = await fetch(
                `${API_URL}/leads/${lead.id}/messages`,
                { headers: { Authorization: `Bearer ${accessToken}` } },
              );
              if (!response.ok) return null;

              const list: Message[] = await response.json();
              const latest = list[list.length - 1];
              return latest
                ? ([lead.id, {
                    body: latest.body,
                    created_at: latest.created_at,
                  }] as const)
                : null;
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          const next: Record<number, Preview> = {};
          for (const item of previewResults) {
            if (item) next[item[0]] = item[1];
          }
          setPreviews(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load the messages inbox.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInbox();
    return () => {
      cancelled = true;
    };
  }, [logout, router, token]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return leads;
    return leads.filter((lead) =>
      `${lead.name} ${lead.company ?? ""} ${lead.email ?? ""}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [leads, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!selectedLeadId) {
        setMessages([]);
        setConversationError("");
        return;
      }

      const accessToken = token();
      if (!accessToken) {
        logout();
        return;
      }

      setMessagesLoading(true);
      setConversationError("");

      try {
        const response = await fetch(
          `${API_URL}/leads/${selectedLeadId}/messages`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        if (response.status === 401) {
          logout();
          return;
        }
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "This lead's in-app conversation is unavailable. The lead may not have a linked client account.",
          );
        }

        const data: Message[] = await response.json();
        if (!cancelled) setMessages(data);
      } catch (err) {
        if (!cancelled) {
          setMessages([]);
          setConversationError(
            err instanceof Error ? err.message : "Could not load this conversation.",
          );
        }
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedLeadId, logout, token]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    if (!body || !selectedLeadId || sending) return;
    if (!token()) {
      logout();
      return;
    }

    setSending(true);
    setConversationError("");

    try {
      const response = await fetch(`${API_URL}/leads/${selectedLeadId}/messages`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ body }),
      });

      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not send this message.",
        );
      }

      const saved: Message = await response.json();
      setMessages((current) => [...current, saved]);
      setPreviews((current) => ({
        ...current,
        [selectedLeadId]: { body: saved.body, created_at: saved.created_at },
      }));
      setMessageText("");
    } catch (err) {
      setConversationError(
        err instanceof Error ? err.message : "Could not send this message.",
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-24 rounded-2xl bg-white" />
          <div className="h-[560px] rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-700"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">
              <MessagesSquare size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                Geni5 CRM · Sales workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Messages</h1>
              <p className="mt-1 text-sm text-slate-500">
                Find a lead and continue the conversation.
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {user?.full_name ? `Signed in as ${user.full_name}` : "Sales inbox"}
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {leads.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <MessageCircle size={30} className="mx-auto text-slate-400" />
            <h2 className="mt-4 font-semibold">No leads yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a lead first to see it in your sales workspace.
            </p>
            <Link href="/leads" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              View leads
            </Link>
          </section>
        ) : (
          <section className="grid min-h-[620px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="font-semibold">Leads & conversations</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {leads.length} {leads.length === 1 ? "lead" : "leads"}
                </p>
              </div>

              <label className="relative mb-4 block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search leads..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </label>

              <div className="space-y-2 overflow-y-auto">
                {filteredLeads.map((lead) => {
                  const selected = lead.id === selectedLeadId;
                  const preview = previews[lead.id];
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      aria-pressed={selected}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-indigo-200 bg-indigo-50"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                          <Building2 size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{lead.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {lead.company || lead.email || "No company added"}
                          </span>
                          <span className="mt-2 block truncate text-xs text-slate-500">
                            {preview?.body || "No messages yet"}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">
                    No leads match your search.
                  </p>
                )}
              </div>
            </aside>

              <section className="flex h-[min(75vh,760px)] min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">              {selectedLead ? (
                <>
                  <header className="flex items-center gap-3 border-b border-slate-200 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <UserRound size={21} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{selectedLead.name}</h2>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {selectedLead.company || selectedLead.email || "Lead conversation"}
                      </p>
                    </div>
                    <Link href={`/leads/${selectedLead.id}`} className="ml-auto shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                      View lead
                    </Link>
                  </header>

                  {conversationError && (
                    <div role="alert" className="m-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertCircle size={17} className="mt-0.5 shrink-0" />
                      <span>{conversationError}</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <LoaderCircle size={17} className="animate-spin" /> Loading conversation…
                        <div ref={messagesEndRef} />
                      </div>
                    ) : conversationError ? (
                      <div className="flex min-h-48 flex-col items-center justify-center text-center">
                        <MessageCircle size={26} className="text-slate-400" />
                        <p className="mt-3 font-medium text-slate-700">Conversation unavailable</p>
                        <p className="mt-1 max-w-md text-sm text-slate-500">
                          You can still contact this lead by email or phone from the lead details page.
                        </p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex min-h-48 flex-col items-center justify-center text-center">
                        <MessageCircle size={26} className="text-slate-400" />
                        <p className="mt-3 font-medium text-slate-700">No messages yet</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Send the first message if this lead has an in-app client account.
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const own = message.sender_id === user?.id;
                        return (
                          <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                            <article className={`max-w-[88%] rounded-2xl px-4 py-3 ${own ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-900"}`}>
                              <p className={`mb-1 text-[11px] font-semibold ${own ? "text-indigo-100" : "text-slate-500"}`}>
                                {senderLabel(message, user?.id)}
                              </p>
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                              <time className={`mt-2 block text-right text-[11px] ${own ? "text-indigo-100" : "text-slate-400"}`}>
                                {new Date(message.created_at).toLocaleString()}
                              </time>
                            </article>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={sendMessage} className="border-t border-slate-200 p-4 sm:p-5">
                    <label htmlFor="sales-message" className="mb-2 block text-sm font-semibold text-slate-700">
                      Reply
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <textarea
                        id="sales-message"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        onKeyDown={(event) => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing
  ) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}}
                        maxLength={5000}
                        rows={3}
                        placeholder="Write a message…"
                        disabled={Boolean(conversationError) || messagesLoading || sending}
                        className="min-h-20 w-full flex-1 resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50"
                      />
                      <button
                        type="submit"
                        disabled={sending || messagesLoading || !messageText.trim() || Boolean(conversationError)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={16} /> {sending ? "Sending…" : "Send message"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Messages are saved to the lead's in-app conversation.
                    </p>
                  </form>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                  Select a lead to view messages.
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
