import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import AppShell from '../components/AppShell';
import ChatThread from '../components/ChatThread';
import ChannelThread from '../components/ChannelThread';
import { useAuth } from '../context/AuthContext';

function formatPreviewTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CreateChannelModal({ open, onClose, peers, selfId, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setSelected(new Set());
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || selected.size === 0) {
      setError('Enter a channel name and pick at least one person.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.post('/api/chat/channels', {
        name: n,
        memberIds: [...selected],
      });
      onCreated(data.channel);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create channel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-channel-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-600/80 bg-slate-900 p-6 shadow-2xl"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <h2 id="create-channel-title" className="text-lg font-semibold text-slate-100">
          New group channel
        </h2>
        <p className="mt-1 text-sm text-slate-400">Add people from your organization. You will be included automatically.</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="channel-name" className="text-xs font-medium text-slate-400">
              Channel name
            </label>
            <input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
              placeholder="e.g. Project Alpha"
              autoComplete="off"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Add people</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/80 p-2">
              {peers.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-slate-500">No teammates available yet.</li>
              ) : (
                peers.map((p) => {
                  const id = String(p.peerId || p.employeeId);
                  if (id === String(selfId)) return null;
                  const checked = selected.has(id);
                  return (
                    <li key={id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-700/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(id)}
                          className="rounded border-slate-500 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm text-slate-200">{p.name}</span>
                        {p.subtitle && <span className="text-[10px] text-slate-500">{p.subtitle}</span>}
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200" role="alert">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || selected.size === 0}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inbox() {
  const { user, isEmployer, isEmployee } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const peerParam = searchParams.get('with') || searchParams.get('dm') || '';
  const channelParam = searchParams.get('channel') || '';

  const employerId = user?.employerId ? String(user.employerId) : null;
  const selfId = user?.id || user?._id;

  const [conversations, setConversations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [employerPeers, setEmployerPeers] = useState([]);

  const loadSummary = useCallback(() => {
    if (!isEmployer && !isEmployee) return;
    setSummaryLoading(true);
    axios
      .get('/api/chat/summary')
      .then(({ data }) => setConversations(data.conversations || []))
      .catch(() => setConversations([]))
      .finally(() => setSummaryLoading(false));
  }, [isEmployer, isEmployee]);

  const loadChannels = useCallback(() => {
    if (!isEmployer && !isEmployee) return;
    setChannelsLoading(true);
    axios
      .get('/api/chat/channels')
      .then(({ data }) => setChannels(data.channels || []))
      .catch(() => setChannels([]))
      .finally(() => setChannelsLoading(false));
  }, [isEmployer, isEmployee]);

  useEffect(() => {
    loadSummary();
    loadChannels();
  }, [loadSummary, loadChannels]);

  useEffect(() => {
    if (!isEmployer) {
      setEmployerPeers([]);
      return;
    }
    axios
      .get('/api/employer/employees')
      .then(({ data }) => {
        const rows = data.employees || [];
        setEmployerPeers(
          rows.map((e) => ({
            peerId: e._id,
            employeeId: e._id,
            name: e.name || 'Team member',
            subtitle: 'Team',
          }))
        );
      })
      .catch(() => setEmployerPeers([]));
  }, [isEmployer]);

  const createChannelPeers = isEmployer && employerPeers.length > 0 ? employerPeers : conversations;

  useEffect(() => {
    const onChat = () => {
      loadSummary();
      loadChannels();
    };
    window.addEventListener('chat-updated', onChat);
    return () => window.removeEventListener('chat-updated', onChat);
  }, [loadSummary, loadChannels]);

  const peerIds = useMemo(
    () => new Set(conversations.map((c) => String(c.peerId || c.employeeId))),
    [conversations]
  );
  const channelIds = useMemo(() => new Set(channels.map((c) => String(c.id))), [channels]);

  const selectedChannelId = useMemo(() => {
    if (channelParam && channelIds.has(channelParam)) return channelParam;
    return '';
  }, [channelParam, channelIds]);

  const selectedPeerId = useMemo(() => {
    if (selectedChannelId) return '';
    if (!conversations.length) return '';
    if (peerParam && peerIds.has(peerParam)) return peerParam;
    return String(conversations[0].peerId || conversations[0].employeeId);
  }, [conversations, peerParam, peerIds, selectedChannelId]);

  useEffect(() => {
    if (summaryLoading || channelsLoading) return;
    const hasValidChannel = channelParam && channelIds.has(channelParam);
    const hasValidPeer = peerParam && peerIds.has(peerParam);
    if (hasValidChannel || hasValidPeer) return;
    const next = new URLSearchParams();
    if (channels.length) {
      next.set('channel', String(channels[0].id));
      setSearchParams(next, { replace: true });
      return;
    }
    if (conversations.length) {
      next.set('with', String(conversations[0].peerId || conversations[0].employeeId));
      setSearchParams(next, { replace: true });
    }
  }, [
    summaryLoading,
    channelsLoading,
    channelParam,
    peerParam,
    channelIds,
    peerIds,
    channels,
    conversations,
    setSearchParams,
  ]);

  const setPeer = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('with', id);
    else next.delete('with');
    next.delete('dm');
    next.delete('channel');
    setSearchParams(next, { replace: true });
  };

  const setChannel = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('channel', id);
    else next.delete('channel');
    next.delete('with');
    next.delete('dm');
    setSearchParams(next, { replace: true });
  };

  const onChannelCreated = (ch) => {
    setChannels((prev) => [{ ...ch, id: ch.id }, ...prev.filter((c) => String(c.id) !== String(ch.id))]);
    setChannel(String(ch.id));
  };

  if (isEmployee && !employerId) {
    return (
      <AppShell scrollableContent>
        <div className="mx-auto max-w-lg">
          <div className="erp-card p-6 text-center text-sm text-slate-600 dark:text-slate-400">
            You are not linked to an organization yet. Messages will appear here once your account is connected.
          </div>
        </div>
      </AppShell>
    );
  }

  const dmSidebar = (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-300/80 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 md:h-full md:max-h-none md:w-[min(100%,300px)] md:border-b-0 md:border-r lg:w-[320px]">
      <div className="shrink-0 border-b border-slate-200/90 px-3 py-2.5 dark:border-slate-700">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Messages</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Direct chats and group channels</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            + Channel
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="border-b border-slate-200/80 px-2 py-2 dark:border-slate-700">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Channels</p>
          {channelsLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>
          ) : channels.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-500">No channels yet. Create one to group chat.</p>
          ) : (
            <ul className="py-0.5">
              {channels.map((ch) => {
                const id = String(ch.id);
                const active = selectedChannelId === id;
                const preview = ch.lastMessagePreview || (active ? 'Channel' : 'Say hi');
                const when = ch.lastMessageAt ? formatPreviewTime(ch.lastMessageAt) : '';
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setChannel(id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        active
                          ? 'bg-violet-200/90 dark:bg-violet-950/50'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active
                            ? 'bg-violet-600 text-white ring-2 ring-violet-400/40'
                            : 'bg-violet-200 text-violet-900 dark:bg-violet-900/80 dark:text-violet-100'
                        }`}
                      >
                        #
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{ch.name}</span>
                          {when && <span className="shrink-0 text-[10px] text-slate-400">{when}</span>}
                        </div>
                        <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{preview}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-2 py-2">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Direct</p>
          {summaryLoading ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {isEmployer ? (
                <>
                  No team members yet.{' '}
                  <Link to="/employer/add-employee" className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                    Add people
                  </Link>
                </>
              ) : (
                'No conversations yet.'
              )}
            </p>
          ) : (
            <ul className="py-0.5">
              {conversations.map((c) => {
                const id = String(c.peerId || c.employeeId);
                const active = !selectedChannelId && selectedPeerId === id;
                const preview = c.lastMessage?.body || (active ? 'Chat' : 'Say hi');
                const when = c.lastMessage?.createdAt ? formatPreviewTime(c.lastMessage.createdAt) : '';
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setPeer(id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        active
                          ? 'bg-slate-200/90 dark:bg-slate-800'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          active
                            ? 'bg-blue-600 text-white ring-2 ring-blue-500/40 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900'
                            : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 dark:from-slate-600 dark:to-slate-700 dark:text-slate-100'
                        }`}
                      >
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`truncate text-[13px] font-semibold ${active ? 'text-slate-900 dark:text-white' : 'text-slate-900 dark:text-slate-100'}`}
                          >
                            {c.name}
                          </span>
                          {when && <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{when}</span>}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{preview}</p>
                          {c.unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white tabular-nums">
                              {c.unread > 9 ? '9+' : c.unread}
                            </span>
                          )}
                        </div>
                        {c.subtitle && <p className="mt-0.5 text-[10px] text-slate-400">{c.subtitle}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );

  const mainChat = (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/90 dark:bg-slate-950/40">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:border-l md:border-slate-200/80 dark:md:border-slate-700/80">
        {selectedChannelId && (
          <ChannelThread key={selectedChannelId} channelId={selectedChannelId} fillHeight />
        )}
        {!selectedChannelId && selectedPeerId && (
          <ChatThread
            variant="inbox"
            fillHeight
            withUserId={selectedPeerId}
            emptyHint="No messages yet. Send a message to start the conversation."
          />
        )}
        {!selectedChannelId && !selectedPeerId && !summaryLoading && !channelsLoading && (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
            Select a conversation or channel
          </div>
        )}
      </div>
    </main>
  );

  return (
    <AppShell flush scrollableContent={false}>
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full flex-1 flex-col md:h-[calc(100dvh-4rem)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-slate-300/80 bg-slate-200/30 dark:border-slate-700/80 dark:bg-slate-900/30 md:flex-row md:border-0 md:bg-transparent">
          {dmSidebar}
          {mainChat}
        </div>
      </div>
      <CreateChannelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        peers={createChannelPeers}
        selfId={selfId}
        onCreated={onChannelCreated}
      />
    </AppShell>
  );
}
