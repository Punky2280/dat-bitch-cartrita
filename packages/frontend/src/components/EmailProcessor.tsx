import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail,
  RefreshCw,
  Search,
  Archive,
  Star,
  Reply,
  Forward,
  Filter,
  AlertCircle,
  CheckCircle,
  Paperclip
} from 'lucide-react';

interface EmailMessage {
  id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  body_preview: string;
  received_at: string;
  is_read: boolean;
  is_important: boolean;
  has_attachments: boolean;
  category: string;
  sentiment: string;
  provider: string;
  thread_id?: string;
}

interface EmailStats {
  total_messages: number;
  unread_count: number;
  important_count: number;
  categories: Record<string, number>;
}

const EmailProcessor: React.FC = () => {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEmailStats();
    fetchEmails();
  }, [categoryFilter, statusFilter]);

  const fetchEmailStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/email/stats?days=30', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch email stats:', error);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        limit: '50',
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(statusFilter === 'unread' && { is_read: 'false' }),
        ...(statusFilter === 'important' && { is_important: 'true' }),
        ...(searchQuery && { query: searchQuery })
      });
      
      const endpoint = searchQuery ? '/api/email/search' : '/api/email/messages';
      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmails(data.messages || data.results || []);
      } else {
        console.error('Failed to fetch emails:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncEmails = async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/email/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          providers: ['gmail'],
          max_messages: 100
        })
      });
      
      if (response.ok) {
        await fetchEmails();
        await fetchEmailStats();
      } else {
        const error = await response.json();
        console.error('Sync failed:', error);
      }
    } catch (error) {
      console.error('Failed to sync emails:', error);
    } finally {
      setSyncing(false);
    }
  };

  const markAsRead = async (emailIds: string[]) => {
    try {
      const token = localStorage.getItem('token');
      await Promise.all(emailIds.map(id => 
        fetch(`/api/email/messages/${id}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ));
      await fetchEmails();
      await fetchEmailStats();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const archiveEmails = async (emailIds: string[]) => {
    try {
      const token = localStorage.getItem('token');
      await Promise.all(emailIds.map(id => 
        fetch(`/api/email/messages/${id}/archive`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ));
      await fetchEmails();
    } catch (error) {
      console.error('Failed to archive emails:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'work': 'bg-blue-100 text-blue-800',
      'personal': 'bg-green-100 text-green-800',
      'finance': 'bg-yellow-100 text-yellow-800',
      'newsletter': 'bg-purple-100 text-purple-800',
      'promotional': 'bg-orange-100 text-orange-800',
      'social': 'bg-pink-100 text-pink-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return '😊';
      case 'negative': return '😟';
      case 'urgent': return '🚨';
      default: return '';
    }
  };

  const handleEmailSelect = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(email => email.id)));
    }
  };

  const handleSearch = () => {
    fetchEmails();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Processor</h2>
          <p className="text-gray-600">Process and categorize your emails with AI insights</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={syncEmails} 
            disabled={syncing}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Emails'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Messages</p>
                  <p className="text-2xl font-bold">{stats.total_messages}</p>
                </div>
                <Mail className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unread</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.unread_count}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Important</p>
                  <p className="text-2xl font-bold text-red-600">{stats.important_count}</p>
                </div>
                <Star className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Categories</p>
                  <p className="text-2xl font-bold">{Object.keys(stats.categories || {}).length}</p>
                </div>
                <Filter className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="flex space-x-2">
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="outline">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedEmails.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => markAsRead(Array.from(selectedEmails))}
                  variant="outline"
                  size="sm"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Read
                </Button>
                <Button 
                  onClick={() => archiveEmails(Array.from(selectedEmails))}
                  variant="outline"
                  size="sm"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Messages ({emails.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              {selectedEmails.size === emails.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2">Loading emails...</span>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' 
                ? 'No emails match your filters' 
                : 'No emails found'}
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div 
                  key={email.id} 
                  className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedEmails.has(email.id) ? 'bg-blue-50 border-blue-200' : ''
                  } ${!email.is_read ? 'font-medium bg-blue-25' : ''}`}
                  onClick={() => handleEmailSelect(email.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <input
                          type="checkbox"
                          checked={selectedEmails.has(email.id)}
                          onChange={() => handleEmailSelect(email.id)}
                          className="rounded border-gray-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-medium text-gray-900 truncate">
                          {email.sender_name || email.sender_email}
                        </span>
                        {email.is_important && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                        {email.has_attachments && <Paperclip className="w-4 h-4 text-gray-400" />}
                        <Badge className={getCategoryColor(email.category)}>
                          {email.category}
                        </Badge>
                        {getSentimentIcon(email.sentiment) && (
                          <span className="text-sm">{getSentimentIcon(email.sentiment)}</span>
                        )}
                      </div>
                      
                      <h3 className={`text-sm truncate mb-1 ${!email.is_read ? 'font-semibold' : 'font-normal'}`}>
                        {email.subject}
                      </h3>
                      
                      <p className="text-sm text-gray-600 truncate mb-2">
                        {email.body_preview}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatDate(email.received_at)}</span>
                        <span>via {email.provider}</span>
                        {!email.is_read && (
                          <Badge variant="secondary" className="text-xs">
                            Unread
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-4">
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Reply className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Forward className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailProcessor;