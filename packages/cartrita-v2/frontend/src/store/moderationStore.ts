import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModerationRule {
  id: string;
  name: string;
  type: 'keyword' | 'regex' | 'ai' | 'custom';
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'warn' | 'block' | 'flag' | 'replace';
  replacement?: string;
  enabled: boolean;
  description?: string;
  createdAt: Date;
}

export interface ModerationResult {
  id: string;
  content: string;
  timestamp: Date;
  flagged: boolean;
  confidence: number;
  violations: Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    action: string;
    match: string;
  }>;
  moderatedContent?: string;
  action: 'allowed' | 'blocked' | 'flagged' | 'modified';
}

interface ModerationStore {
  enabled: boolean;
  strictMode: boolean;
  rules: ModerationRule[];
  results: ModerationResult[];
  whitelist: string[];
  blacklist: string[];
  
  toggleEnabled: () => void;
  toggleStrictMode: () => void;
  addRule: (rule: Omit<ModerationRule, 'id' | 'createdAt'>) => void;
  updateRule: (id: string, updates: Partial<ModerationRule>) => void;
  removeRule: (id: string) => void;
  moderateContent: (content: string) => ModerationResult;
  addToWhitelist: (pattern: string) => void;
  addToBlacklist: (pattern: string) => void;
  removeFromWhitelist: (pattern: string) => void;
  removeFromBlacklist: (pattern: string) => void;
  clearResults: () => void;
  getResultsByAction: (action: ModerationResult['action']) => ModerationResult[];
}

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const defaultRules: ModerationRule[] = [
  {
    id: '1',
    name: 'Profanity Filter',
    type: 'keyword',
    pattern: 'damn|hell|crap',
    severity: 'low',
    action: 'replace',
    replacement: '***',
    enabled: true,
    description: 'Replace common profanity with asterisks',
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'Spam Detection',
    type: 'regex',
    pattern: '(.)\\1{5,}',
    severity: 'medium',
    action: 'flag',
    enabled: true,
    description: 'Detect repeated characters (potential spam)',
    createdAt: new Date(),
  },
];

export const useModerationStore = create<ModerationStore>()(
  persist(
    (set, get) => ({
      enabled: true,
      strictMode: false,
      rules: defaultRules,
      results: [],
      whitelist: [],
      blacklist: [],
      
      toggleEnabled: () =>
        set((state) => ({ enabled: !state.enabled })),
      
      toggleStrictMode: () =>
        set((state) => ({ strictMode: !state.strictMode })),
      
      addRule: (ruleData) => {
        const rule: ModerationRule = {
          ...ruleData,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({
          rules: [...state.rules, rule],
        }));
      },
      
      updateRule: (id: string, updates: Partial<ModerationRule>) => {
        set((state) => ({
          rules: state.rules.map(rule =>
            rule.id === id ? { ...rule, ...updates } : rule
          ),
        }));
      },
      
      removeRule: (id: string) => {
        set((state) => ({
          rules: state.rules.filter(rule => rule.id !== id),
        }));
      },
      
      moderateContent: (content: string) => {
        const state = get();
        if (!state.enabled) {
          const result: ModerationResult = {
            id: generateId(),
            content,
            timestamp: new Date(),
            flagged: false,
            confidence: 0,
            violations: [],
            action: 'allowed',
          };
          return result;
        }
        
        const violations: ModerationResult['violations'] = [];
        let moderatedContent = content;
        let flagged = false;
        let action: ModerationResult['action'] = 'allowed';
        
        // Check whitelist first
        const isWhitelisted = state.whitelist.some(pattern => 
          content.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isWhitelisted) {
          const result: ModerationResult = {
            id: generateId(),
            content,
            timestamp: new Date(),
            flagged: false,
            confidence: 0,
            violations: [],
            action: 'allowed',
          };
          
          set((state) => ({
            results: [...state.results.slice(-99), result],
          }));
          
          return result;
        }
        
        // Check blacklist
        const isBlacklisted = state.blacklist.some(pattern => 
          content.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isBlacklisted) {
          flagged = true;
          action = 'blocked';
          violations.push({
            ruleId: 'blacklist',
            ruleName: 'Blacklist',
            severity: 'critical',
            action: 'block',
            match: 'Blacklisted content',
          });
        } else {
          // Check rules
          for (const rule of state.rules) {
            if (!rule.enabled) continue;
            
            let match: RegExpMatchArray | null = null;
            
            if (rule.type === 'keyword') {
              const regex = new RegExp(`\\b(${rule.pattern})\\b`, 'gi');
              match = content.match(regex);
            } else if (rule.type === 'regex') {
              const regex = new RegExp(rule.pattern, 'gi');
              match = content.match(regex);
            }
            
            if (match) {
              flagged = true;
              violations.push({
                ruleId: rule.id,
                ruleName: rule.name,
                severity: rule.severity,
                action: rule.action,
                match: match[0],
              });
              
              if (rule.action === 'block') {
                action = 'blocked';
                break;
              } else if (rule.action === 'replace' && rule.replacement) {
                moderatedContent = moderatedContent.replace(
                  new RegExp(rule.pattern, 'gi'),
                  rule.replacement
                );
                action = 'modified';
              } else if (rule.action === 'flag') {
                action = 'flagged';
              }
            }
          }
        }
        
        const confidence = violations.length > 0 ? 
          Math.min(violations.length * 0.3 + 0.1, 1) : 0;
        
        const result: ModerationResult = {
          id: generateId(),
          content,
          timestamp: new Date(),
          flagged,
          confidence,
          violations,
          moderatedContent: action === 'modified' ? moderatedContent : undefined,
          action,
        };
        
        set((state) => ({
          results: [...state.results.slice(-99), result],
        }));
        
        return result;
      },
      
      addToWhitelist: (pattern: string) => {
        set((state) => ({
          whitelist: [...state.whitelist, pattern],
        }));
      },
      
      addToBlacklist: (pattern: string) => {
        set((state) => ({
          blacklist: [...state.blacklist, pattern],
        }));
      },
      
      removeFromWhitelist: (pattern: string) => {
        set((state) => ({
          whitelist: state.whitelist.filter(p => p !== pattern),
        }));
      },
      
      removeFromBlacklist: (pattern: string) => {
        set((state) => ({
          blacklist: state.blacklist.filter(p => p !== pattern),
        }));
      },
      
      clearResults: () => {
        set({ results: [] });
      },
      
      getResultsByAction: (action: ModerationResult['action']) => {
        return get().results.filter(result => result.action === action);
      },
    }),
    {
      name: 'moderation-store',
    }
  )
);