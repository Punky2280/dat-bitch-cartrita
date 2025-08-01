import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell,
  Settings,
  Calendar,
  Mail,
  Users,
  Clock,
  CheckCircle,
  X,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor,
  AlertTriangle,
  Info,
  Gift,
  Briefcase,
  RefreshCw,
  Filter,
  Archive
} from 'lucide-react';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  is_read: boolean;
  created_at: string;
  scheduled_for?: string;
  metadata?: any;
  actions?: Array<{
    id: string;
    label: string;
    action_type: string;
    data: any;
  }>;
}

interface NotificationPreference {
  notification_type: string;
  enabled: boolean;
  delivery_method: 'in_app' | 'email' | 'push' | 'sms';
  sound_enabled: boolean;
  advance_minutes?: number;
  quiet_hours?: {
    enabled: boolean;
    start_time: string;
    end_time: string;
  };
}

interface NotificationStats {
  total_notifications: number;
  unread_count: number;
  today_count: number;
  urgent_count: number;
}

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
    fetchStats();
  }, [filter, categoryFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        limit: '50',
        ...(filter !== 'all' && { [filter]: 'true' }),
        ...(categoryFilter !== 'all' && { category: categoryFilter })
      });
      
      const response = await fetch(`/api/notifications?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || []);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      const token = localStorage.getItem('token');
      await Promise.all(notificationIds.map(id => 
        fetch(`/api/notifications/${id}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ));
      await fetchNotifications();
      await fetchStats();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      await fetchNotifications();
      await fetchStats();
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const updatePreferences = async (updatedPreferences: NotificationPreference[]) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferences: updatedPreferences
        })
      });
      
      if (response.ok) {
        setPreferences(updatedPreferences);
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  };

  const testNotification = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_type: 'test',
          title: 'Test Notification',
          message: 'This is a test notification from your Personal Life OS',
          priority: 'normal'
        })
      });
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      'low': 'bg-gray-100 text-gray-800',
      'normal': 'bg-blue-100 text-blue-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || colors.normal;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      'calendar': <Calendar className="w-4 h-4" />,
      'email': <Mail className="w-4 h-4" />,
      'contact': <Users className="w-4 h-4" />,
      'system': <Settings className="w-4 h-4" />,
      'reminder': <Clock className="w-4 h-4" />,
      'birthday': <Gift className="w-4 h-4" />,
      'work': <Briefcase className="w-4 h-4" />
    };
    return icons[category as keyof typeof icons] || <Bell className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'calendar': 'bg-blue-100 text-blue-800',
      'email': 'bg-green-100 text-green-800',
      'contact': 'bg-purple-100 text-purple-800',
      'system': 'bg-gray-100 text-gray-800',
      'reminder': 'bg-yellow-100 text-yellow-800',
      'birthday': 'bg-pink-100 text-pink-800',
      'work': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category as keyof typeof colors] || colors.system;
  };

  const updatePreference = (type: string, field: string, value: any) => {
    const updated = preferences.map(pref => 
      pref.notification_type === type 
        ? { ...pref, [field]: value }
        : pref
    );
    updatePreferences(updated);
  };

  const markAllAsRead = () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notification Center</h2>
          <p className="text-gray-600">Manage your alerts and notification preferences</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={testNotification} variant="outline" size="sm">
            Test Notification
          </Button>
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All Read
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
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{stats.total_notifications}</p>
                </div>
                <Bell className="w-8 h-8 text-blue-500" />
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
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Today</p>
                  <p className="text-2xl font-bold text-green-600">{stats.today_count}</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Urgent</p>
                  <p className="text-2xl font-bold text-red-600">{stats.urgent_count}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex space-x-4">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread_only">Unread Only</SelectItem>
                    <SelectItem value="urgent_only">Urgent Only</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="contact">Contacts</SelectItem>
                    <SelectItem value="reminder">Reminders</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications ({notifications.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2">Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No notifications found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={`border rounded-lg p-4 ${
                        !notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-full ${getCategoryColor(notification.category)}`}>
                            {getCategoryIcon(notification.category)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className={`font-medium ${!notification.is_read ? 'font-semibold' : ''}`}>
                                {notification.title}
                              </h3>
                              <Badge className={getPriorityColor(notification.priority)}>
                                {notification.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {notification.category}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>{formatDate(notification.created_at)}</span>
                              {notification.scheduled_for && (
                                <span>Scheduled for: {formatDate(notification.scheduled_for)}</span>
                              )}
                              {!notification.is_read && (
                                <Badge variant="secondary" className="text-xs">Unread</Badge>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex space-x-2 mt-3">
                                {notification.actions.map((action) => (
                                  <Button 
                                    key={action.id}
                                    variant="outline" 
                                    size="sm"
                                    className="text-xs"
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-1 ml-4">
                          {!notification.is_read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => markAsRead([notification.id])}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => dismissNotification(notification.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <p className="text-sm text-gray-600">
                Customize how and when you receive notifications
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {preferences.map((pref) => (
                  <div key={pref.notification_type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium capitalize">
                          {pref.notification_type.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Configure {pref.notification_type.replace(/_/g, ' ')} notifications
                        </p>
                      </div>
                      <Switch
                        checked={pref.enabled}
                        onCheckedChange={(checked) => 
                          updatePreference(pref.notification_type, 'enabled', checked)
                        }
                      />
                    </div>
                    
                    {pref.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Delivery Method */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Delivery Method
                          </label>
                          <Select 
                            value={pref.delivery_method}
                            onValueChange={(value) => 
                              updatePreference(pref.notification_type, 'delivery_method', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_app">
                                <div className="flex items-center">
                                  <Monitor className="w-4 h-4 mr-2" />
                                  In-App
                                </div>
                              </SelectItem>
                              <SelectItem value="email">
                                <div className="flex items-center">
                                  <Mail className="w-4 h-4 mr-2" />
                                  Email
                                </div>
                              </SelectItem>
                              <SelectItem value="push">
                                <div className="flex items-center">
                                  <Smartphone className="w-4 h-4 mr-2" />
                                  Push
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Sound */}
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-medium text-gray-700">
                            Sound
                          </label>
                          <Switch
                            checked={pref.sound_enabled}
                            onCheckedChange={(checked) => 
                              updatePreference(pref.notification_type, 'sound_enabled', checked)
                            }
                          />
                          {pref.sound_enabled ? (
                            <Volume2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <VolumeX className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        
                        {/* Advance Minutes (for time-based notifications) */}
                        {pref.notification_type.includes('reminder') && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Advance Notice (minutes)
                            </label>
                            <Select 
                              value={pref.advance_minutes?.toString() || '15'}
                              onValueChange={(value) => 
                                updatePreference(pref.notification_type, 'advance_minutes', parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5 minutes</SelectItem>
                                <SelectItem value="15">15 minutes</SelectItem>
                                <SelectItem value="30">30 minutes</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="1440">1 day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationCenter;