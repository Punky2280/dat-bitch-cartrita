import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users,
  RefreshCw,
  Search,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
  Star,
  MessageCircle,
  Camera,
  UserCheck,
  Activity,
  Gift,
  Tag
} from 'lucide-react';

interface Contact {
  id: string;
  contact_id: string;
  provider: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email_addresses: Array<{email: string, type: string, primary: boolean}>;
  phone_numbers: Array<{number: string, type: string, primary: boolean}>;
  addresses: Array<{street: string, city: string, state: string, country: string, type: string}>;
  organizations: Array<{company: string, title: string, department: string}>;
  birthday: string;
  anniversary: string;
  notes: string;
  photo_url: string;
  tags: string[];
  last_interaction_at: string;
  interaction_count: number;
  created_at: string;
  updated_at: string;
}

interface ContactInteraction {
  id: string;
  interaction_type: string;
  interaction_date: string;
  description: string;
  metadata: any;
}

interface ContactStats {
  total_contacts: number;
  synced_today: number;
  upcoming_birthdays: number;
  recent_interactions: number;
}

const ContactHub: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [newInteraction, setNewInteraction] = useState({
    type: 'email',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchContactStats();
    fetchContacts();
  }, []);

  const fetchContactStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/contacts/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch contact stats:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        limit: '100',
        ...(searchQuery && { query: searchQuery })
      });
      
      const endpoint = searchQuery ? '/api/contacts/search' : '/api/contacts';
      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || data.results || []);
      } else {
        console.error('Failed to fetch contacts:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncContacts = async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/contacts/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          providers: ['google'],
          max_contacts: 500
        })
      });
      
      if (response.ok) {
        await fetchContacts();
        await fetchContactStats();
      } else {
        const error = await response.json();
        console.error('Sync failed:', error);
      }
    } catch (error) {
      console.error('Failed to sync contacts:', error);
    } finally {
      setSyncing(false);
    }
  };

  const fetchContactInteractions = async (contactId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/contacts/${contactId}/interactions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInteractions(data.interactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch interactions:', error);
    }
  };

  const addInteraction = async () => {
    if (!selectedContact) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/contacts/${selectedContact.id}/interactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          interaction_type: newInteraction.type,
          interaction_date: new Date(newInteraction.date).toISOString(),
          description: newInteraction.description
        })
      });
      
      if (response.ok) {
        await fetchContactInteractions(selectedContact.id);
        setNewInteraction({
          type: 'email',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        setShowInteractionModal(false);
      }
    } catch (error) {
      console.error('Failed to add interaction:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatLastInteraction = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'message': return <MessageCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getInteractionColor = (type: string) => {
    const colors = {
      'email': 'bg-blue-100 text-blue-800',
      'phone': 'bg-green-100 text-green-800',
      'meeting': 'bg-purple-100 text-purple-800',
      'message': 'bg-yellow-100 text-yellow-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getInitials = (contact: Contact) => {
    const first = contact.first_name?.charAt(0) || '';
    const last = contact.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || contact.display_name?.charAt(0)?.toUpperCase() || '?';
  };

  const handleSearch = () => {
    fetchContacts();
  };

  const openContactDetails = (contact: Contact) => {
    setSelectedContact(contact);
    fetchContactInteractions(contact.id);
    setShowContactModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contact Hub</h2>
          <p className="text-gray-600">Sync and manage your contacts with interaction tracking</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={syncContacts} 
            disabled={syncing}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Contacts'}
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Contact
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
                  <p className="text-sm text-gray-600">Total Contacts</p>
                  <p className="text-2xl font-bold">{stats.total_contacts}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Synced Today</p>
                  <p className="text-2xl font-bold text-green-600">{stats.synced_today}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming Birthdays</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.upcoming_birthdays}</p>
                </div>
                <Gift className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Recent Interactions</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.recent_interactions}</p>
                </div>
                <Activity className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} variant="outline">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2">Loading contacts...</span>
          </div>
        ) : contacts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            {searchQuery ? 'No contacts match your search' : 'No contacts found'}
          </div>
        ) : (
          contacts.map((contact) => (
            <Card 
              key={contact.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openContactDetails(contact)}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {contact.photo_url ? (
                      <img 
                        src={contact.photo_url} 
                        alt={contact.display_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                        {getInitials(contact)}
                      </div>
                    )}
                  </div>
                  
                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {contact.display_name || `${contact.first_name} ${contact.last_name}`}
                    </h3>
                    
                    {/* Primary Email */}
                    {contact.email_addresses?.find(e => e.primary)?.email && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Mail className="w-3 h-3 mr-1" />
                        <span className="truncate">
                          {contact.email_addresses.find(e => e.primary)?.email}
                        </span>
                      </div>
                    )}
                    
                    {/* Primary Phone */}
                    {contact.phone_numbers?.find(p => p.primary)?.number && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        <span className="truncate">
                          {contact.phone_numbers.find(p => p.primary)?.number}
                        </span>
                      </div>
                    )}
                    
                    {/* Company */}
                    {contact.organizations?.[0]?.company && (
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Building className="w-3 h-3 mr-1" />
                        <span className="truncate">
                          {contact.organizations[0].company}
                        </span>
                      </div>
                    )}
                    
                    {/* Tags */}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contact.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {contact.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{contact.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Last Interaction */}
                    <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Activity className="w-3 h-3 mr-1" />
                        {formatLastInteraction(contact.last_interaction_at)}
                      </div>
                      <div className="flex items-center">
                        <span>{contact.interaction_count} interactions</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Contact Details Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              {selectedContact?.photo_url ? (
                <img 
                  src={selectedContact.photo_url} 
                  alt={selectedContact.display_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                  {selectedContact && getInitials(selectedContact)}
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">
                  {selectedContact?.display_name || `${selectedContact?.first_name} ${selectedContact?.last_name}`}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedContact?.organizations?.[0]?.title} at {selectedContact?.organizations?.[0]?.company}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-6">
              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email Addresses */}
                {selectedContact.email_addresses && selectedContact.email_addresses.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Email Addresses</h4>
                    <div className="space-y-1">
                      {selectedContact.email_addresses.map((email, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{email.email}</span>
                          <Badge variant="outline" className="text-xs">{email.type}</Badge>
                          {email.primary && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Phone Numbers */}
                {selectedContact.phone_numbers && selectedContact.phone_numbers.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Phone Numbers</h4>
                    <div className="space-y-1">
                      {selectedContact.phone_numbers.map((phone, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{phone.number}</span>
                          <Badge variant="outline" className="text-xs">{phone.type}</Badge>
                          {phone.primary && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Important Dates */}
              {(selectedContact.birthday || selectedContact.anniversary) && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Important Dates</h4>
                  <div className="space-y-1 text-sm">
                    {selectedContact.birthday && (
                      <div className="flex items-center space-x-2">
                        <Gift className="w-4 h-4 text-gray-400" />
                        <span>Birthday: {formatDate(selectedContact.birthday)}</span>
                      </div>
                    )}
                    {selectedContact.anniversary && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Anniversary: {formatDate(selectedContact.anniversary)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Notes */}
              {selectedContact.notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedContact.notes}
                  </p>
                </div>
              )}
              
              {/* Interactions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Recent Interactions</h4>
                  <Button 
                    size="sm" 
                    onClick={() => setShowInteractionModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                {interactions.length === 0 ? (
                  <p className="text-sm text-gray-500">No interactions recorded</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {interactions.map((interaction) => (
                      <div key={interaction.id} className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
                        <Badge className={getInteractionColor(interaction.interaction_type)}>
                          {getInteractionIcon(interaction.interaction_type)}
                          <span className="ml-1 capitalize">{interaction.interaction_type}</span>
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{interaction.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(interaction.interaction_date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Interaction Modal */}
      <Dialog open={showInteractionModal} onOpenChange={setShowInteractionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Type</label>
              <Select value={newInteraction.type} onValueChange={(value) => setNewInteraction({...newInteraction, type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Date</label>
              <Input
                type="date"
                value={newInteraction.date}
                onChange={(e) => setNewInteraction({...newInteraction, date: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={newInteraction.description}
                onChange={(e) => setNewInteraction({...newInteraction, description: e.target.value})}
                placeholder="Brief description of the interaction..."
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowInteractionModal(false)}>
                Cancel
              </Button>
              <Button onClick={addInteraction} disabled={!newInteraction.description}>
                Add Interaction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactHub;