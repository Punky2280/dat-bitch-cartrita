# Iteration 19: Personal Life OS - Architecture & Implementation Plan

## Overview

Transform Cartrita into a comprehensive Personal Life OS by integrating with Calendar, Email, and Contact APIs. This iteration leverages the existing Secure API Key Vault (Iteration 18) to provide seamless integration with major productivity services.

## Core Services Architecture

### 1. Google Calendar Integration Service

**File**: `/packages/backend/src/services/CalendarService.js`

**Capabilities**:

- Event creation, modification, and deletion
- Calendar synchronization across multiple calendars
- Recurring event management
- Meeting invitation handling
- Smart scheduling suggestions
- Calendar conflict detection
- Time zone management

**API Endpoints**:

- `GET /api/calendar/events` - Fetch events with filtering
- `POST /api/calendar/events` - Create new events
- `PUT /api/calendar/events/:id` - Update existing events
- `DELETE /api/calendar/events/:id` - Delete events
- `GET /api/calendar/availability` - Check availability
- `POST /api/calendar/schedule` - Smart scheduling with AI

### 2. Email Management Service

**File**: `/packages/backend/src/services/EmailService.js`

**Capabilities**:

- Gmail and Outlook integration
- Email summarization with AI
- Intelligent email categorization
- Auto-response suggestions
- Email thread management
- Attachment handling
- Spam and priority detection

**API Endpoints**:

- `GET /api/email/messages` - Fetch emails with filtering
- `POST /api/email/send` - Send emails
- `PUT /api/email/messages/:id` - Update email (labels, read status)
- `GET /api/email/summary` - AI-generated email summaries
- `POST /api/email/compose-assist` - AI writing assistance

### 3. Contact Synchronization Service

**File**: `/packages/backend/src/services/ContactService.js`

**Capabilities**:

- Google Contacts and Outlook integration
- Contact deduplication and merging
- Social media profile linking
- Contact relationship mapping
- Birthday and anniversary tracking
- Contact interaction history

**API Endpoints**:

- `GET /api/contacts` - Fetch contacts with search
- `POST /api/contacts` - Create new contacts
- `PUT /api/contacts/:id` - Update contact information
- `DELETE /api/contacts/:id` - Delete contacts
- `GET /api/contacts/:id/interactions` - Interaction history

### 4. Proactive Assistant Agent

**File**: `/packages/backend/src/agi/consciousness/PersonalAssistantAgent.js`

**Capabilities**:

- Meeting preparation assistance
- Email triage and prioritization
- Calendar optimization suggestions
- Follow-up reminders
- Task extraction from emails/meetings
- Context-aware notifications

## Database Schema Extensions

### Calendar Data Tables

```sql
-- Calendar events storage
CREATE TABLE user_calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    calendar_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100),
    location VARCHAR(500),
    attendees JSONB,
    recurrence_rule VARCHAR(255),
    reminder_minutes INTEGER[],
    status VARCHAR(50) DEFAULT 'confirmed',
    visibility VARCHAR(50) DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id, event_id)
);

-- Calendar synchronization status
CREATE TABLE user_calendar_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    calendar_id VARCHAR(255) NOT NULL,
    calendar_name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'apple'
    sync_token VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id)
);
```

### Email Data Tables

```sql
-- Email messages cache
CREATE TABLE user_email_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    provider VARCHAR(50) NOT NULL, -- 'gmail', 'outlook'
    folder VARCHAR(100) NOT NULL, -- 'inbox', 'sent', 'trash', etc.
    subject VARCHAR(500),
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipient_emails TEXT[],
    cc_emails TEXT[],
    bcc_emails TEXT[],
    body_text TEXT,
    body_html TEXT,
    attachments JSONB,
    labels TEXT[],
    is_read BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    is_spam BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_category VARCHAR(100),
    ai_sentiment VARCHAR(50),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, message_id, provider)
);

-- Email sync status
CREATE TABLE user_email_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    sync_token VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    folders_to_sync TEXT[] DEFAULT ARRAY['inbox', 'sent'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, email_address)
);
```

### Contact Data Tables

