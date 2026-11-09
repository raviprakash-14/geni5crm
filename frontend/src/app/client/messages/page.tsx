"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  MessageCircle,
  Send,
  Building2,
  UserRound,
  MessagesSquare,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api`;

 type ClientLead = {
  id: number;
  name: string;
  company: string | null;
  status: string;
  salesperson_name: string | null;
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

type CurrentUser = { id: number; full_name: string; role: string };

export default function ClientMessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }, [router]);

  const getToken = useCallback(() => localStorage.getItem("access_token"), []);

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

    async function loadPortal() {
      const accessToken = getToken();
      if (!accessToken) {
        logout();
        return;
      }

      setLoading(true);
      setError("");
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [meResponse, leadsResponse] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers }),
          fetch(`${API_URL}/client/leads`, { headers }),
        ]);

        if (meResponse.status === 401 || leadsResponse.status === 401) {
          logout();
          return;
        }
        if (!meResponse.ok) throw new Error("Could not load your account.");

        const currentUser: CurrentUser = await meResponse.json();
        if (currentUser.role !== "client") {
          router.replace("/");
          return;
        }
        if (!leadsResponse.ok) {
          const data = await leadsResponse.json().catch(() => ({}));
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Could not load your linked leads."
          );
        }

        const linkedLeads: ClientLead[] = await leadsResponse.json();
        if (!cancelled) {
          setUser(currentUser);
          setLeads(linkedLeads);
          setSelectedLeadId((current) =>
            current && linkedLeads.some((lead) => lead.id === current)
              ? current
              : linkedLeads[0]?.id ?? null
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load the client portal."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPortal();
    return () => {
      cancelled = true;
    };
  }, [getToken, logout, router]);

  const loadMessages = useCallback(async () => {
    if (!selectedLeadId) {
      setMessages([]);
      return;
    }

    const accessToken = getToken();
    if (!accessToken) {
      logout();
      return;
    }

    setMessagesLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/leads/${selectedLeadId}/messages`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not load messages."
        );
      }
      setMessages(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedLeadId, getToken, logout]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    if (!body || !selectedLeadId || sending) return;

    const accessToken = getToken();
    if (!accessToken) {
      logout();
      return;
    }

    setSending(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/leads/${selectedLeadId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not send message."
        );
      }

      const saved: Message = await response.json();
      setMessages((current) => [...current, saved]);
      setMessageText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-700 sm:px-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-24 rounded-2xl bg-white shadow-sm" />
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="h-96 rounded-2xl bg-white shadow-sm" />
            <div className="h-[520px] rounded-2xl bg-white shadow-sm" />
          </div>
          <p className="text-sm text-slate-500">Loading your client portal…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-7">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
              <MessagesSquare size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-600">
                Geni5 CRM · Client workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Messages
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Welcome{user?.full_name ? `, ${user.full_name}` : ""}. Keep your conversations with the Geni5 team in one place.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={16} />
            Log out
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {leads.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <MessageCircle size={28} />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No linked lead yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Your Geni5 contact needs to link your client account to a lead before you can start messaging.
            </p>
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="font-semibold">Your conversations</h2>
                  <p className="mt-1 text-xs text-slate-500">{leads.length} linked {leads.length === 1 ? "lead" : "leads"}</p>
                </div>
                <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><MessageCircle size={18} /></span>
              </div>
              <div className="space-y-2">
                {leads.map((lead) => {
                  const isSelected = selectedLeadId === lead.id;
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      aria-pressed={isSelected}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? "border-indigo-200 bg-indigo-50 ring-1 ring-indigo-100"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-white text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                          <Building2 size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {lead.company || lead.name}
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">{lead.name}</span>
                          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${isSelected ? "bg-white text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                            {lead.status}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex h-[min(75vh,760px)] min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                    <UserRound size={21} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {selectedLead?.company || selectedLead?.name || "Conversation"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Contact: {selectedLead?.name || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:self-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Salesperson: {selectedLead?.salesperson_name || "Geni5 team"}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                {messagesLoading ? (
                  <div className="space-y-4 py-8" aria-live="polite">
                    <div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-indigo-100" />
                    <div className="h-20 w-3/4 animate-pulse rounded-2xl bg-white" />
                    <p className="text-center text-xs text-slate-500">Loading messages…</p>
                    <div ref={messagesEndRef} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                      <MessageCircle size={23} />
                    </div>
                    <p className="mt-4 font-semibold text-slate-800">Start the conversation</p>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                      There are no messages for this lead yet. Send a message below to get things started.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const ownMessage = message.sender_id === user?.id;
                    return (
                      <div key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                        <article className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[78%] ${ownMessage ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-900"}`}>
                          <p className={`mb-1.5 text-[11px] font-semibold ${ownMessage ? "text-indigo-100" : "text-slate-500"}`}>
                            {ownMessage ? "You" : "Geni5 team"}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                          <time className={`mt-2 block text-right text-[11px] ${ownMessage ? "text-indigo-100" : "text-slate-400"}`}>
                            {new Date(message.created_at).toLocaleString()}
                          </time>
                        </article>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-4 sm:p-5">
                <label htmlFor="client-message" className="mb-2 block text-sm font-semibold text-slate-700">Your message</label>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    
<textarea
  id="client-message"
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
  placeholder="Write your message…"
  className="min-h-20 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
  required
  disabled={!selectedLeadId || sending}
/>

                    <p className="mt-1.5 text-right text-xs text-slate-400">{messageText.length}/5000 characters</p>
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !messageText.trim() || !selectedLeadId}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 sm:mb-6"
                  >
                    <Send size={16} />
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">Messages are saved to this conversation.</p>
              </form>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
