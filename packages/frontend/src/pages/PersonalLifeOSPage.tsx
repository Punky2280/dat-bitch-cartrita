import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Mail,
  Users,
  Bell,
  Shield,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import CalendarManager from '../components/CalendarManager';
import EmailProcessor from '../components/EmailProcessor';
import ContactHub from '../components/ContactHub';
import NotificationCenter from '../components/NotificationCenter';
import PrivacyControls from '../components/PrivacyControls';

interface PersonalLifeOSPageProps {
  token: string;
  onBack: () => void;
}

const PersonalLifeOSPage: React.FC<PersonalLifeOSPageProps> = ({
  token,
  onBack,
}) => {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch('/api/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2">Loading Personal Life OS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-gray-600/50 p-4">
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
                Personal Life OS
              </h1>
              <p className="text-gray-400 mt-2">
                Manage your calendar, emails, contacts, and privacy settings in
                one place
              </p>
            </div>
          </div>
          <Button
            onClick={fetchSystemStatus}
            variant="outline"
            size="sm"
            className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* System Status Overview */}
        {systemStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {systemStatus.services?.services &&
                  Object.entries(systemStatus.services.services).map(
                    ([service, status]: [string, any]) => (
                      <div
                        key={service}
                        className="flex items-center space-x-2"
                      >
                        {getServiceStatusIcon(status.status)}
                        <span className="text-sm font-medium capitalize">
                          {service.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                    )
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Interface Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <Users className="w-4 h-4 mr-2" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="w-4 h-4 mr-2" />
              Privacy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Calendar Quick View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                    Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage your events and schedule
                  </p>
                  <Button
                    onClick={() => setActiveTab('calendar')}
                    className="w-full"
                    variant="outline"
                  >
                    Open Calendar Manager
                  </Button>
                </CardContent>
              </Card>

              {/* Email Quick View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-green-500" />
                    Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Process and categorize your emails
                  </p>
                  <Button
                    onClick={() => setActiveTab('email')}
                    className="w-full"
                    variant="outline"
                  >
                    Open Email Processor
                  </Button>
                </CardContent>
              </Card>

              {/* Contacts Quick View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2 text-purple-500" />
                    Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Sync and manage your contacts
                  </p>
                  <Button
                    onClick={() => setActiveTab('contacts')}
                    className="w-full"
                    variant="outline"
                  >
                    Open Contact Hub
                  </Button>
                </CardContent>
              </Card>

              {/* Notifications Quick View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="w-5 h-5 mr-2 text-orange-500" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Smart alerts and reminders
                  </p>
                  <Button
                    onClick={() => setActiveTab('notifications')}
                    className="w-full"
                    variant="outline"
                  >
                    Open Notification Center
                  </Button>
                </CardContent>
              </Card>

              {/* Privacy Quick View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-red-500" />
                    Privacy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Control your data and privacy
                  </p>
                  <Button
                    onClick={() => setActiveTab('privacy')}
                    className="w-full"
                    variant="outline"
                  >
                    Open Privacy Controls
                  </Button>
                </CardContent>
              </Card>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-gray-500" />
                    System Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge variant="success">Operational</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Services:</span>
                      <span>
                        {systemStatus?.services?.services
                          ? Object.keys(systemStatus.services.services).length
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarManager />
          </TabsContent>

          <TabsContent value="email">
            <EmailProcessor />
          </TabsContent>

          <TabsContent value="contacts">
            <ContactHub />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationCenter />
          </TabsContent>

          <TabsContent value="privacy">
            <PrivacyControls />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PersonalLifeOSPage;
