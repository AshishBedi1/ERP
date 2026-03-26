import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

function folderDepth(folders, folderId) {
  const byId = new Map(folders.map((f) => [String(f.id), f]));
  let d = 0;
  let cur = byId.get(String(folderId));
  const seen = new Set();
  while (cur?.parentId) {
    if (seen.has(String(cur.id))) break;
    seen.add(String(cur.id));
    d += 1;
    cur = byId.get(String(cur.parentId));
  }
  return d;
}

function sortFoldersForTree(folders) {
  return [...folders].sort((a, b) => {
    const da = folderDepth(folders, a.id);
    const db = folderDepth(folders, b.id);
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function formatUpdated(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Notes() {
  const { user } = useAuth();
  const noOrg = user?.role === 'employee' && !user?.employerId;

  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [editorReady, setEditorReady] = useState(false);
  const saveTimer = useRef(null);

  const [folderModal, setFolderModal] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [polishing, setPolishing] = useState(false);

  const loadFolders = useCallback(async () => {
    if (noOrg) return;
    try {
      const { data } = await axios.get('/api/notes/folders');
      setFolders(data.folders || []);
    } catch {
      setFolders([]);
    }
  }, [noOrg]);

  const loadDocuments = useCallback(async () => {
    if (noOrg) return;
    setDocsLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedFolderId) params.folderId = selectedFolderId;
      const { data } = await axios.get('/api/notes/documents', { params });
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
      setError('Could not load notes.');
    } finally {
      setDocsLoading(false);
    }
  }, [noOrg, selectedFolderId]);

  useEffect(() => {
    if (noOrg) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadFolders().finally(() => setLoading(false));
  }, [loadFolders, noOrg]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const sortedFolders = useMemo(() => sortFoldersForTree(folders), [folders]);

  const openDocument = async (id) => {
    setError('');
    setEditorReady(false);
    setSelectedDocId(id);
    setEditorTitle('');
    setEditorContent('');
    try {
      const { data } = await axios.get(`/api/notes/documents/${id}`);
      const d = data.document;
      setEditorTitle(d.title || '');
      setEditorContent(d.content || '');
      setSaveState('idle');
      setEditorReady(true);
    } catch {
      setError('Could not open note.');
      setSelectedDocId(null);
      setEditorReady(false);
    }
  };

  const closeEditor = () => {
    setEditorReady(false);
    setSelectedDocId(null);
    setEditorTitle('');
    setEditorContent('');
    setSaveState('idle');
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  };

  const persistDocument = useCallback(
    async (id, title, content) => {
      if (!id) return;
      setSaveState('saving');
      try {
        await axios.patch(`/api/notes/documents/${id}`, { title, content });
        setSaveState('saved');
        loadDocuments();
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('error');
      }
    },
    [loadDocuments]
  );

  useEffect(() => {
    if (!selectedDocId || !editorReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const t = editorTitle.trim() || 'Untitled';
      persistDocument(selectedDocId, t, editorContent);
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editorTitle, editorContent, selectedDocId, editorReady, persistDocument]);

  const polishWithAi = useCallback(async () => {
    const t = editorContent.trim();
    if (!t.length || polishing) return;
    if (editorContent.length > 10000) {
      setError('Note body must be at most 10,000 characters to polish with AI.');
      return;
    }
    setPolishing(true);
    setError('');
    try {
      const { data } = await axios.post('/api/ai/refine-note', { text: editorContent });
      const next = typeof data.text === 'string' ? data.text : '';
      if (!next.trim()) {
        setError('AI returned empty text. Try again.');
        return;
      }
      setEditorContent(next.length > 10000 ? next.slice(0, 10000) : next);
      setSaveState('idle');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not polish note.');
    } finally {
      setPolishing(false);
    }
  }, [editorContent, polishing]);

  const createNote = async () => {
    setError('');
    try {
      const { data } = await axios.post('/api/notes/documents', {
        title: 'Untitled note',
        content: '',
        folderId: selectedFolderId || null,
      });
      const d = data.document;
      await loadDocuments();
      await openDocument(String(d.id));
    } catch {
      setError('Could not create note.');
    }
  };

  const deleteDocument = async (id) => {
    setError('');
    try {
      await axios.delete(`/api/notes/documents/${id}`);
      if (selectedDocId === id) closeEditor();
      await loadDocuments();
      setDeleteTarget(null);
    } catch {
      setError('Could not delete note.');
    }
  };

  const openNewFolder = (parentId) => {
    setFolderModal({ mode: 'create', parentId: parentId || null });
    setFolderName('');
  };

  const submitFolder = async (e) => {
    e.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    setFolderBusy(true);
    setError('');
    try {
      if (folderModal?.mode === 'create') {
        await axios.post('/api/notes/folders', { name, parentId: folderModal.parentId || null });
      } else if (folderModal?.mode === 'rename' && folderModal.id) {
        await axios.patch(`/api/notes/folders/${folderModal.id}`, { name });
      }
      await loadFolders();
      setFolderModal(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save folder.');
    } finally {
      setFolderBusy(false);
    }
  };

  const deleteFolder = async (id) => {
    setError('');
    try {
      await axios.delete(`/api/notes/folders/${id}`);
      if (String(selectedFolderId) === String(id)) setSelectedFolderId(null);
      await loadFolders();
      await loadDocuments();
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete folder.');
    }
  };

  if (noOrg) {
    return (
      <AppShell title="Important notes">
        <p className="text-sm text-slate-600 dark:text-slate-400">You are not linked to a company yet.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Important notes">
      <div className="flex min-h-[min(70vh,720px)] flex-col gap-4 lg:flex-row lg:gap-6">
        <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-300/80 bg-slate-200/40 dark:border-slate-700/60 dark:bg-slate-800/40 lg:w-64">
          <div className="border-b border-slate-300/80 px-3 py-3 dark:border-slate-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Folders</p>
            <button
              type="button"
              onClick={() => openNewFolder(null)}
              className="mt-2 w-full rounded-lg border border-slate-400/60 bg-slate-300/50 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-400/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              + New folder
            </button>
          </div>
          <div className="max-h-[40vh] overflow-y-auto p-2 lg:max-h-none">
            <button
              type="button"
              onClick={() => {
                setSelectedFolderId(null);
                closeEditor();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                selectedFolderId === null
                  ? 'bg-blue-600/20 font-medium text-blue-900 dark:bg-blue-500/20 dark:text-blue-100'
                  : 'text-slate-700 hover:bg-slate-300/50 dark:text-slate-300 dark:hover:bg-slate-700/50'
              }`}
            >
              <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              All notes
            </button>
            {loading ? (
              <p className="px-2 py-3 text-xs text-slate-500">Loading…</p>
            ) : (
              sortedFolders.map((f) => {
                const depth = folderDepth(folders, f.id);
                return (
                  <div key={f.id} className="group flex items-center gap-0.5" style={{ paddingLeft: `${8 + depth * 12}px` }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(f.id);
                        closeEditor();
                      }}
                      className={`flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        String(selectedFolderId) === String(f.id)
                          ? 'bg-blue-600/20 font-medium text-blue-900 dark:bg-blue-500/20 dark:text-blue-100'
                          : 'text-slate-700 hover:bg-slate-300/50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      <span className="truncate">{f.name}</span>
                    </button>
                    <button
                      type="button"
                      title="Subfolder"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNewFolder(f.id);
                      }}
                      className="rounded p-1 text-slate-500 opacity-0 transition hover:bg-slate-300/60 hover:text-slate-800 group-hover:opacity-100 dark:hover:bg-slate-600 dark:hover:text-slate-100"
                    >
                      <span className="text-lg leading-none">+</span>
                    </button>
                    <button
                      type="button"
                      title="Rename folder"
                      onClick={() => {
                        setFolderModal({ mode: 'rename', id: f.id, parentId: f.parentId });
                        setFolderName(f.name);
                      }}
                      className="rounded p-1 text-xs text-slate-500 opacity-0 hover:bg-slate-300/60 group-hover:opacity-100 dark:hover:bg-slate-600"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      title="Delete folder"
                      onClick={() => setDeleteTarget({ type: 'folder', id: f.id, name: f.name })}
                      className="rounded p-1 text-slate-500 opacity-0 hover:bg-red-950/40 hover:text-red-400 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-300/80 bg-slate-200/35 dark:border-slate-700/60 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300/80 px-4 py-3 dark:border-slate-700/60">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedFolderId ? sortedFolders.find((x) => String(x.id) === String(selectedFolderId))?.name || 'Folder' : 'All notes'}
              </h2>
              <p className="text-xs text-slate-500">
                Starts empty — nothing is added automatically. Employers and employees can create notes and folders; edits autosave while you type.
              </p>
            </div>
            <button
              type="button"
              onClick={createNote}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              New note
            </button>
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
          )}

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {!selectedDocId ? (
              <div className="min-h-[200px] flex-1 overflow-y-auto p-4">
                {docsLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-400/60 bg-slate-200/30 px-5 py-8 text-center dark:border-slate-600 dark:bg-slate-900/30">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No notes yet</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {selectedFolderId
                        ? 'This folder is empty. Add a note with the button above.'
                        : 'Your company starts with no notes. Only people in your organization can add them — use New note when you are ready (employers and employees).'}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => openDocument(d.id)}
                          className="flex w-full flex-col rounded-xl border border-slate-300/70 bg-slate-200/50 px-4 py-3 text-left transition hover:border-blue-500/40 hover:bg-slate-200/90 dark:border-slate-600 dark:bg-slate-900/50 dark:hover:bg-slate-800/80"
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-100">{d.title}</span>
                          <span className="text-xs text-slate-500">{formatUpdated(d.updatedAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col border-t border-slate-300/80 dark:border-slate-700/60 lg:border-l lg:border-t-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-300/80 px-4 py-2 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
                  >
                    ← Back to list
                  </button>
                  <span className="text-xs text-slate-500">
                    {polishing && 'Polishing with AI…'}
                    {!polishing && saveState === 'saving' && 'Saving…'}
                    {!polishing && saveState === 'saved' && 'Saved'}
                    {!polishing && saveState === 'error' && 'Save failed'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: 'doc', id: selectedDocId })}
                    className="ml-auto rounded-lg border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-950/40 dark:text-red-300"
                  >
                    Delete note
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                  <input
                    className="erp-input-inline text-base font-semibold"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Title"
                  />
                  <textarea
                    className="erp-input-inline min-h-[min(50vh,420px)] flex-1 resize-y font-mono text-sm leading-relaxed"
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="Write important information here…"
                    disabled={polishing}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void polishWithAi()}
                      disabled={polishing || !editorContent.trim()}
                      title="Improve grammar and clarity in the note body (uses AI). Max 10,000 characters."
                      className="inline-flex items-center justify-center rounded-xl border border-violet-400/60 bg-violet-100/90 px-4 py-2 text-sm font-semibold text-violet-900 transition hover:bg-violet-200/90 focus:outline-none focus:ring-2 focus:ring-violet-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/50 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50"
                    >
                      {polishing ? 'Polishing…' : 'Polish with AI'}
                    </button>
                    <span className="text-xs text-slate-500">{editorContent.length.toLocaleString()} / 10,000 for AI</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {folderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          onClick={() => !folderBusy && setFolderModal(null)}
        >
          <form
            className="w-full max-w-sm rounded-2xl border border-slate-300/80 bg-slate-200/95 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitFolder}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {folderModal.mode === 'create' ? 'New folder' : 'Rename folder'}
            </h3>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Name
            </label>
            <input
              className="erp-input-inline mt-1.5"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
              required
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={folderBusy}
                onClick={() => setFolderModal(null)}
                className="flex-1 rounded-xl border border-slate-400/70 py-2 text-sm font-medium dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={folderBusy}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {folderBusy ? '…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget?.type === 'doc' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300/80 bg-slate-200/95 p-6 dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete this note?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2 text-sm dark:border-slate-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteDocument(deleteTarget.id)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget?.type === 'folder' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300/80 bg-slate-200/95 p-6 dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete folder?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">{deleteTarget.name}</span> must be empty (no subfolders, no notes) before it can be removed.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2 text-sm dark:border-slate-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteFolder(deleteTarget.id)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Delete folder
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
