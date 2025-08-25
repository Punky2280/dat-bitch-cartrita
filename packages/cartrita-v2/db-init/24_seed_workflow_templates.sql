-- Sample Workflow Templates for Testing
-- Templates are stored as workflows with is_template = true

-- 1. Productivity: Daily Task Automation
INSERT INTO workflows (
  name, description, user_id, workflow_data, 
  is_active, is_template, template_version, template_metadata,
  category_id
) VALUES (
  'Daily Task Automation',
  'Automatically organize and prioritize your daily tasks based on deadlines and importance',
  1,
  '{"nodes": [{"id": "start", "type": "trigger", "data": {"triggerType": "schedule", "schedule": "0 8 * * *"}}, {"id": "fetch_tasks", "type": "action", "data": {"action": "fetch_tasks", "source": "{{task_source}}"}}, {"id": "prioritize", "type": "ai", "data": {"model": "gpt-4", "prompt": "Prioritize these tasks by urgency and importance: {{tasks}}", "temperature": 0.3}}, {"id": "notify", "type": "notification", "data": {"channel": "{{notification_channel}}", "message": "Your daily tasks are ready!"}}], "edges": [{"source": "start", "target": "fetch_tasks"}, {"source": "fetch_tasks", "target": "prioritize"}, {"source": "prioritize", "target": "notify"}]}',
  true,
  true,
  1,
  '{"tags": ["productivity", "automation", "scheduling"], "difficulty_level": "beginner", "estimated_time_minutes": 15, "is_public": true, "is_featured": true, "price_usd": 0.00}',
  (SELECT id FROM workflow_template_categories WHERE name = 'productivity')
);

INSERT INTO workflow_template_variables (workflow_id, var_name, description, required, default_value, var_type) VALUES
((SELECT id FROM workflows WHERE name = 'Daily Task Automation' AND is_template = true), 'task_source', 'Where to fetch tasks from (calendar, todo app, etc.)', true, 'calendar', 'string'),
((SELECT id FROM workflows WHERE name = 'Daily Task Automation' AND is_template = true), 'notification_channel', 'How to receive notifications', true, 'email', 'string');

-- 2. Communication: Email Response Assistant
INSERT INTO workflows (
  name, description, user_id, workflow_data,
  is_active, is_template, template_version, template_metadata,
  category_id
) VALUES (
  'AI Email Response Assistant',
  'Automatically draft professional email responses based on the context and your preferred tone',
  1,
  '{"nodes": [{"id": "email_trigger", "type": "trigger", "data": {"triggerType": "email_received", "filter": "{{email_filter}}"}}, {"id": "analyze_content", "type": "ai", "data": {"model": "gpt-4", "prompt": "Analyze this email and suggest response type: {{email_content}}", "temperature": 0.2}}, {"id": "draft_response", "type": "ai", "data": {"model": "gpt-4", "prompt": "Draft a {{tone}} response to: {{email_content}}. Keep it {{length}} and {{formality}}", "temperature": 0.4}}, {"id": "review_queue", "type": "human_review", "data": {"timeout": 3600, "fallback": "send_draft"}}], "edges": [{"source": "email_trigger", "target": "analyze_content"}, {"source": "analyze_content", "target": "draft_response"}, {"source": "draft_response", "target": "review_queue"}]}',
  true,
  true,
  1,
  '{"tags": ["communication", "ai", "email"], "difficulty_level": "intermediate", "estimated_time_minutes": 30, "is_public": true, "is_featured": true, "price_usd": 0.00}',
  (SELECT id FROM workflow_template_categories WHERE name = 'communication')
);

INSERT INTO workflow_template_variables (workflow_id, var_name, description, required, default_value, var_type) VALUES
((SELECT id FROM workflows WHERE name = 'AI Email Response Assistant' AND is_template = true), 'email_filter', 'Filter emails to process', false, 'all', 'string'),
((SELECT id FROM workflows WHERE name = 'AI Email Response Assistant' AND is_template = true), 'tone', 'Response tone', true, 'professional', 'string'),
((SELECT id FROM workflows WHERE name = 'AI Email Response Assistant' AND is_template = true), 'length', 'Response length', true, 'concise', 'string'),
((SELECT id FROM workflows WHERE name = 'AI Email Response Assistant' AND is_template = true), 'formality', 'Formality level', true, 'formal', 'string');

