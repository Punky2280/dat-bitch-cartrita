import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: string[];
  calendar_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const CalendarManager: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetchCalendarStatus();
    fetchEvents();
  }, []);

  const fetchCalendarStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch calendar status:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/events?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        console.error('Failed to fetch events:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          calendar_ids: ['primary']
        })
      });
      
      if (response.ok) {
        await fetchEvents();
        await fetchCalendarStatus();
      } else {
        const error = await response.json();
        console.error('Sync failed:', error);
      }
    } catch (error) {
      console.error('Failed to sync calendar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    
    if (duration < 60) {
      return `${duration}m`;
    } else {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'tentative': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(filter.toLowerCase()) ||
    event.description?.toLowerCase().includes(filter.toLowerCase()) ||
    event.location?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendar Manager</h2>
          <p className="text-gray-600">Manage your calendar events and sync with Google Calendar</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={syncCalendar} 
            disabled={syncing}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Calendar'}
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Status Card */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Calendar Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                {status.status?.google_calendar ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> :
                  <AlertCircle className="w-4 h-4 text-red-500" />
                }
                <span className="text-sm font-medium">
                  Google Calendar: {status.status?.google_calendar ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Last Sync: </span>
                <span>{status.status?.last_sync ? formatDate(status.status.last_sync) : 'Never'}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Total Events: </span>
                <span>{events.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <Input
          placeholder="Search events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Events ({filteredEvents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2">Loading events...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filter ? 'No events match your search' : 'No events found'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => (
                <div key={event.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium text-gray-900">{event.title}</h3>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDate(event.start_time)}
                        </div>
                        <div className="flex items-center">
                          <span>Duration: {formatDuration(event.start_time, event.end_time)}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {event.location}
                          </div>
                        )}
                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            {event.attendees.length} attendees
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
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

export default CalendarManager;