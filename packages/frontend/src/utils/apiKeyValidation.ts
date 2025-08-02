export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export function validateApiKey(provider: string, apiKey: string): ValidationResult {
  if (!apiKey || !provider) {
    return { isValid: false, message: 'Provider and API key are required' };
  }

  // Remove whitespace
  const trimmedKey = apiKey.trim();
  
  if (!trimmedKey) {
    return { isValid: false, message: 'API key cannot be empty' };
  }

  // Provider-specific patterns
  const patterns = {
    openai: /^sk-[A-Za-z0-9]{20,}$/,
    anthropic: /^sk-ant-[A-Za-z0-9-]{32,}$/,
    github: /^gh[ps]_[A-Za-z0-9]{36}$/,
    stripe: /^sk_(test_|live_)[A-Za-z0-9]{24,}$/,
    deepgram: /^[A-Za-z0-9]{40}$/
  };

  const pattern = patterns[provider as keyof typeof patterns];
  
  if (!pattern) {
    // Generic validation for unknown providers
    if (trimmedKey.length < 16) {
      return { isValid: false, message: 'API key must be at least 16 characters long' };
    }
    return { isValid: true };
  }

  if (!pattern.test(trimmedKey)) {
    const errorMessages = {
      openai: 'OpenAI API key must start with "sk-" and be at least 20 characters long',
      anthropic: 'Anthropic API key must start with "sk-ant-" and be at least 32 characters long',
      github: 'GitHub API key must start with "ghp_" or "ghs_" and be 40 characters total',
      stripe: 'Stripe API key must start with "sk_test_" or "sk_live_" and be at least 24 characters long',
      deepgram: 'Deepgram API key must be exactly 40 characters long'
    };
    
    return { 
      isValid: false, 
      message: errorMessages[provider as keyof typeof errorMessages] || 'Invalid API key format' 
    };
  }

  return { isValid: true };
}