-- 3. Knowledge: Research Paper Summarizer
INSERT INTO workflows (
  name, description, user_id, workflow_data,
  is_active, is_template, template_version, template_metadata,
  category_id
) VALUES (
  'Research Paper Summarizer',
  'Automatically summarize research papers and extract key insights with citation tracking',
  1,
  '{"nodes": [{"id": "paper_input", "type": "input", "data": {"inputType": "file", "acceptedTypes": ["pdf", "txt"]}}, {"id": "extract_text", "type": "processor", "data": {"processor": "pdf_to_text"}}, {"id": "identify_sections", "type": "ai", "data": {"model": "gpt-4", "prompt": "Identify and extract key sections: abstract, methodology, results, conclusions from: {{paper_text}}", "temperature": 0.1}}, {"id": "summarize", "type": "ai", "data": {"model": "gpt-4", "prompt": "Create a {{summary_length}} summary focusing on {{focus_area}}: {{sections}}", "temperature": 0.3}}, {"id": "save_summary", "type": "storage", "data": {"destination": "{{storage_location}}", "format": "markdown"}}], "edges": [{"source": "paper_input", "target": "extract_text"}, {"source": "extract_text", "target": "identify_sections"}, {"source": "identify_sections", "target": "summarize"}, {"source": "summarize", "target": "save_summary"}]}',
  true,
  true,
  1,
  '{"tags": ["knowledge", "research", "ai", "summarization"], "difficulty_level": "intermediate", "estimated_time_minutes": 20, "is_public": true, "is_featured": false, "price_usd": 0.00}',
  (SELECT id FROM workflow_template_categories WHERE name = 'knowledge')
);

INSERT INTO workflow_template_variables (workflow_id, var_name, description, required, default_value, var_type) VALUES
((SELECT id FROM workflows WHERE name = 'Research Paper Summarizer' AND is_template = true), 'summary_length', 'Length of the summary', true, 'detailed', 'string'),
((SELECT id FROM workflows WHERE name = 'Research Paper Summarizer' AND is_template = true), 'focus_area', 'What to focus on in summary', true, 'methodology', 'string'),
((SELECT id FROM workflows WHERE name = 'Research Paper Summarizer' AND is_template = true), 'storage_location', 'Where to save summaries', true, 'knowledge_base', 'string');

-- 4. Personal: Habit Tracker & Motivator
INSERT INTO workflows (
  name, description, user_id, workflow_data,
  is_active, is_template, template_version, template_metadata,
  category_id
) VALUES (
  'Habit Tracker & Motivator',
  'Track personal habits and receive personalized motivation and progress insights',
  1,
  '{"nodes": [{"id": "daily_checkin", "type": "trigger", "data": {"triggerType": "schedule", "schedule": "0 20 * * *"}}, {"id": "collect_habits", "type": "input", "data": {"inputType": "form", "habits": "{{habit_list}}"}}, {"id": "analyze_progress", "type": "processor", "data": {"processor": "habit_analyzer", "period": "{{analysis_period}}"}}, {"id": "generate_motivation", "type": "ai", "data": {"model": "gpt-4", "prompt": "Based on this habit progress {{progress_data}}, create a {{motivation_style}} motivational message", "temperature": 0.6}}, {"id": "send_motivation", "type": "notification", "data": {"channel": "{{notification_method}}", "timing": "{{reminder_time}}"}}], "edges": [{"source": "daily_checkin", "target": "collect_habits"}, {"source": "collect_habits", "target": "analyze_progress"}, {"source": "analyze_progress", "target": "generate_motivation"}, {"source": "generate_motivation", "target": "send_motivation"}]}',
  true,
  true,
  1,
  '{"tags": ["personal", "habits", "motivation", "tracking"], "difficulty_level": "beginner", "estimated_time_minutes": 10, "is_public": true, "is_featured": true, "price_usd": 0.00}',
  (SELECT id FROM workflow_template_categories WHERE name = 'personal')
);

INSERT INTO workflow_template_variables (workflow_id, var_name, description, required, default_value, var_type) VALUES
((SELECT id FROM workflows WHERE name = 'Habit Tracker & Motivator' AND is_template = true), 'habit_list', 'List of habits to track', true, 'exercise,reading,meditation', 'string'),
((SELECT id FROM workflows WHERE name = 'Habit Tracker & Motivator' AND is_template = true), 'analysis_period', 'How long to analyze progress', true, 'weekly', 'string'),
((SELECT id FROM workflows WHERE name = 'Habit Tracker & Motivator' AND is_template = true), 'motivation_style', 'Style of motivation', true, 'encouraging', 'string'),
((SELECT id FROM workflows WHERE name = 'Habit Tracker & Motivator' AND is_template = true), 'notification_method', 'How to receive reminders', true, 'push', 'string'),
((SELECT id FROM workflows WHERE name = 'Habit Tracker & Motivator' AND is_template = true), 'reminder_time', 'When to send reminders', true, '08:00', 'string');