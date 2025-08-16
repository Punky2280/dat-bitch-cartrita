import { useEffect, useState } from 'react';
import { useNotify } from '../components/ui/NotificationProvider';

interface EmailInboxPageProps { token: string; onBack: () => void; }

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
  category: string;
  ai_summary?: string;
  confidence?: number;
  priority?: 'high'|'normal'|'low';
}

const CATEGORY_BUCKETS = [
  { id: 'action_required', name: 'Action Needed', icon: '⚠️' },
  { id: 'updates', name: 'Updates / Notifications', icon: '🔔' },
  { id: 'low_priority', name: 'Low Priority', icon: '🌙' }
];

// Removed mock data - using real API data only

export const EmailInboxPage = ({ token, onBack }: EmailInboxPageProps) => {
  const notify = useNotify();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activeMobileBucket, setActiveMobileBucket] = useState<string>(CATEGORY_BUCKETS[0].id);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth < 1024);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/messages?limit=40&unread_only=${unreadOnly}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: EmailMessage[] = (data?.messages || data?.data || []).map((m: any, idx: number) => ({
          id: m.id || `msg_${idx}`,
          from: m.from || m.sender || 'Unknown sender',
          subject: m.subject || 'No subject',
          preview: m.preview || m.snippet || m.body?.substring(0, 100) || 'No preview available',
          timestamp: m.timestamp || m.date || new Date().toISOString(),
          read: !!m.read,
          category: m.category || 'misc',
          ai_summary: m.ai_summary || `Auto-categorized as ${m.category || 'misc'}`,
          confidence: m.confidence || 0.8,
          priority: (m.priority || 'normal') as EmailMessage['priority']
        }));
        setMessages(unreadOnly ? list.filter(m => !m.read) : list);
        
        if (list.length === 0) {
          notify.info('Inbox Empty', unreadOnly ? 'No unread messages found' : 'No messages in inbox');
        } else {
          notify.success('Inbox Loaded', `Found ${list.length} messages`);
        }
      } else {
        const errorText = await res.text();
        notify.error('API Error', `Failed to load messages: ${res.status} ${errorText}`);
        setMessages([]);
      }
    } catch (error) {
      console.error('Email fetch error:', error);
      notify.error('Network Error', 'Unable to connect to email service');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMessages(); }, [token, unreadOnly]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkMarkRead = () => {
    setMessages(msgs => msgs.map(m => selected.has(m.id) ? { ...m, read: true } : m));
    setSelected(new Set());
  };

  const reclassifyLocal = (id: string, newCat: string) => {
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, category: newCat } : m));
  };

  const bucketed = CATEGORY_BUCKETS.map(bucket => ({
    bucket,
    items: messages.filter(m => {
      if (bucket.id === 'action_required') return ['welcome','personal','finance','security'].includes(m.category) || m.priority==='high';
      if (bucket.id === 'updates') return ['notifications','updates','system'].includes(m.category) || m.priority==='normal';
      if (bucket.id === 'low_priority') return ['promotions','misc','low','marketing'].includes(m.category) || m.priority==='low';
      return false;
    })
  }));

  return (
    <div className="min-h-screen bg-animated text-white">
  <header className="glass-card border-b border-slate-600/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800/50">← Back</button>
            <div>
              <h1 className="text-3xl font-bold text-gradient">AI Email Inbox</h1>
              <p className="text-slate-400 mt-1">Triage and prioritize with AI-assisted categorization (preview)</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm text-slate-300">
              <input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)} className="rounded" />
              <span>Unread Only</span>
            </label>
            <button onClick={loadMessages} disabled={loading} className="bg-blue-600/80 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center space-x-2">
              <span>{loading? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      {selected.size > 0 && (
        <div className="sticky top-0 z-40 bg-purple-900/70 backdrop-blur border-b border-purple-500/40 text-sm">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
            <div>{selected.size} selected</div>
            <div className="flex items-center space-x-2">
              <button onClick={bulkMarkRead} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded">Mark Read</button>
              <button onClick={()=>setSelected(new Set())} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded">Clear</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {isNarrow && (
      <div className="lg:hidden mb-4 flex items-center justify-between gap-2">
            {CATEGORY_BUCKETS.map(b=> (
        <button key={b.id} onClick={()=>setActiveMobileBucket(b.id)} className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${activeMobileBucket===b.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-300'}`}>{b.icon} {b.name.split(' ')[0]}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {bucketed
            .filter(b => !isNarrow || b.bucket.id === activeMobileBucket)
            .map(({bucket, items}) => (
            <div key={bucket.id} className="glass-card p-4 rounded-xl flex flex-col min-h-[560px]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center space-x-2"><span>{bucket.icon}</span><span>{bucket.name}</span></h2>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {items.map(m => {
                  const isSelected = selected.has(m.id);
                  return (
                    <div key={m.id} className={`border border-slate-700 rounded-lg p-3 group hover:border-purple-500 transition-colors relative ${!m.read ? 'bg-slate-800/70' : 'bg-slate-800/40'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={()=> setExpandedId(expandedId===m.id? null : m.id)}>
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${m.read? 'bg-slate-600':'bg-blue-400 animate-pulse'}`}></span>
                            <span className="text-sm font-semibold truncate max-w-[140px]">{m.from}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{(m.confidence||0).toFixed(2)}</span>
                            {m.priority==='high' && <span className="text-[10px] px-1 py-0.5 bg-red-600/70 rounded">HIGH</span>}
                          </div>
                          <div className="mt-1 text-sm text-slate-200 line-clamp-1">{m.subject}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{m.preview}</div>
                        </div>
                        <div className="flex flex-col items-end space-y-2 ml-2">
                          <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(m.id)} />
                          <select value={m.category} onChange={e=>reclassifyLocal(m.id, e.target.value)} className="bg-slate-700 text-slate-300 text-[10px] rounded px-1 py-0.5 focus:outline-none">
                            <option value="welcome">welcome</option>
                            <option value="notifications">notifications</option>
                            <option value="updates">updates</option>
                            <option value="promotions">promotions</option>
                            <option value="personal">personal</option>
                            <option value="security">security</option>
                            <option value="finance">finance</option>
                            <option value="misc">misc</option>
                          </select>
                        </div>
                      </div>
                      {expandedId === m.id && (
                        <div className="mt-3 border-t border-slate-700 pt-3 text-xs space-y-2">
                          <div className="text-slate-400">AI Summary:</div>
                          <div className="text-slate-300 leading-relaxed">{m.ai_summary || 'No summary available (mock).'}</div>
                          <div className="flex items-center space-x-2 text-slate-500">
                            <span>{new Date(m.timestamp).toLocaleString()}</span>
                            <span>•</span>
                            <button className="text-purple-400 hover:text-purple-300">Suggest Actions</button>
                            <span>•</span>
                            <button className="text-blue-400 hover:text-blue-300" onClick={()=> setMessages(msgs => msgs.map(x=> x.id===m.id? {...x, read: true}: x))}>Mark Read</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && <div className="text-xs text-slate-600 text-center py-8">No messages in this bucket.</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2"><span>🛠️</span><span>Upcoming Inbox Features</span></h3>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
            <li>Backend reclassify & bulk endpoints</li>
            <li>Adaptive model retraining stats & drift alerts</li>
            <li>Action suggestion model integration</li>
            <li>Thread grouping & conversation view</li>
            <li>Snooze & follow-up reminders</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default EmailInboxPage;
