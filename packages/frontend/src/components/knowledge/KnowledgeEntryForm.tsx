/**
 * Knowledge Entry Form - Create and edit knowledge entries
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { X, Plus, Save, ArrowLeft } from 'lucide-react';
// import { toast } from 'sonner';

interface KnowledgeEntry {
  id?: number;
  title: string;
  content: string;
  content_type: string;
  category: string;
  subcategory?: string;
  tags: string[];
  importance_score: number;
  source_type: string;
  source_url?: string;
}

interface KnowledgeEntryFormProps {
  entry?: KnowledgeEntry;
  onSave: (entry: KnowledgeEntry) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const CONTENT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'code', label: 'Code' },
  { value: 'url', label: 'URL/Link' },
  { value: 'file', label: 'File Reference' }
];

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'ai', label: 'Artificial Intelligence' },
  { value: 'database', label: 'Database' },
  { value: 'frontend', label: 'Frontend Development' },
  { value: 'backend', label: 'Backend Development' },
  { value: 'security', label: 'Security' },
  { value: 'devops', label: 'DevOps' },
  { value: 'design', label: 'Design' },
  { value: 'business', label: 'Business' },
  { value: 'research', label: 'Research' }
];

const SOURCE_TYPES = [
  { value: 'user_created', label: 'User Created' },
  { value: 'imported', label: 'Imported' },
  { value: 'ai_generated', label: 'AI Generated' },
  { value: 'web_scraped', label: 'Web Scraped' }
];

const KnowledgeEntryForm: React.FC<KnowledgeEntryFormProps> = ({
  entry,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<KnowledgeEntry>({
    title: '',
    content: '',
    content_type: 'text',
    category: 'general',
    subcategory: '',
    tags: [],
    importance_score: 0.5,
    source_type: 'user_created',
    source_url: ''
  });

  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with entry data if editing
  useEffect(() => {
    if (entry) {
      setFormData(entry);
    }
  }, [entry]);

  // Handle form field changes
  const handleChange = (field: keyof KnowledgeEntry, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Add tag
  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setNewTag('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 500) {
      newErrors.title = 'Title must be less than 500 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formData.source_url && !isValidUrl(formData.source_url)) {
      newErrors.source_url = 'Invalid URL format';
    }

    if (formData.importance_score < 0 || formData.importance_score > 1) {
      newErrors.importance_score = 'Importance score must be between 0 and 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // URL validation helper
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
  console.error('Please fix the form errors');
      return;
    }

    try {
      await onSave(formData);
  console.log(entry ? 'Entry updated successfully' : 'Entry created successfully');
    } catch (error) {
      console.error('Failed to save entry:', error);
  console.error('Failed to save entry');
    }
  };

  // Auto-suggest tags based on content
  const suggestTags = () => {
    const content = formData.content.toLowerCase();
    const suggestions: string[] = [];
    
    // Simple keyword-based suggestions
    const keywords = {
      'react': ['react', 'javascript', 'frontend'],
      'database': ['database', 'sql', 'data'],
      'api': ['api', 'backend', 'rest'],
      'security': ['security', 'auth', 'encryption'],
      'ai': ['ai', 'machine-learning', 'artificial-intelligence'],
      'docker': ['docker', 'containers', 'devops'],
      'typescript': ['typescript', 'javascript', 'types']
    };

    Object.entries(keywords).forEach(([keyword, tags]) => {
      if (content.includes(keyword)) {
        tags.forEach(tag => {
          if (!formData.tags.includes(tag) && !suggestions.includes(tag)) {
            suggestions.push(tag);
          }
        });
      }
    });

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  };

  const tagSuggestions = suggestTags();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {entry ? 'Edit Knowledge Entry' : 'Create New Knowledge Entry'}
            </CardTitle>
            <Button variant="outline" onClick={onCancel}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter a descriptive title for your knowledge entry"
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Content *</label>
              <Textarea
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
                placeholder="Enter the main content of your knowledge entry..."
                rows={8}
                className={errors.content ? 'border-red-500' : ''}
              />
              {errors.content && (
                <p className="text-sm text-red-500">{errors.content}</p>
              )}
              <p className="text-sm text-gray-500">
                {formData.content.length} characters
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Content Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <select
                  value={formData.content_type}
                  onChange={(e) => handleChange('content_type', e.target.value)}
                  className="w-full p-2 border rounded-md bg-white dark:bg-gray-800"
                >
                  {CONTENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full p-2 border rounded-md bg-white dark:bg-gray-800"
                >
                  {CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subcategory (Optional)</label>
                <Input
                  value={formData.subcategory || ''}
                  onChange={(e) => handleChange('subcategory', e.target.value)}
                  placeholder="Optional subcategory"
                />
              </div>

              {/* Source Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Type</label>
                <select
                  value={formData.source_type}
                  onChange={(e) => handleChange('source_type', e.target.value)}
                  className="w-full p-2 border rounded-md bg-white dark:bg-gray-800"
                >
                  {SOURCE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source URL */}
            {(formData.content_type === 'url' || formData.source_type === 'web_scraped') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Source URL</label>
                <Input
                  type="url"
                  value={formData.source_url || ''}
                  onChange={(e) => handleChange('source_url', e.target.value)}
                  placeholder="https://example.com"
                  className={errors.source_url ? 'border-red-500' : ''}
                />
                {errors.source_url && (
                  <p className="text-sm text-red-500">{errors.source_url}</p>
                )}
              </div>
            )}

            {/* Importance Score */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Importance Score: {(formData.importance_score * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.importance_score}
                onChange={(e) => handleChange('importance_score', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Tags</label>
              
              {/* Current Tags */}
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Add New Tag */}
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1"
                />
                <Button type="button" onClick={addTag} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Tag Suggestions */}
              {tagSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Suggested tags:</p>
                  <div className="flex flex-wrap gap-2">
                    {tagSuggestions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (!formData.tags.includes(tag)) {
                            handleChange('tags', [...formData.tags, tag]);
                          }
                        }}
                        className="px-2 py-1 text-sm border border-dashed border-gray-300 rounded hover:border-blue-500 hover:text-blue-500"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : entry ? 'Update Entry' : 'Create Entry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeEntryForm;