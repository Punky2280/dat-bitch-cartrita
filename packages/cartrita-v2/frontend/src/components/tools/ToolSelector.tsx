'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tool,
  Image,
  FileText,
  Code,
  Calculator,
  Globe,
  Search,
  MessageSquare,
  Mic,
  Video,
  Camera,
  Database,
  Zap,
  Brain,
  Palette,
  Music,
  Map,
  Calendar,
  Mail,
  ShoppingCart,
  Weather,
  TrendingUp,
  Gamepad2,
  Check,
  X
} from 'lucide-react';
import useAppStore from '@/store';
import { cn } from '@/lib/utils';

interface ToolSelectorProps {
  onToolSelect: (toolId: string) => void;
  selectedTools: string[];
  className?: string;
}

const ToolSelector: React.FC<ToolSelectorProps> = ({
  onToolSelect,
  selectedTools,
  className
}) => {
  const { tools, isToolsLoading } = useAppStore();
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<string>('all');

  const getToolIcon = (toolType: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      vision: Image,
      document: FileText,
      code: Code,
      calculator: Calculator,
      web: Globe,
      search: Search,
      chat: MessageSquare,
      audio: Mic,
      video: Video,
      camera: Camera,
      database: Database,
      automation: Zap,
      ai: Brain,
      design: Palette,
      music: Music,
      maps: Map,
      calendar: Calendar,
      email: Mail,
      ecommerce: ShoppingCart,
      weather: Weather,
      analytics: TrendingUp,
      games: Gamepad2
    };
    
    const IconComponent = iconMap[toolType] || Tool;
    return <IconComponent className="w-5 h-5" />;
  };

  const categories = [
    { id: 'all', label: 'All Tools' },
    { id: 'ai', label: 'AI & ML' },
    { id: 'media', label: 'Media' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'development', label: 'Development' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'integration', label: 'Integration' }
  ];

  const filteredTools = tools.filter(tool => {
    const matchesFilter = tool.name.toLowerCase().includes(filter.toLowerCase()) ||
                         tool.description.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = category === 'all' || tool.category === category;
    return matchesFilter && matchesCategory;
  });

  const isToolSelected = (toolId: string) => selectedTools.includes(toolId);

  return (
    <div className={cn("bg-background border rounded-lg p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Select Tools</h3>
        <div className="text-sm text-muted-foreground">
          {selectedTools.length} selected
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search tools..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className={cn(
              "px-3 py-1 rounded-full text-sm transition-colors",
              category === id
                ? "bg-primary text-primary-foreground"
                : "bg-accent hover:bg-accent/80"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {isToolsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tools found matching your criteria
          </div>
        ) : (
          <AnimatePresence>
            {filteredTools.map((tool) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all",
                  isToolSelected(tool.id)
                    ? "border-primary bg-primary/10"
                    : "border-input hover:border-primary/50 hover:bg-accent/50"
                )}
                onClick={() => onToolSelect(tool.id)}
              >
                <div className="flex-shrink-0">
                  {getToolIcon(tool.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium truncate">{tool.name}</p>
                    {tool.enabled === false && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tool.description}
                  </p>
                  
                  {/* Tool metadata */}
                  <div className="flex items-center space-x-3 mt-1 text-xs text-muted-foreground">
                    {tool.version && (
                      <span>v{tool.version}</span>
                    )}
                    {tool.category && (
                      <span className="capitalize">{tool.category}</span>
                    )}
                    {tool.requiresAuth && (
                      <span className="flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Auth Required</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {isToolSelected(tool.id) ? (
                    <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 border-2 border-input rounded-full" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Selected Tools Summary */}
      {selectedTools.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            {selectedTools.map(toolId => {
              const tool = tools.find(t => t.id === toolId);
              if (!tool) return null;

              return (
                <div
                  key={toolId}
                  className="flex items-center space-x-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {getToolIcon(tool.type)}
                  <span>{tool.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolSelect(toolId);
                    }}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolSelector;