import React, { useState, useEffect } from "react";
import { useNotify } from "../components/ui/NotificationProvider";

interface PersonalLifeOSPageProps {
  token: string;
  onBack: () => void;
}

interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  picture: string;
  is_connected: boolean;
  scopes: string[];
  last_sync: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime: string;
    date?: string;
  };
  end: {
    dateTime: string;
    date?: string;
  };
  location?: string;
  description?: string;
  attendees?: Array<{ email: string; responseStatus: string }>;
}

interface EmailSummary {
  total_unread: number;
  important_unread: number;
  recent_emails: Array<{
    id: string;
    subject: string;
    from: string;
    snippet: string;
    date: string;
    isImportant: boolean;
  }>;
}

interface ContactInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  lastContacted?: string;
  relationship?: string;
}

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  category: string;
  ai_generated?: boolean;
}

interface LifeMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  category: "health" | "productivity" | "relationships" | "finance" | "learning";
  trend: "up" | "down" | "stable";
  last_updated: string;
}

export const PersonalLifeOSPage: React.FC<PersonalLifeOSPageProps> = ({
  token,
  onBack,
}) => {
  const notify = useNotify();
  const [activeView, setActiveView] = useState<
  "dashboard" | "calendar" | "tasks" | "contacts" | "metrics" | "integrations" | "calendar_plus" | "journal"
  >("dashboard");

  // State
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [emailSummary, setEmailSummary] = useState<EmailSummary | null>(null);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [lifeMetrics, setLifeMetrics] = useState<LifeMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  // Journal
  interface JournalEntry { id: string; entry_date: string; content: string; mood?: string; sentiment_score?: number; emotions?: Record<string, number>; }
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  // Contacts specific state (local filtering + selection)
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactProviderFilter, setContactProviderFilter] = useState<string>("all");
  // removed unused isNarrow responsive state hook

  // Task creation
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium" as const,
    category: "personal",
  });

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        googleRes,
        eventsRes,
        emailRes,
        contactsRes,
        tasksRes,
        metricsRes,
      ] = await Promise.all([
        fetch("/api/personal-life-os/google-account", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/personal-life-os/calendar/upcoming", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/personal-life-os/email/summary", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/personal-life-os/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/personal-life-os/tasks", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/personal-life-os/metrics", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [
        googleData,
        eventsData,
        emailData,
        contactsData,
  tasksData,
        metricsData,
      ] = await Promise.all([
        googleRes.json(),
        eventsRes.json(),
        emailRes.json(),
        contactsRes.json(),
        tasksRes.json(),
        metricsRes.json(),
      ]);

      if (googleData.success) setGoogleAccount(googleData.account);
      if (eventsData.success) setUpcomingEvents(eventsData.events);
      if (emailData.success) setEmailSummary(emailData.summary);
      if (contactsData.success) setContacts(contactsData.contacts);
      if (tasksData.success) setTasks(tasksData.tasks);
      if (metricsData.success) setLifeMetrics(metricsData.metrics);
      // Journal fetch (separate to keep backwards compatibility with stubbed API shape)
      try {
        const jr = await fetch('/api/personal-life-os/journal/list', { headers: { Authorization: `Bearer ${token}` } });
        const jd = await jr.json();
        if (jd.success) {
          // adapt stub shape { entries: [] }
            setJournalEntries(jd.data?.entries || jd.entries || []);
        }
      } catch (e) { /* silent for now */ }
    } catch (error) {
      console.error("Error loading Personal Life OS data:", error);
      notify.error("Failed to load data", "Please check your connection and try again");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      const response = await fetch("/api/personal-life-os/google/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.auth_url;
      } else {
        notify.error("Connection failed", data.error || "Unable to connect to Google");
      }
    } catch (error) {
      console.error("Error connecting to Google:", error);
      notify.error("Connection error", "Please try again");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/personal-life-os/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        loadData();
        notify.success("Sync completed", "All data has been updated");
      } else {
        notify.error("Sync failed", data.error || "Unable to sync data");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      notify.error("Sync error", "Please try again");
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const response = await fetch("/api/personal-life-os/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTask),
      });

      const data = await response.json();
      if (data.success) {
        setNewTask({
          title: "",
          description: "",
          due_date: "",
          priority: "medium",
          category: "personal",
        });
        loadData();
        notify.success("Task created", `Added "${newTask.title}"`);
      } else {
        notify.error("Failed to create task", data.error || "Unable to save task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      notify.error("Creation failed", "Please try again");
    }
  };

  const handleToggleTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/personal-life-os/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        loadData();
        notify.success("Task updated", "Status changed successfully");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      notify.error("Update failed", "Please try again");
    }
  };

  const generateAiSuggestions = async () => {
    setShowAiPanel(true);
    try {
      const response = await fetch("/api/personal-life-os/ai/suggestions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: {
            upcoming_events: upcomingEvents.slice(0, 5),
            pending_tasks: tasks.filter(t => t.status === "pending").slice(0, 10),
            metrics: lifeMetrics,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAiSuggestions(data.suggestions);
      } else {
        notify.error("AI suggestions failed", data.error || "Unable to generate suggestions");
      }
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      notify.error("AI error", "Please try again");
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "high":
        return "text-red-400 bg-red-900/20";
      case "medium":
        return "text-yellow-400 bg-yellow-900/20";
      case "low":
        return "text-green-400 bg-green-900/20";
      default:
        return "text-gray-400 bg-gray-900/20";
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white text-xl mt-4">Loading Personal Life OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-gray-600/50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gradient">
                🌟 Personal Life OS
              </h1>
              <p className="text-gray-400 mt-1">
                Your intelligent life management dashboard with Google integration
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={generateAiSuggestions}
              className="px-4 py-2 bg-gradient-purple rounded-lg font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2"
            >
              <span>🤖</span>
              <span>AI Suggestions</span>
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || !googleAccount?.is_connected}
              className="px-4 py-2 bg-gradient-blue rounded-lg font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2 disabled:opacity-50"
            >
              <span>{syncing ? "🔄" : "🔄"}</span>
              <span>{syncing ? "Syncing..." : "Sync"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {[
              { id: "dashboard", name: "Dashboard", icon: "🏠" },
              { id: "calendar", name: "Calendar", icon: "📅" },
              { id: "tasks", name: "Tasks", icon: "✅" },
              { id: "contacts", name: "Contacts", icon: "👥" },
              { id: "journal", name: "Journal", icon: "📝" },
              { id: "metrics", name: "Life Metrics", icon: "📊" },
              { id: "integrations", name: "Integrations", icon: "🔗" },
              { id: "calendar_plus", name: "Calendar+", icon: "🗓️" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeView === tab.id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-400 hover:text-white hover:border-gray-300"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeView === "dashboard" && (
          <div className="space-y-8">
            {/* Connection Status */}
            {!googleAccount?.is_connected && (
              <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                      🔗 Connect Your Google Account
                    </h3>
                    <p className="text-gray-300">
                      Connect your Google account to access Calendar, Gmail, and Contacts
                    </p>
                  </div>
                  <button
                    onClick={handleGoogleConnect}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                  >
                    Connect Google
                  </button>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Upcoming Events</p>
                    <p className="text-2xl font-bold">{upcomingEvents.length}</p>
                  </div>
                  <div className="text-3xl">📅</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Pending Tasks</p>
                    <p className="text-2xl font-bold">
                      {tasks.filter((t) => t.status === "pending").length}
                    </p>
                  </div>
                  <div className="text-3xl">✅</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Unread Emails</p>
                    <p className="text-2xl font-bold">
                      {emailSummary?.total_unread || 0}
                    </p>
                  </div>
                  <div className="text-3xl">📧</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100">Contacts</p>
                    <p className="text-2xl font-bold">{contacts.length}</p>
                  </div>
                  <div className="text-3xl">👥</div>
                </div>
              </div>
            </div>

            {/* Today's Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Today's Events */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>📅</span>
                  <span>Today's Events</span>
                </h2>
                <div className="space-y-4">
                  {upcomingEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">
                            {event.summary}
                          </h3>
                          {event.location && (
                            <p className="text-gray-400 text-sm mt-1">
                              📍 {event.location}
                            </p>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(event.start.dateTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} - {new Date(event.end.dateTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {upcomingEvents.length === 0 && (
                    <div className="text-gray-400 text-center py-8">
                      No events scheduled for today
                    </div>
                  )}
                </div>
              </div>

              {/* Priority Tasks */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Priority Tasks</span>
                </h2>
                <div className="space-y-4">
                  {tasks
                    .filter((t) => t.status === "pending")
                    .sort((a, b) => {
                      const priorityOrder = { high: 3, medium: 2, low: 1 };
                      return priorityOrder[b.priority] - priorityOrder[a.priority];
                    })
                    .slice(0, 5)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-gray-400 text-sm mt-1">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-2 mt-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                  task.priority
                                )}`}
                              >
                                {task.priority.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">
                                {task.category}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleTaskStatus(task.id, "completed")}
                            className="ml-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  {tasks.filter((t) => t.status === "pending").length === 0 && (
                    <div className="text-gray-400 text-center py-8">
                      No pending tasks
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === "tasks" && (
          <div className="space-y-6">
            {/* Create Task */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Create New Task</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                  className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCreateTask}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                >
                  Add Task
                </button>
              </div>
              <textarea
                placeholder="Task description (optional)..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
                className="w-full mt-4 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Tasks List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {["pending", "in_progress", "completed"].map((status) => (
                <div key={status} className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 capitalize">
                    {status.replace("_", " ")} ({tasks.filter((t) => t.status === status).length})
                  </h3>
                  <div className="space-y-3">
                    {tasks
                      .filter((t) => t.status === status)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-colors"
                        >
                          <h4 className="font-medium text-white text-sm">
                            {task.title}
                          </h4>
                          <div className="flex items-center justify-between mt-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                task.priority
                              )}`}
                            >
                              {task.priority}
                            </span>
                            {task.due_date && (
                              <span className="text-xs text-gray-500">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === "integrations" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Integrations</h2>
            
            {/* Google Integration */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-2xl">
                    🔗
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Google Workspace</h3>
                    <p className="text-gray-400">
                      Calendar, Gmail, Contacts, Drive integration
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {googleAccount?.is_connected ? (
                    <>
                      <span className="text-green-400 text-sm">✅ Connected</span>
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                      >
                        {syncing ? "Syncing..." : "Sync Now"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleGoogleConnect}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {googleAccount?.is_connected && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-green-400 mb-2">📅 Calendar</h4>
                    <p className="text-sm text-gray-300">
                      {upcomingEvents.length} upcoming events
                    </p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-400 mb-2">📧 Gmail</h4>
                    <p className="text-sm text-gray-300">
                      {emailSummary?.total_unread || 0} unread emails
                    </p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-400 mb-2">👥 Contacts</h4>
                    <p className="text-sm text-gray-300">{contacts.length} contacts</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "calendar" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2"><span>📅</span><span>Calendar (Basic)</span></h2>
              <p className="text-sm text-gray-400 mb-4">Upcoming events list. Enhanced visualization available under Calendar+.</p>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{ev.summary || 'Untitled Event'}</h3>
                        <div className="text-xs text-gray-400 mt-1">{new Date(ev.start.dateTime).toLocaleString()} → {new Date(ev.end.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        {ev.location && <div className="text-xs text-gray-500 mt-1">📍 {ev.location}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {upcomingEvents.length === 0 && <div className="text-xs text-gray-500 text-center py-8">No events loaded.</div>}
              </div>
            </div>
          </div>
        )}

        {activeView === "calendar_plus" && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2"><span>🗓️</span><span>Calendar+ (Preview)</span></h2>
              <p className="text-sm text-gray-400 mb-6">Advanced temporal visualization, load balancing, and focus planning (simulated placeholders).</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Timeline */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Today Timeline</h3>
                  <div className="relative border border-gray-700 rounded-lg p-4 h-[320px] overflow-hidden bg-gray-900/40">
                    <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/60 to-purple-500/40" />
                    {upcomingEvents.slice(0,8).map((ev)=>{
                      const start = new Date(ev.start.dateTime);
                      const hour = start.getHours() + start.getMinutes()/60;
                      const top = (hour/24)*300 + 10; // 300px virtual timeline
                      return (
                        <div key={ev.id} style={{ top }} className="absolute left-10 right-2 group">
                          <div className="inline-block bg-blue-600/80 group-hover:bg-blue-600 rounded px-3 py-1 text-xs shadow transition-colors">
                            <span className="font-semibold mr-2">{start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            <span>{ev.summary || 'Event'}</span>
                          </div>
                        </div>
                      );
                    })}
                    {upcomingEvents.length === 0 && <div className="text-xs text-gray-500 text-center mt-24">No events to visualize.</div>}
                  </div>
                </div>
                {/* Heat Map */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Weekly Density (Sim)</h3>
                  <div className="grid grid-cols-7 gap-1 text-[10px] mb-2">
                    {['M','T','W','T','F','S','S'].map(d=> <div key={d} className="text-center text-gray-500">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({length:28}).map((_,i)=>{
                      const v = (i*37)%9; // pseudo density
                      const color = v===0? 'bg-gray-800' : v<3? 'bg-blue-900' : v<6? 'bg-blue-600' : 'bg-purple-600';
                      return <div key={i} className={`w-7 h-7 rounded ${color} flex items-center justify-center text-[8px] text-white/70`}>{v>0? v:''}</div>;
                    })}
                  </div>
                  <div className="flex items-center space-x-2 mt-3 text-[10px] text-gray-400">
                    <span className="bg-blue-900 w-4 h-3 rounded" />
                    <span>Low</span>
                    <span className="bg-blue-600 w-4 h-3 rounded" />
                    <span>Med</span>
                    <span className="bg-purple-600 w-4 h-3 rounded" />
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2"><span>🛠️</span><span>Upcoming Calendar+ Features</span></h3>
              <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                <li>AI conflict detection & focus block suggestions</li>
                <li>Load balance view (color-coded intensity bands)</li>
                <li>Smart grouping of back-to-back micro-meetings</li>
                <li>Context-aware prep buffer recommendation</li>
                <li>Deep link edits & RSVP inline actions</li>
              </ul>
            </div>
          </div>
        )}

        {activeView === "contacts" && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center space-x-2"><span>👥</span><span>Contacts (Preview)</span></h2>
                  <p className="text-sm text-gray-400 mt-1 max-w-2xl">Unified people layer for relationship intelligence. This early scaffold will evolve to support multi-provider sync (Google / Outlook), deduplication, tagging, recency scoring, and AI-driven follow-up suggestions.</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <input
                      value={contactSearch}
                      onChange={e=>setContactSearch(e.target.value)}
                      placeholder="Search contacts..."
                      className="pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
                    />
                    <span className="absolute left-2 top-1.5 text-gray-500">🔍</span>
                  </div>
                  <select
                    value={contactProviderFilter}
                    onChange={e=>setContactProviderFilter(e.target.value)}
                    className="py-2 px-3 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Providers</option>
                    <option value="google">Google</option>
                    <option value="outlook">Outlook</option>
                    <option value="local">Local</option>
                  </select>
                  <button
                    onClick={()=>notify.info('Sync queued','Contact sync will run (stub)')}
                    disabled={!googleAccount?.is_connected}
                    className="px-4 py-2 bg-gradient-blue rounded-lg font-semibold text-sm disabled:opacity-40"
                  >{googleAccount?.is_connected ? 'Sync Contacts' : 'Connect First'}</button>
                </div>
              </div>

              {/* Bulk actions bar */}
              {selectedContactIds.length > 0 && (
                <div className="mb-4 flex items-center justify-between bg-gray-700/60 border border-gray-600 rounded-lg px-4 py-2 text-sm">
                  <div className="text-gray-300">{selectedContactIds.length} selected</div>
                  <div className="flex items-center space-x-2">
                    <button onClick={()=>{setSelectedContactIds([]);}} className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">Clear</button>
                    <button onClick={()=>notify.info('Tagging (stub)','Will open tag dialog')} className="px-3 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-xs">Tag</button>
                    <button onClick={()=>notify.info('Merge (stub)','Would deduplicate/merge')} className="px-3 py-1 rounded bg-blue-600/80 hover:bg-blue-600 text-xs">Merge</button>
                    <button onClick={()=>notify.info('Archive (stub)','Would archive contacts')} className="px-3 py-1 rounded bg-orange-600/80 hover:bg-orange-600 text-xs">Archive</button>
                  </div>
                </div>
              )}

              {/* Desktop / tablet table */}
              <div className="overflow-x-auto border border-gray-700 rounded-lg hidden sm:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-700/60 text-gray-300">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={contacts.length>0 && selectedContactIds.length===contacts.length}
                          onChange={e=>{ if(e.target.checked){ setSelectedContactIds(contacts.map(c=>c.id)); } else { setSelectedContactIds([]);} }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left hidden md:table-cell">Phone</th>
                      <th className="px-3 py-2 text-left hidden lg:table-cell">Relationship</th>
                      <th className="px-3 py-2 text-left hidden md:table-cell">Last Contacted</th>
                      <th className="px-3 py-2 text-left hidden lg:table-cell">Provider</th>
                      <th className="px-3 py-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/70">
                    {contacts
                      .filter(c=>{
                        if(contactProviderFilter!=="all" && (c as any).provider && (c as any).provider!==contactProviderFilter) return false;
                        if(contactSearch && !(c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.email?.toLowerCase().includes(contactSearch.toLowerCase()))) return false;
                        return true;
                      })
                      .map(c=>{
                        const selected = selectedContactIds.includes(c.id);
                        const score = Math.floor(((c.lastContacted? Date.now() - new Date(c.lastContacted).getTime(): Infinity)%100000)/1000); // placeholder recency metric
                        return (
                          <tr key={c.id} className={`hover:bg-gray-700/40 ${selected? 'bg-blue-600/10':''}`}> 
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={selected} onChange={e=>{
                                if(e.target.checked){setSelectedContactIds(prev=>[...prev,c.id]);} else {setSelectedContactIds(prev=>prev.filter(id=>id!==c.id));}
                              }} />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-medium text-white">{c.name || '—'}</td>
                            <td className="px-3 py-2 text-gray-300">{c.email || '—'}</td>
                            <td className="px-3 py-2 hidden md:table-cell text-gray-400">{c.phone || '—'}</td>
                            <td className="px-3 py-2 hidden lg:table-cell text-gray-400">{c.relationship || '—'}</td>
                            <td className="px-3 py-2 hidden md:table-cell text-gray-400 text-xs">{c.lastContacted ? new Date(c.lastContacted).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2 hidden lg:table-cell text-gray-400 text-xs">{(c as any).provider || 'local'}</td>
                            <td className="px-3 py-2 text-right">
                              <span className="inline-block px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">{isFinite(score)? score: '∞'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    {contacts.length===0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-gray-500 text-sm">
                          No contacts loaded yet. Sync to import from providers.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="sm:hidden space-y-3">
                {contacts
                  .filter(c=>{
                    if(contactProviderFilter!=="all" && (c as any).provider && (c as any).provider!==contactProviderFilter) return false;
                    if(contactSearch && !(c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.email?.toLowerCase().includes(contactSearch.toLowerCase()))) return false;
                    return true;
                  })
                  .map(c=>{
                    const score = Math.floor(((c.lastContacted? Date.now() - new Date(c.lastContacted).getTime(): Infinity)%100000)/1000);
                    const selected = selectedContactIds.includes(c.id);
                    return (
                      <div key={c.id} className={`border border-gray-700 rounded-lg p-4 bg-gray-800/60 relative ${selected? 'ring-2 ring-blue-500':''}`}> 
                        <div className="absolute top-2 right-2">
                          <input type="checkbox" checked={selected} onChange={e=>{ if(e.target.checked){setSelectedContactIds(prev=>[...prev,c.id]);} else {setSelectedContactIds(prev=>prev.filter(id=>id!==c.id));}}} />
                        </div>
                        <div className="text-sm font-semibold text-white mb-1">{c.name || '—'}</div>
                        <div className="text-xs text-gray-300 mb-1">{c.email}</div>
                        {c.phone && <div className="text-[11px] text-gray-400 mb-1">📞 {c.phone}</div>}
                        {c.relationship && <div className="text-[11px] text-gray-400 mb-1">🤝 {c.relationship}</div>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="inline-block px-2 py-1 rounded text-[10px] bg-gray-700 text-gray-300">{isFinite(score)? score: '∞'}</span>
                          <span className="text-[10px] text-gray-500">{c.lastContacted? new Date(c.lastContacted).toLocaleDateString(): '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                {contacts.length===0 && <div className="text-xs text-gray-500 text-center py-6">No contacts loaded.</div>}
              </div>

              <div className="mt-6 grid md:grid-cols-3 gap-6">
                <div className="bg-gray-700/40 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-purple-300">Planned Intelligence</h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>Recency & relationship strength scoring model</li>
                    <li>Contextual follow-up recommendations</li>
                    <li>Automatic tagging via semantic clustering</li>
                  </ul>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-blue-300">Data Operations</h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>Provider sync status & error surfacing</li>
                    <li>Duplicate detection & merge workflow</li>
                    <li>Custom fields + notes timeline</li>
                  </ul>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 text-green-300">Automation & Safety</h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>Threshold alerts (stale relationships)</li>
                    <li>Privacy redaction for sensitive fields</li>
                    <li>Selective export / sharing controls</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === "journal" && (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center space-x-2"><span>📝</span><span>Journal (Preview)</span></h2>
                  <p className="text-sm text-gray-400 mt-1 max-w-2xl">Capture reflections and convert insights into action. Sentiment & emotion analysis forthcoming.</p>
                </div>
                <button onClick={()=>notify.info('New Entry (stub)','Journal entry creation modal will appear')} className="px-4 py-2 bg-gradient-purple rounded-lg font-semibold text-sm">New Entry</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Entries List */}
                <div className="lg:col-span-1 border border-gray-700 rounded-lg overflow-hidden flex flex-col max-h-[520px]">
                  <div className="bg-gray-700/40 px-4 py-2 text-xs uppercase tracking-wide text-gray-300">Entries</div>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-700/60">
                    {journalEntries.length === 0 && (
                      <div className="text-gray-500 text-sm p-6 text-center">No entries yet. Start by adding one.</div>
                    )}
                    {journalEntries.map(e=>{
                      const sel = e.id===selectedJournalId;
                      const sentiment = e.sentiment_score;
                      const sentimentColor = sentiment==null? 'bg-gray-600' : sentiment>0.3? 'bg-green-600' : sentiment<-0.3? 'bg-red-600':'bg-yellow-600';
                      return (
                        <button key={e.id} onClick={()=>setSelectedJournalId(e.id)} className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-700/50 transition-colors ${sel? 'bg-gray-700/70':''}`}> 
                          <div className="flex items-start justify-between">
                            <div className="flex-1 pr-2">
                              <div className="font-medium text-white truncate">{e.content.slice(0,40) || 'Entry'}</div>
                              <div className="text-[10px] text-gray-400 mt-1">{new Date(e.entry_date || Date.now()).toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              {e.mood && <span className="text-[10px] px-2 py-0.5 rounded bg-gray-600 text-gray-200">{e.mood}</span>}
                              <span className={`w-3 h-3 rounded-full ${sentimentColor}`}></span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Detail & Insights */}
                <div className="lg:col-span-2 space-y-6">
                  {selectedJournalId ? (
                    (()=>{
                      const entry = journalEntries.find(e=>e.id===selectedJournalId);
                      if(!entry) return <div className="text-gray-500">Entry not found.</div>;
                      return (
                        <div className="space-y-6">
                          <div className="border border-gray-700 rounded-lg p-6 bg-gray-900/40">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="font-semibold text-white">Reflection</h3>
                                <div className="text-xs text-gray-500 mt-1">{new Date(entry.entry_date || Date.now()).toLocaleString()}</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {entry.mood && <span className="px-2 py-1 rounded bg-gray-700 text-xs text-gray-200">Mood: {entry.mood}</span>}
                                {entry.sentiment_score!=null && <span className="px-2 py-1 rounded bg-gray-700 text-xs text-gray-200">Sentiment: {entry.sentiment_score.toFixed(2)}</span>}
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-gray-200 text-sm leading-relaxed">{entry.content}</p>
                          </div>
                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/40">
                              <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2"><span>🧠</span><span>Derived Insights (Upcoming)</span></h4>
                              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                                <li>AI highlights key stressors & wins.</li>
                                <li>Suggests 1–3 focus themes.</li>
                                <li>Links related past entries.</li>
                              </ul>
                              <button onClick={()=>notify.info('Derive tasks (stub)','Will call derive endpoint')} className="mt-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium">Derive Tasks</button>
                            </div>
                            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/40">
                              <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2"><span>🧪</span><span>Emotion Cloud (Future)</span></h4>
                              <div className="text-xs text-gray-500">Emotion distribution visualization placeholder.</div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {(entry.emotions? Object.entries(entry.emotions): [['focus',0.4],['stress',0.2],['optimism',0.6]]).slice(0,6).map(([k,v])=> (
                                  <span key={k} className="px-2 py-1 rounded bg-gray-700 text-[10px] tracking-wide text-gray-200">{k}:{(v as number).toFixed(2)}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-gray-500 text-sm border border-dashed border-gray-600 rounded-lg p-12 text-center">Select an entry to view details. When AI enrichment arrives, insights & derived tasks appear here.</div>
                  )}
                </div>
              </div>
              <div className="mt-8 bg-gray-800/60 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2"><span>🛠️</span><span>Upcoming Journal Features</span></h3>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                  <li>Automatic sentiment & emotion analysis pipeline</li>
                  <li>Journal → Task derivation with editable suggestions</li>
                  <li>Weekly mood trend visualization</li>
                  <li>Semantic similarity clustering & topic tags</li>
                  <li>Protected private mode (local encryption option)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* AI Suggestions Panel */}
      {showAiPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">🤖 AI Suggestions</h3>
              <button
                onClick={() => setShowAiPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {aiSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-700 rounded-lg border border-gray-600"
                >
                  <p className="text-gray-200">{suggestion}</p>
                </div>
              ))}
              {aiSuggestions.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  Generating AI suggestions...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