```sql
-- Contact information
CREATE TABLE user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    contact_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'apple'
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    email_addresses JSONB, -- Array of {email, type, primary}
    phone_numbers JSONB,   -- Array of {number, type, primary}
    addresses JSONB,       -- Array of address objects
    organizations JSONB,   -- Array of {company, title, department}
    birthday DATE,
    anniversary DATE,
    notes TEXT,
    photo_url VARCHAR(500),
    social_profiles JSONB, -- LinkedIn, Twitter, etc.
    custom_fields JSONB,
    tags TEXT[],
    last_interaction_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id, provider)
);

-- Contact interaction history
CREATE TABLE user_contact_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    contact_id INTEGER NOT NULL REFERENCES user_contacts(id),
    interaction_type VARCHAR(50) NOT NULL, -- 'email', 'call', 'meeting', 'message'
    interaction_date TIMESTAMPTZ NOT NULL,
    description TEXT,
    metadata JSONB, -- Additional context (email subject, meeting title, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Frontend Components

### 1. Calendar Interface

**File**: `/packages/frontend/src/pages/CalendarPage.tsx`

**Features**:

- Monthly, weekly, daily calendar views
- Event creation and editing modal
- Drag-and-drop event scheduling
- Multiple calendar overlay
- Meeting availability checker
- Smart scheduling suggestions from AI

### 2. Email Management Interface

**File**: `/packages/frontend/src/pages/EmailPage.tsx`

**Features**:

- Inbox with smart categorization
- AI-generated email summaries
- Compose assistance with AI suggestions
- Thread view with context
- Quick action buttons (archive, delete, snooze)
- Email search with semantic understanding

### 3. Contact Management Interface

**File**: `/packages/frontend/src/pages/ContactsPage.tsx`

**Features**:

- Contact list with search and filtering
- Contact detail view with interaction history
- Contact creation and editing
- Duplicate contact detection
- Social media integration display
- Birthday and anniversary reminders

### 4. Personal Assistant Dashboard

**File**: `/packages/frontend/src/components/PersonalAssistantPanel.tsx`

**Features**:

- Today's agenda overview
- Pending email actions
- Upcoming reminders
- Calendar conflicts notification
- Quick task creation from emails/meetings
- Context-aware suggestions

## Privacy & Security Features

### Data Access Controls

- Granular permissions for each service (Calendar, Email, Contacts)
- OAuth 2.0 integration with proper scopes
- Data retention policies with user control
- Local encryption of sensitive data
- Audit logs for all data access

### User Consent Management

- Clear opt-in for each data type
- Easy data deletion and export
- Service disconnection options
- Privacy dashboard showing data usage
- Regular permission review prompts

## AI Integration Points

### 1. Intelligent Email Management

- Email summarization and categorization
- Priority detection based on content and sender
- Auto-response suggestions
- Meeting extraction from emails
- Task creation from email content

### 2. Smart Calendar Management

- Meeting scheduling optimization
- Travel time calculation
- Calendar conflict resolution
- Meeting preparation assistance
- Follow-up reminder creation

### 3. Contact Intelligence

- Relationship mapping and insights
- Interaction frequency analysis
- Birthday and anniversary reminders
- Contact enrichment from public sources
- Social media profile matching

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- Database schema creation
- Basic service classes setup
- API route structure
- Authentication integration with existing vault

### Phase 2: Google Calendar Integration (Week 1-2)

- Google Calendar API integration
- Event CRUD operations
- Calendar synchronization
- Frontend calendar interface

### Phase 3: Email Integration (Week 2-3)

- Gmail and Outlook API integration
- Email fetching and caching
- AI summarization service
- Frontend email interface

### Phase 4: Contact Management (Week 3)

- Contact synchronization
- Deduplication logic
- Interaction tracking
- Frontend contact interface

### Phase 5: AI Assistant Features (Week 4)

- Personal Assistant Agent
- Proactive notifications
- Smart suggestions
- Context-aware recommendations

### Phase 6: Advanced Features & Polish (Week 4)

- Privacy controls implementation
- Performance optimization
- Error handling and recovery
- User experience refinements

## Success Metrics

### Technical Performance

- Calendar sync: <30 seconds for 1000 events
- Email processing: <5 seconds for inbox analysis
- Contact sync: <10 seconds for 500 contacts
- AI response time: <2 seconds for suggestions

### User Experience

- Setup completion rate: >80%
- Daily active usage: >60% of users
- Feature adoption: >40% use all three services
- User satisfaction: >4.5/5 rating

### Security & Privacy

- Zero data breaches
- 100% GDPR compliance
- <1% permission errors
- All data encrypted at rest and in transit

---

This comprehensive Personal Life OS will transform Cartrita from an AI assistant into a complete digital life management system, providing users with intelligent automation and insights across their most important productivity tools.
