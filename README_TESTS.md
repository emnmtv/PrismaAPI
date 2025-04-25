# Prisma API Test Suite

This directory contains test scripts for testing the Prisma backend API functionality and performance.

## Test Files

1. **test_api.php** - Comprehensive API functionality tests
2. **benchmark.php** - Performance and stress testing
3. **chat_test.php** - Chat functionality tests (HTTP and WebSocket)

## Requirements

- PHP 7.4 or higher
- PHP cURL extension
- A running instance of the Prisma backend server

## Running the Tests

### API Functionality Tests

This script tests all API endpoints for proper functionality.

```bash
php test_api.php
```

The script will:
- Register test users
- Test all authentication endpoints
- Test profile management
- Test creator profile functionality
- Test post creation and management
- Test payment functionality
- Test ratings
- Test admin functions
- Perform stress tests on key endpoints

### Performance Benchmarks

This script conducts load testing and generates performance reports.

```bash
php benchmark.php
```

The script will:
- Test the API under various load conditions
- Generate JSON results file
- Generate an HTML report with charts and metrics

After running, you can open the generated HTML report in a browser to see detailed results.

### Chat Functionality Tests

This script tests the chat API endpoints and simulates WebSocket testing.

```bash
php chat_test.php
```

The script will:
- Create test users
- Test sending and receiving messages
- Test message history retrieval
- Simulate WebSocket functionality tests

## Configuration

You can modify the following parameters in each script:

- **test_api.php**:
  - `$BASE_URL`: API endpoint URL (default: http://localhost:3200/auth)
  - `$CONCURRENT_REQUESTS`: Number of concurrent requests for stress testing
  - `$ITERATIONS`: Number of iterations for each stress test
  - `$VERBOSE`: Set to true for detailed output

- **benchmark.php**:
  - `$BASE_URL`: API endpoint URL
  - `$TEST_DURATION`: Duration of each test in seconds
  - `$LOAD_TESTS`: Configure different load test profiles
  - `$ENDPOINTS`: Configure which endpoints to test

- **chat_test.php**:
  - `$BASE_URL`: API endpoint URL
  - `$SOCKET_URL`: WebSocket server URL

## Notes for WebSocket Testing

The chat_test.php script simulates WebSocket testing, as PHP doesn't natively support WebSockets. For complete WebSocket testing, consider:

1. Using a JavaScript-based test framework
2. Using a command-line tool like `wscat`
3. Implementing a PHP WebSocket client using a library like Ratchet or Pawl

## Interpreting Test Results

- Green "TEST PASSED" messages indicate successful tests
- Red "TEST FAILED" messages indicate failed tests
- Stress test results show:
  - Success rate
  - Average response time
  - Min/max response times
  - Requests per second

## Troubleshooting

Common issues:

1. **Connection refused**: Make sure the server is running
2. **Authentication errors**: Verification email functionality may cause tests to fail
3. **File uploads failing**: Ensure the upload directory is writable

## Extending the Tests

To add new tests:

1. Create a new test function in the appropriate file
2. Call your function from the main execution section
3. Follow the established pattern for error handling and reporting 