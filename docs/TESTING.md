# Test Documentation

## Overview

This document describes the comprehensive testing framework implemented for Cartrita, including unit tests, integration tests, end-to-end tests, and performance tests.

## Testing Strategy

Our testing approach follows the testing pyramid:

```
     /\
    /E2E\     <- Few, but comprehensive user journey tests
   /______\
  /Integration\ <- API and service integration tests
 /______________\
/   Unit Tests   \ <- Many, fast, isolated tests
/________________\
```

## Test Types

### Unit Tests
- **Location**: `tests/unit/`
- **Framework**: Jest
- **Purpose**: Test individual functions and components in isolation
- **Coverage**: Aim for >90% code coverage
- **Command**: `npm run test:unit`

### Integration Tests
- **Location**: `tests/integration/`
- **Framework**: Jest with Supertest
- **Purpose**: Test API endpoints and database interactions
- **Database**: Isolated test database
- **Command**: `npm run test:integration`

### End-to-End Tests
- **Location**: `tests/e2e/`
- **Framework**: Playwright
- **Purpose**: Test complete user workflows across browsers
- **Browsers**: Chrome, Firefox, Safari, Mobile
- **Command**: `npm run test:e2e`

### Performance Tests
- **Location**: `tests/e2e/performance.e2e.js`
- **Framework**: Playwright with custom utilities
- **Purpose**: Load testing, stress testing, memory profiling
- **Command**: `npm run test:performance`

## Test Configuration

### Jest Configuration
- `jest.unit.config.js` - Unit test configuration
- `jest.integration.config.js` - Integration test configuration

### Playwright Configuration
- `playwright.config.js` - E2E test configuration

## Test Utilities

### TestDatabase.js
Provides database testing utilities:
- Isolated test database creation
- Test data seeding and cleanup
- Transaction management
- CRUD operation helpers

### APITestClient.js
HTTP API testing client:
- Authentication handling
- Request/response validation
- CRUD operation testing
- Error handling validation

### MockServices.js
External service mocking:
- OpenAI API mocking
- Deepgram API mocking
- HuggingFace API mocking
- Redis service mocking
- Email service mocking

### PerformanceUtils.js
Performance testing utilities:
- Load testing framework
- Database stress testing
- Memory profiling
- Performance metric collection

## Running Tests

### Local Development

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run performance tests
npm run test:performance

# Run E2E tests with UI
npm run test:e2e:headed
```

### CI/CD Pipeline

Tests are automatically run in GitHub Actions:

1. **Code Quality** - Linting, formatting, security checks
2. **Unit Tests** - Fast, isolated tests across Node.js versions
3. **Integration Tests** - API and database tests with real services
4. **E2E Tests** - Full user journey tests across browsers
5. **Performance Tests** - Load and stress testing (on main/develop only)
6. **Security Tests** - Vulnerability scanning

## Test Data Management

### Database Setup
- Uses PostgreSQL with pgvector extension
- Applies schema from `db-init/` directory
- Creates isolated test database per test suite
- Automatic cleanup after tests

### Test Users
Default test users are created:
- Email: `test@example.com`
- Email: `e2etest@example.com`
- Password: `TestPassword123!`

### Mock Data
- Realistic test data generation
- Consistent test scenarios
- Proper data relationships

## Coverage Requirements

### Minimum Coverage Thresholds
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### Coverage Reports
- Generated in `coverage/` directory
- HTML reports available after running tests
- Uploaded to Codecov in CI/CD

## Performance Benchmarks

### Response Time Targets
- API endpoints: < 200ms average
- 95th percentile: < 500ms
- Database queries: < 50ms average

### Throughput Targets
- Authentication: > 100 req/s
- Chat endpoints: > 50 req/s
- Workflow operations: > 80 req/s

### Memory Usage
- Heap growth: < 100MB during load tests
- No memory leaks detected
- Peak usage: < 500MB

## Error Handling Tests

### HTTP Status Codes
- 200: Success responses
- 400: Bad request validation
- 401: Authentication failures
- 403: Authorization failures
- 404: Resource not found
- 500: Server errors

### Error Scenarios
- Invalid input data
- Network failures
- Database connection issues
- External API failures
- Rate limiting
- Timeout handling

## Browser Support

### Desktop Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Mobile Browsers
- Chrome Mobile
- Safari Mobile
- Samsung Internet

### Viewport Testing
- Desktop: 1920x1080, 1366x768
- Tablet: 768x1024
- Mobile: 375x667, 414x896

## Debugging Tests

### Local Debugging
```bash
# Run specific test file
npx jest tests/unit/auth.test.js

# Run with verbose output
npm run test:unit -- --verbose

# Run E2E tests with browser visible
npm run test:e2e:headed

# Debug specific E2E test
npx playwright test tests/e2e/auth-flow.e2e.js --debug
```

### CI Debugging
- Test artifacts uploaded on failure
- Screenshots and videos for E2E failures
- Detailed logs in workflow output
- Coverage reports always generated

## Best Practices

### Test Writing
1. Follow AAA pattern (Arrange, Act, Assert)
2. Use descriptive test names
3. Test both success and failure scenarios
4. Mock external dependencies
5. Use realistic test data
6. Clean up after tests

### Test Maintenance
1. Keep tests up-to-date with code changes
2. Remove obsolete tests
3. Refactor common test patterns into utilities
4. Monitor test performance and flakiness
5. Update test data as needed

### CI/CD Integration
1. Fail fast on critical test failures
2. Generate comprehensive reports
3. Cache dependencies for faster runs
4. Run appropriate tests for each environment
5. Provide clear feedback on failures

## Troubleshooting

### Common Issues

#### Database Connection Failures
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify test database exists
psql -h localhost -U testuser -d cartrita_test -c "\l"
```

#### Port Conflicts
```bash
# Check if ports are in use
lsof -i :3000  # Backend port
lsof -i :5173  # Frontend port
lsof -i :5432  # PostgreSQL port
lsof -i :6379  # Redis port
```

#### Memory Issues
```bash
# Run with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:e2e
```

#### Timeout Issues
- Increase timeout in test configuration
- Check for slow database queries
- Verify external service mocking

### Getting Help
1. Check test output logs
2. Review test configuration
3. Verify environment setup
4. Check GitHub Actions workflow logs
5. Create issue with test failure details

## Continuous Improvement

### Metrics to Track
- Test execution time
- Test coverage percentage
- Test failure rates
- Flaky test identification
- Performance benchmark trends

### Regular Tasks
- Review and update test coverage
- Optimize slow tests
- Update browser versions
- Refresh test data
- Maintain test utilities

### Future Enhancements
- Visual regression testing
- Accessibility testing
- Load testing automation
- Mobile app testing
- API contract testing
