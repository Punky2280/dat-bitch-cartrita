import React, { useState, useEffect } from 'react';

interface ValidationStatus {
  id: number;
  keyName: string;
  providerName: string;
  providerIcon: string;
  status: 'valid' | 'invalid' | 'expired' | 'checking' | 'never_tested';
  lastValidated?: string;
  lastValidationMessage?: string;
  responseTimeMs?: number;
  rateLimitRemaining?: number;
  rateLimitResetAt?: string;
  usageQuota?: {
    used: number;
    limit: number;
    period: string;
  };
  nextValidation?: string;
  validationHistory?: {
    timestamp: string;
    status: string;
    message: string;
    responseTime: number;
  }[];
}

interface ValidationDashboardProps {
  token: string;
  className?: string;
}

const STATUS_COLORS = {
  valid: {
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-500',
    icon: '✅'
  },
  invalid: {
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-500',
    icon: '❌'
  },
  expired: {
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-500',
    icon: '⏰'
  },
  checking: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-500',
    icon: '🔄'
  },
  never_tested: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-500',
    icon: '❓'
  }
};

export const ValidationDashboard: React.FC<ValidationDashboardProps> = ({
  token,
  className = ''
}) => {
  const [validations, setValidations] = useState<ValidationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingIds, setValidatingIds] = useState<Set<number>>(new Set());
  const [selectedValidation, setSelectedValidation] = useState<ValidationStatus | null>(null);

  // Load validation statuses
  const loadValidations = async () => {
    try {
      const response = await fetch('/api/vault/validation-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setValidations(data.validations);
        }
      }
    } catch (error) {
      console.error('Failed to load validation statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validate specific credential
  const validateCredential = async (id: number) => {
    setValidatingIds(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch(`/api/vault/credentials/${id}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update the specific validation in state
        setValidations(prev => prev.map(v => 
          v.id === id 
            ? {
                ...v,
                status: data.result.status,
                lastValidated: new Date().toISOString(),
                lastValidationMessage: data.result.message,
                responseTimeMs: data.result.responseTime,
                rateLimitRemaining: data.result.rateLimitRemaining,
                rateLimitResetAt: data.result.rateLimitResetAt
              }
            : v
        ));
      }
    } catch (error) {
      console.error(`Failed to validate credential ${id}:`, error);
    } finally {
      setValidatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Validate all credentials
  const validateAllCredentials = async () => {
    const ids = validations.map(v => v.id);
    setValidatingIds(new Set(ids));
    
    try {
      const response = await fetch('/api/vault/validate-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        // Reload all validation statuses after batch validation
        await loadValidations();
      }
    } catch (error) {
      console.error('Failed to validate all credentials:', error);
    } finally {
      setValidatingIds(new Set());
    }
  };

  useEffect(() => {
    loadValidations();
  }, [token]);

  // Get summary statistics
  const stats = React.useMemo(() => {
    const total = validations.length;
    const valid = validations.filter(v => v.status === 'valid').length;
    const invalid = validations.filter(v => v.status === 'invalid').length;
    const expired = validations.filter(v => v.status === 'expired').length;
    const neverTested = validations.filter(v => v.status === 'never_tested').length;
    
    return { total, valid, invalid, expired, neverTested };
  }, [validations]);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Credential Validation Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Monitor API credential health and validation status
            </p>
          </div>
          <button
            onClick={validateAllCredentials}
            disabled={validatingIds.size > 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            {validatingIds.size > 0 ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Validating...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Validate All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Valid</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Invalid</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.expired}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Expired</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.neverTested}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Untested</div>
          </div>
        </div>
      </div>

      {/* Validation List */}
      <div className="p-6">
        <div className="space-y-4">
          {validations.map((validation) => {
            const statusConfig = STATUS_COLORS[validation.status];
            const isValidating = validatingIds.has(validation.id);
            
            return (
              <div
                key={validation.id}
                className={`p-4 border rounded-lg transition-all hover:shadow-md cursor-pointer ${
                  selectedValidation?.id === validation.id
                    ? `${statusConfig.border} ${statusConfig.bg}`
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setSelectedValidation(validation)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">{validation.providerIcon}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {validation.keyName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {validation.providerName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${statusConfig.bg} ${statusConfig.text}`}>
                      <span>{isValidating ? '🔄' : statusConfig.icon}</span>
                      <span className="capitalize">
                        {isValidating ? 'Validating...' : validation.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Quick Actions */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        validateCredential(validation.id);
                      }}
                      disabled={isValidating}
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded text-sm transition-colors"
                    >
                      {isValidating ? 'Testing...' : 'Test Now'}
                    </button>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-4">
                    {validation.lastValidated && (
                      <span>
                        Last tested: {new Date(validation.lastValidated).toLocaleString()}
                      </span>
                    )}
                    {validation.responseTimeMs && (
                      <span>Response: {validation.responseTimeMs}ms</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {validation.rateLimitRemaining !== undefined && (
                      <span className="text-xs">
                        Rate limit: {validation.rateLimitRemaining} remaining
                      </span>
                    )}
                    {validation.usageQuota && (
                      <span className="text-xs">
                        Usage: {validation.usageQuota.used}/{validation.usageQuota.limit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {validation.status === 'invalid' && validation.lastValidationMessage && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                    {validation.lastValidationMessage}
                  </div>
                )}
              </div>
            );
          })}

          {validations.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔐</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No credentials to validate
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add some API credentials to see their validation status here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Validation Detail Modal */}
      {selectedValidation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedValidation.keyName} - Validation Details
                </h3>
                <button
                  onClick={() => setSelectedValidation(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Current Status */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Current Status</h4>
                <div className={`p-4 rounded-lg ${STATUS_COLORS[selectedValidation.status].bg}`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{STATUS_COLORS[selectedValidation.status].icon}</span>
                    <span className={`font-medium ${STATUS_COLORS[selectedValidation.status].text}`}>
                      {selectedValidation.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  {selectedValidation.lastValidationMessage && (
                    <p className={`mt-2 text-sm ${STATUS_COLORS[selectedValidation.status].text}`}>
                      {selectedValidation.lastValidationMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Validation History */}
              {selectedValidation.validationHistory && selectedValidation.validationHistory.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Validation History</h4>
                  <div className="space-y-2">
                    {selectedValidation.validationHistory.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm">{STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]?.icon || '❓'}</span>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">
                              {entry.status.toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                          <div>{entry.responseTime}ms</div>
                          {entry.message && (
                            <div className="text-xs truncate max-w-40" title={entry.message}>
                              {entry.message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};