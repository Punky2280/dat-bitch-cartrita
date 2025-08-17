import React, { useState, useEffect, useCallback } from 'react';

interface WorkflowTemplatesHubProps {
  token?: string;
  onBack?: () => void;
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Star, Filter, Search, Play, Settings, Users, Eye, Heart } from 'lucide-react';

interface TemplateCategory {
  id: number;
  name: string;
  description: string;
  icon?: string;
  sort_order: number;
}

interface TemplateVariable {
  var_name: string;
  description: string;
  required: boolean;
  default_value?: string;
  var_type: 'string' | 'number' | 'boolean' | 'secret_ref';
  validation_pattern?: string;
}

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  user_id: number;
  is_active: boolean;
  template_version: number;
  template_metadata: any;
  category_id?: number;
  category_name?: string;
  category_description?: string;
  category_icon?: string;
  usage_count: string;
  avg_rating?: string;
  rating_count: string;
  variables: TemplateVariable[];
  user_rating?: {
    rating: number;
    review: string;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
}

const getIconForCategory = (categoryName: string) => {
  const icons = {
    productivity: '📈',
    communication: '💬',
    knowledge: '🧠',
    automation: '🤖',
    analytics: '📊',
    personal: '👤',
  };
  return icons[categoryName as keyof typeof icons] || '📝';
};

const StarRating: React.FC<{
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ rating, onRate, readonly = false, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-300'
          } ${!readonly ? 'cursor-pointer hover:text-yellow-400' : ''}`}
          onClick={() => !readonly && onRate?.(star)}
        />
      ))}
      {rating > 0 && (
        <span className="ml-1 text-sm text-gray-600">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

const TemplateVariableForm: React.FC<{
  variables: TemplateVariable[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}> = ({ variables, values, onChange }) => {
  const handleChange = (varName: string, value: any) => {
    onChange({
      ...values,
      [varName]: value,
    });
  };

  return (
    <div className="space-y-4">
      {variables.map((variable) => (
        <div key={variable.var_name} className="space-y-2">
          <Label htmlFor={variable.var_name} className="flex items-center gap-2">
            {variable.var_name}
            {variable.required && <span className="text-red-500">*</span>}
            {variable.description && (
              <span className="text-sm text-gray-500">- {variable.description}</span>
            )}
          </Label>
          
          {variable.var_type === 'boolean' ? (
            <Select
              value={values[variable.var_name]?.toString() || variable.default_value || 'false'}
              onValueChange={(value) => handleChange(variable.var_name, value === 'true')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          ) : variable.var_type === 'number' ? (
            <Input
              id={variable.var_name}
              type="number"
              value={values[variable.var_name] || variable.default_value || ''}
              onChange={(e) => handleChange(variable.var_name, parseFloat(e.target.value) || 0)}
              placeholder={variable.default_value}
            />
          ) : variable.var_type === 'secret_ref' ? (
            <Input
              id={variable.var_name}
              type="password"
              value={values[variable.var_name] || ''}
              onChange={(e) => handleChange(variable.var_name, e.target.value)}
              placeholder="Enter secret reference"
            />
          ) : (
            <Input
              id={variable.var_name}
              type="text"
              value={values[variable.var_name] || variable.default_value || ''}
              onChange={(e) => handleChange(variable.var_name, e.target.value)}
              placeholder={variable.default_value || `Enter ${variable.var_name}`}
            />
          )}
          
          {variable.validation_pattern && (
            <p className="text-xs text-gray-500">
              Pattern: {variable.validation_pattern}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

const InstantiateTemplateDialog: React.FC<{
  template: WorkflowTemplate;
  onInstantiate: (templateId: number, variables: Record<string, any>) => void;
  isOpen: boolean;
  onClose: () => void;
}> = ({ template, onInstantiate, isOpen, onClose }) => {
  const [variables, setVariables] = useState<Record<string, any>>({
    __workflow_name: `${template.name} - ${new Date().toLocaleDateString()}`,
    __workflow_description: `Created from template: ${template.name}`,
  });
  const [isInstantiating, setIsInstantiating] = useState(false);

  const handleInstantiate = async () => {
    // Validate required fields
    const missing = template.variables
      .filter(v => v.required && !variables[v.var_name])
      .map(v => v.var_name);

    if (missing.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill in: ${missing.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsInstantiating(true);
    try {
      await onInstantiate(template.id, variables);
      onClose();
      setVariables({
        __workflow_name: `${template.name} - ${new Date().toLocaleDateString()}`,
        __workflow_description: `Created from template: ${template.name}`,
      });
    } finally {
      setIsInstantiating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Instantiate Template: {template.name}
          </DialogTitle>
          <DialogDescription>
            Configure the template variables to create a new workflow instance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow_name">Workflow Name *</Label>
              <Input
                id="workflow_name"
                value={variables.__workflow_name || ''}
                onChange={(e) => setVariables({ ...variables, __workflow_name: e.target.value })}
                placeholder="Enter workflow name"
              />
            </div>
            
            <div>
              <Label htmlFor="workflow_description">Description</Label>
              <Textarea
                id="workflow_description"
                value={variables.__workflow_description || ''}
                onChange={(e) => setVariables({ ...variables, __workflow_description: e.target.value })}
                placeholder="Enter workflow description"
                rows={3}
              />
            </div>
          </div>

          {template.variables.length > 0 && (
            <div>
              <h4 className="font-medium mb-4">Template Variables</h4>
              <TemplateVariableForm
                variables={template.variables}
                values={variables}
                onChange={setVariables}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInstantiate} disabled={isInstantiating}>
            {isInstantiating ? 'Creating...' : 'Create Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RateTemplateDialog: React.FC<{
  template: WorkflowTemplate;
  onRate: (templateId: number, rating: number, review: string) => void;
  isOpen: boolean;
  onClose: () => void;
}> = ({ template, onRate, isOpen, onClose }) => {
  const [rating, setRating] = useState(template.user_rating?.rating || 0);
  const [review, setReview] = useState(template.user_rating?.review || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a rating before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onRate(template.id, rating, review);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Rate Template
          </DialogTitle>
          <DialogDescription>
            Share your experience with "{template.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Your Rating</Label>
            <div className="mt-2">
              <StarRating rating={rating} onRate={setRating} size="lg" />
            </div>
          </div>

          <div>
            <Label htmlFor="review">Review (Optional)</Label>
            <Textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your thoughts about this template..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const WorkflowTemplatesHub: React.FC<WorkflowTemplatesHubProps> = ({ token, onBack }) => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'rating'>('popular');
  
  // Dialog states
  const [instantiateDialog, setInstantiateDialog] = useState<WorkflowTemplate | null>(null);
  const [rateDialog, setRateDialog] = useState<WorkflowTemplate | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8001/api/workflow-templates/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        include_variables: 'true',
        limit: '50',
      });
      
      if (selectedCategory) {
        params.append('category_id', selectedCategory.toString());
      }

      const response = await fetch(`http://localhost:8001/api/workflow-templates/public?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast({
        title: 'Failed to load templates',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  const handleInstantiateTemplate = async (templateId: number, variables: Record<string, any>) => {
    try {
      const response = await fetch(`/api/workflow-templates/${templateId}/instantiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ variables }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Template Instantiated',
          description: `Created workflow with ID: ${data.data.workflowId}`,
        });
        // Refresh templates to update usage counts
        fetchTemplates();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to instantiate template:', error);
      toast({
        title: 'Failed to create workflow',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRateTemplate = async (templateId: number, rating: number, review: string) => {
    try {
      const response = await fetch(`/api/workflow-templates/${templateId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating, review }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Rating Submitted',
          description: 'Thank you for your feedback!',
        });
        // Refresh templates to show updated rating
        fetchTemplates();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to rate template:', error);
      toast({
        title: 'Failed to submit rating',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, [fetchCategories, fetchTemplates]);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      case 'rating':
        return (parseFloat(b.avg_rating || '0') - parseFloat(a.avg_rating || '0'));
      case 'popular':
      default:
        return parseInt(b.usage_count) - parseInt(a.usage_count);
    }
  });

  if (loading && templates.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-4">
            ← Back to Workflows
          </Button>
          <h1 className="text-3xl font-bold">Workflow Templates</h1>
          <p className="text-gray-600 mt-2">
            Discover and use pre-built workflow templates to accelerate your productivity
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select
          value={selectedCategory?.toString() || 'all'}
          onValueChange={(value) => setSelectedCategory(value === 'all' ? null : parseInt(value))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {getIconForCategory(category.name)} {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="rating">Highest Rated</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {getIconForCategory(template.category_name || '')}
                  </span>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant="outline" className="mt-1">
                      {template.category_name || 'Uncategorized'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <CardDescription className="mt-2 line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {template.usage_count} uses
                  </span>
                  
                  {template.avg_rating && parseFloat(template.avg_rating) > 0 && (
                    <div className="flex items-center gap-1">
                      <StarRating 
                        rating={parseFloat(template.avg_rating)} 
                        readonly 
                        size="sm" 
                      />
                      <span>({template.rating_count})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Variables count */}
              {template.variables.length > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Settings className="w-4 h-4" />
                  {template.variables.length} configurable variables
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  onClick={() => setInstantiateDialog(template)}
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Use Template
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setRateDialog(template)}
                >
                  <Heart className={`w-4 h-4 ${template.user_rating ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600">
            Try adjusting your search criteria or browse different categories.
          </p>
        </div>
      )}

      {/* Dialogs */}
      {instantiateDialog && (
        <InstantiateTemplateDialog
          template={instantiateDialog}
          onInstantiate={handleInstantiateTemplate}
          isOpen={!!instantiateDialog}
          onClose={() => setInstantiateDialog(null)}
        />
      )}

      {rateDialog && (
        <RateTemplateDialog
          template={rateDialog}
          onRate={handleRateTemplate}
          isOpen={!!rateDialog}
          onClose={() => setRateDialog(null)}
        />
      )}
    </div>
  );
};