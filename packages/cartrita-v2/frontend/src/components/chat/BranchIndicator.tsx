'use client';

import React, { useState } from 'react';
import { 
  GitBranch, 
  ChevronRight, 
  ChevronDown,
  MoreHorizontal,
  Merge,
  Trash2,
  Copy,
  Share2
} from 'lucide-react';
import { useThemeStore } from '../../store/additionalStores';

export interface MessageBranch {
  id: string;
  name: string;
  messageCount: number;
  lastActive: Date;
  isActive: boolean;
  parentBranchId?: string;
  childBranches: string[];
}

interface BranchIndicatorProps {
  messageId: string;
  branchId?: string;
  branches?: MessageBranch[];
  onSwitchBranch?: (branchId: string) => void;
  onCreateBranch?: (fromMessageId: string) => void;
  onMergeBranch?: (branchId: string, targetBranchId: string) => void;
  onDeleteBranch?: (branchId: string) => void;
  onRenameBranch?: (branchId: string, newName: string) => void;
  onShareBranch?: (branchId: string) => void;
  compact?: boolean;
  className?: string;
}

const BranchIndicator: React.FC<BranchIndicatorProps> = ({
  messageId,
  branchId,
  branches = [],
  onSwitchBranch,
  onCreateBranch,
  onMergeBranch,
  onDeleteBranch,
  onRenameBranch,
  onShareBranch,
  compact = false,
  className = ''
}) => {
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');

  const currentBranch = branches.find(b => b.id === branchId) || branches.find(b => b.isActive);
  const otherBranches = branches.filter(b => b.id !== currentBranch?.id);

  const handleSwitchBranch = (targetBranchId: string) => {
    if (onSwitchBranch) {
      onSwitchBranch(targetBranchId);
      setIsExpanded(false);
    }
  };

  const handleCreateBranch = () => {
    if (onCreateBranch) {
      onCreateBranch(messageId);
    }
  };

  const handleMergeBranch = (sourceBranchId: string, targetBranchId: string) => {
    if (onMergeBranch) {
      onMergeBranch(sourceBranchId, targetBranchId);
      setShowActions(null);
    }
  };

  const handleDeleteBranch = (deleteBranchId: string) => {
    if (onDeleteBranch && deleteBranchId !== currentBranch?.id) {
      onDeleteBranch(deleteBranchId);
      setShowActions(null);
    }
  };

  const handleRenameBranch = (renameBranchId: string, name: string) => {
    if (onRenameBranch && name.trim()) {
      onRenameBranch(renameBranchId, name.trim());
      setRenamingBranch(null);
      setNewBranchName('');
    }
  };

  const handleShareBranch = (shareBranchId: string) => {
    if (onShareBranch) {
      onShareBranch(shareBranchId);
      setShowActions(null);
    }
  };

  const formatLastActive = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return timestamp.toLocaleDateString();
  };

  const getBranchColor = (branch: MessageBranch) => {
    if (branch.isActive) {
      return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
    }
    return 'text-gray-500 bg-gray-100 dark:bg-gray-700';
  };

  // Don't render if no branches or branching functionality
  if (!branches.length && !onCreateBranch) {
    return null;
  }

  // Compact view - just show indicator
  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="w-1 h-4 bg-blue-400 rounded-l"></div>
        {currentBranch && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {currentBranch.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Branch indicator line */}
      <div className="absolute -left-4 top-0 w-1 h-full bg-blue-400 rounded-l"></div>

      {/* Branch selector */}
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg transition-all duration-200 ${
        isDark 
          ? 'bg-gray-800/50 hover:bg-gray-800 border border-gray-600' 
          : 'bg-gray-100 hover:bg-gray-200 border border-gray-200'
      }`}>
        <GitBranch className="w-4 h-4 text-blue-500" />
        
        {currentBranch ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm font-medium"
          >
            <span>{currentBranch.name}</span>
            <span className="text-xs text-gray-500">
              ({currentBranch.messageCount})
            </span>
            {otherBranches.length > 0 && (
              isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )
            )}
          </button>
        ) : (
          <span className="text-sm text-gray-500">No branch</span>
        )}

        {onCreateBranch && (
          <button
            onClick={handleCreateBranch}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Create new branch from this message"
          >
            <GitBranch className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Branch dropdown */}
      {isExpanded && otherBranches.length > 0 && (
        <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg border shadow-lg z-50 ${
          isDark 
            ? 'border-gray-600 bg-gray-800' 
            : 'border-gray-200 bg-white'
        }`}>
          <div className="p-3">
            <div className="text-sm font-medium mb-2">Switch Branch</div>
            
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {otherBranches.map(branch => (
                <div
                  key={branch.id}
                  className="group relative"
                >
                  <div
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                      isDark 
                        ? 'hover:bg-gray-700' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => handleSwitchBranch(branch.id)}
                  >
                    <div className="flex-1">
                      {renamingBranch === branch.id ? (
                        <input
                          type="text"
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          onBlur={() => handleRenameBranch(branch.id, newBranchName)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameBranch(branch.id, newBranchName);
                            }
                            if (e.key === 'Escape') {
                              setRenamingBranch(null);
                              setNewBranchName('');
                            }
                          }}
                          className="w-full px-1 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{branch.name}</span>
                            <div className={`w-2 h-2 rounded-full ${getBranchColor(branch)}`}></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {branch.messageCount} messages • {formatLastActive(branch.lastActive)}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActions(showActions === branch.id ? null : branch.id);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Actions menu */}
                  {showActions === branch.id && (
                    <div className={`absolute right-0 top-0 w-40 rounded-lg border shadow-lg z-10 ${
                      isDark 
                        ? 'border-gray-600 bg-gray-800' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setRenamingBranch(branch.id);
                            setNewBranchName(branch.name);
                            setShowActions(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Rename
                        </button>

                        {onMergeBranch && currentBranch && (
                          <button
                            onClick={() => handleMergeBranch(branch.id, currentBranch.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Merge className="w-3 h-3" />
                            Merge Here
                          </button>
                        )}

                        {onShareBranch && (
                          <button
                            onClick={() => handleShareBranch(branch.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Share2 className="w-3 h-3" />
                            Share
                          </button>
                        )}

                        {onDeleteBranch && branch.id !== currentBranch?.id && (
                          <button
                            onClick={() => handleDeleteBranch(branch.id)}
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

export default BranchIndicator;