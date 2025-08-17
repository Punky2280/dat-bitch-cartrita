import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime: string;
  isFeatured: boolean;
}

interface WorkflowTemplatesHubProps {
  onTemplateSelect?: (template: WorkflowTemplate) => void;
}

export const WorkflowTemplatesHub: React.FC<WorkflowTemplatesHubProps> = ({
  onTemplateSelect
}) => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading] = useState(false);

  // Mock data for now - this would typically come from an API
  useEffect(() => {
    const mockTemplates: WorkflowTemplate[] = [
      {
        id: "1",
        name: "Basic Chat Workflow",
        description: "A simple chat workflow template for getting started",
        category: "chat",
        tags: ["basic", "chat", "beginner"],
        difficulty: "beginner",
        estimatedTime: "5 minutes",
        isFeatured: true
      },
      {
        id: "2",
        name: "Data Analysis Pipeline",
        description: "Template for analyzing and processing data with AI agents",
        category: "data",
        tags: ["data", "analysis", "pipeline"],
        difficulty: "intermediate",
        estimatedTime: "15 minutes",
        isFeatured: false
      },
      {
        id: "3",
        name: "Multimodal Content Creator",
        description: "Create content using text, images, and audio processing",
        category: "content",
        tags: ["multimodal", "content", "creative"],
        difficulty: "advanced",
        estimatedTime: "20 minutes",
        isFeatured: true
      }
    ];
    setTemplates(mockTemplates);
  }, []);

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = ["all", ...Array.from(new Set(templates.map(t => t.category)))];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-300';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-300';
      case 'advanced': return 'bg-orange-500/20 text-orange-300';
      case 'expert': return 'bg-red-500/20 text-red-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl font-bold text-white">Workflow Templates Hub</h1>
        <p className="text-gray-300">
          Discover and use pre-built workflow templates to accelerate your AI agent projects
        </p>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Templates</Label>
              <Input
                id="search"
                placeholder="Search by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="min-w-[200px]">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "All Categories" : category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-400">Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-400">No templates found matching your criteria.</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <Card key={template.id} className="hover:ring-2 hover:ring-blue-500/50 transition-all">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.isFeatured && (
                    <Badge className="bg-blue-500/20 text-blue-300">Featured</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300 text-sm">{template.description}</p>
                
                <div className="flex flex-wrap gap-2">
                  {template.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Badge className={getDifficultyColor(template.difficulty)}>
                    {template.difficulty}
                  </Badge>
                  <span className="text-gray-400">{template.estimatedTime}</span>
                </div>

                <Button 
                  className="w-full mt-4"
                  onClick={() => onTemplateSelect?.(template)}
                >
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default WorkflowTemplatesHub;