'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Sparkles, 
  Copy,
  MoreHorizontal,
  Star,
  Trash2,
  Plus
} from 'lucide-react';
import { useThemeStore } from '../../store/additionalStores';

export interface MessageVariant {
  id: string;
  content: string;
  timestamp: Date;
  model?: string;
  rating?: number;
  metadata?: {
    tone?: string;
    style?: string;
    temperature?: number;
    reasoning?: string;
  };
}

interface VariantSelectorProps {
  variants: MessageVariant[];
  selectedVariantId?: string;
  onSelectVariant: (variantId: string) => void;
  onRegenerateVariant?: () => void;
  onDeleteVariant?: (variantId: string) => void;
  onRateVariant?: (variantId: string, rating: number) => void;
  onCopyVariant?: (variantId: string) => void;
  className?: string;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedVariantId,
  onSelectVariant,
  onRegenerateVariant,
  onDeleteVariant,
  onRateVariant,
  onCopyVariant,
  className = ''
}) => {
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
  const currentIndex = variants.findIndex(v => v.id === selectedVariant?.id) || 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setShowActions(null);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleVariantSelect = (variantId: string) => {
    onSelectVariant(variantId);
    setIsExpanded(false);
  };

  const handleCopyVariant = async (variantId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onCopyVariant) {
      onCopyVariant(variantId);
    } else {
      const variant = variants.find(v => v.id === variantId);
      if (variant) {
        await navigator.clipboard.writeText(variant.content);
      }
    }
  };

  const handleDeleteVariant = (variantId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDeleteVariant && variants.length > 1) {
      onDeleteVariant(variantId);
      setShowActions(null);
    }
  };

  const handleRateVariant = (variantId: string, rating: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onRateVariant) {
      onRateVariant(variantId, rating);
    }
  };

  const formatTimestamp = (timestamp: Date | undefined) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getVariantPreview = (content: string, maxLength = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  const getMetadataDisplay = (variant: MessageVariant) => {
    const parts = [];
    
    if (variant.model) {
      parts.push(variant.model);
    }
    
    if (variant.metadata?.temperature) {
      parts.push(`T${variant.metadata.temperature}`);
    }
    
    if (variant.metadata?.tone) {
      parts.push(variant.metadata.tone);
    }
    
    return parts.join(' • ');
  };

  const renderStars = (variantId: string, rating: number = 0) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={(e) => handleRateVariant(variantId, star, e)}
            className={`w-3 h-3 transition-colors ${
              star <= rating 
                ? 'text-yellow-500 fill-current' 
                : 'text-gray-300 hover:text-yellow-400'
            }`}
          >
            <Star className="w-3 h-3" />
          </button>
        ))}
      </div>
    );
  };

  if (variants.length <= 1) {
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all duration-200 ${
          isDark 
            ? 'border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-gray-200' 
            : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">
            Version {currentIndex + 1} of {variants.length}
          </span>
          {selectedVariant?.rating && selectedVariant.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span className="text-xs text-gray-500">{selectedVariant.rating}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {formatTimestamp(selectedVariant?.timestamp || new Date())}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Dropdown */}
      {isExpanded && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-lg z-50 max-h-80 overflow-y-auto ${
          isDark 
            ? 'border-gray-600 bg-gray-800' 
            : 'border-gray-200 bg-white'
        }`}>
          <div className="p-2">
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-sm font-medium">Message Versions</span>
              {onRegenerateVariant && (
                <button
                  onClick={onRegenerateVariant}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    isDark 
                      ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-400' 
                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  Generate New
                </button>
              )}
            </div>

            {/* Variant list */}
            <div className="space-y-1">
              {variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className={`group relative rounded-lg border p-3 cursor-pointer transition-all duration-200 ${
                    selectedVariant?.id === variant.id
                      ? isDark
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-blue-500 bg-blue-50'
                      : isDark
                        ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleVariantSelect(variant.id)}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Version {index + 1}</span>
                      {selectedVariant?.id === variant.id && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActions(showActions === variant.id ? null : variant.id);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                    {getVariantPreview(variant.content)}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>{formatTimestamp(variant.timestamp)}</span>
                      {getMetadataDisplay(variant) && (
                        <span>• {getMetadataDisplay(variant)}</span>
                      )}
                    </div>
                    
                    {/* Rating */}
                    {variant.rating !== undefined && (
                      <div className="flex items-center gap-1">
                        {renderStars(variant.id, variant.rating)}
                      </div>
                    )}
                  </div>

                  {/* Actions menu */}
                  {showActions === variant.id && (
                    <div className={`absolute right-2 top-8 rounded-lg shadow-lg border z-10 ${
                      isDark 
                        ? 'border-gray-600 bg-gray-800' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="py-1">
                        <button
                          onClick={(e) => handleCopyVariant(variant.id, e)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                        
                        {onRateVariant && (
                          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600">
                            <div className="text-xs text-gray-500 mb-1">Rate this version</div>
                            {renderStars(variant.id, variant.rating || 0)}
                          </div>
                        )}
                        
                        {onDeleteVariant && variants.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteVariant(variant.id, e)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors border-t border-gray-200 dark:border-gray-600"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;