# Cartrita Scripts Directory

This directory contains all development, testing, and maintenance scripts for the Cartrita project, organized by purpose and functionality.

## 📁 Directory Structure

```
scripts/
├── config/                     # Configuration files
│   ├── postcss.config.js      # PostCSS configuration
│   └── tailwind.config.js     # Tailwind CSS configuration
├── fixes/                      # Bug fixes and syntax repair scripts
│   ├── final-syntax-*.js      # Final syntax cleanup scripts
│   ├── fix-*.js               # Various automated fix scripts
│   └── temp_fix.js            # Temporary fixes
├── setup/                      # System setup and deployment
│   ├── cleanup_structure.sh   # Project structure cleanup
│   ├── find_files.sh          # File discovery utility
│   ├── restart-backend.sh     # Backend restart script
│   ├── setup-cartrita.sh      # Main setup script
│   └── test-agents-*.sh       # Agent testing scripts
├── tests/                      # Testing and validation scripts
│   ├── comprehensive-backend-check.js  # Full backend validation
│   ├── create-user.js          # Test user creation
│   ├── test-*.js              # Various component tests
│   └── validate-lifeos-apis.js # Personal Life OS API validation
└── utils/                      # Utility scripts
    ├── AudioPlayer.ts          # Audio playback utilities
    ├── restructure.js          # Project restructuring
    └── test-ambient.js         # Ambient audio testing
```

## 🚀 Usage Instructions

### Setup Scripts
```bash
# Main system setup
./scripts/setup/setup-cartrita.sh

# Backend restart
./scripts/setup/restart-backend.sh

# Project cleanup
./scripts/setup/cleanup_structure.sh
```

### Testing Scripts
```bash
# Comprehensive backend check
node scripts/tests/comprehensive-backend-check.js

# API endpoint validation
node scripts/tests/validate-lifeos-apis.js

# Agent system testing
node scripts/tests/test-hierarchical-system.js

# Voice system testing
node scripts/tests/test-voice-permissions.js
```

### Fix Scripts
```bash
# Syntax error fixes
node scripts/fixes/fix-all-syntax-errors.js

# ES6 import fixes
node scripts/fixes/fix-es6-imports.js

# Security regex fixes
node scripts/fixes/fix-security-regex.js
```

## 📦 Backend Scripts

Located in `packages/backend/scripts/`:

```
packages/backend/scripts/
├── debug/                      # Debugging utilities
│   └── debug-routes.js        # Route debugging
├── setup/                      # Backend setup scripts
│   ├── convert_to_esm.mjs     # ES module conversion
│   ├── docker_init_db.sh      # Database initialization
│   ├── run_migration.js       # Database migrations
│   └── setup_*.sh             # Various setup scripts
└── tests/                      # Backend-specific tests
    ├── test-core-voice.js      # Voice system tests
    ├── test-enhanced-deepgram.js # Deepgram integration tests
    └── test-voice-system.js    # Complete voice testing
```

## 🎨 Frontend Scripts

Located in `packages/frontend/scripts/`:

```
packages/frontend/scripts/
├── build/                      # Build-related scripts
├── tests/                      # Frontend testing scripts
└── utils/                      # Frontend utilities
```

## 🔧 Script Categories

### 🧪 Testing Scripts
- **API Testing**: Validate endpoints and responses
- **Integration Testing**: Test component interactions
- **System Testing**: Full system validation
- **Performance Testing**: Response time and load testing

### 🛠️ Setup Scripts
- **Environment Setup**: Configure development environment
- **Database Setup**: Initialize and migrate databases
- **Service Setup**: Configure external services
- **Docker Setup**: Container configuration

### 🔧 Fix Scripts
- **Syntax Fixes**: Automated code repair
- **Import Fixes**: ES6 module corrections
- **Security Fixes**: Security vulnerability patches
- **Linting Fixes**: Code style corrections

### 🔍 Debug Scripts
- **Route Debugging**: API route validation
- **Agent Debugging**: Multi-agent system diagnostics
- **Performance Debugging**: System performance analysis

## 📝 Script Naming Convention

All scripts follow a consistent naming pattern:

- **test-\*.js**: Testing scripts
- **fix-\*.js**: Bug fix scripts
- **setup-\*.sh**: Setup and configuration scripts
- **validate-\*.js**: Validation and verification scripts
- **debug-\*.js**: Debugging utilities

## 🏃‍♂️ Running Scripts

### From Project Root
```bash
# Run any script from project root
node scripts/tests/test-api-endpoints.js
./scripts/setup/setup-cartrita.sh
```

### From Package Directories
```bash
# Backend scripts
cd packages/backend
node scripts/tests/test-voice-system.js

# Frontend scripts  
cd packages/frontend
node scripts/tests/test-component.js
```

## 📊 Script Dependencies

### Required Environment Variables
- `OPENAI_API_KEY`: Required for AI-related tests
- `JWT_SECRET`: Required for authentication tests
- `DEEPGRAM_API_KEY`: Required for voice system tests

### Required Services
- **PostgreSQL**: Database connection required
- **Docker**: Container operations
- **Node.js 18+**: Script execution environment

## 🔒 Security Considerations

- Never commit API keys or secrets in scripts
- Use environment variables for sensitive data
- Validate input parameters in all scripts
- Follow principle of least privilege

## 📋 Maintenance

### Adding New Scripts
1. Place in appropriate category directory
2. Follow naming conventions
3. Add usage documentation
4. Update this README
5. Test script functionality

### Script Organization Rules
- **Keep scripts focused**: One purpose per script
- **Use descriptive names**: Clear functionality indication
- **Add comments**: Explain complex operations
- **Handle errors**: Graceful failure handling
- **Log operations**: Clear progress indication

## 🚀 Contributing

When adding new scripts:

1. **Choose appropriate directory** based on script purpose
2. **Follow naming conventions** for consistency
3. **Add error handling** for robustness
4. **Include usage examples** in comments
5. **Update documentation** as needed

This organization ensures all development scripts are easily discoverable, maintainable, and properly categorized for efficient development workflows.