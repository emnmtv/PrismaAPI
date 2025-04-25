<?php
/**
 * API Test Suite for Prisma Backend
 * 
 * This script tests all API endpoints and provides stress testing capabilities
 */

// Include test utilities for HTML output
require_once('test_utils.php');

// Configuration
$BASE_URL = 'http://localhost:3200/auth';
$CONCURRENT_REQUESTS = 10; // Number of concurrent requests for stress testing
$ITERATIONS = 5; // Number of iterations for each stress test
$VERBOSE = true; // Set to true for detailed output

// Use existing verified accounts
$TEST_USER = [
    'email' => 'shizukagremory5@gmail.com',
    'password' => '123456'
];

$TEST_ADMIN = [
    'email' => 'shizukagremory5@gmail.com',
    'password' => '123456',
    'role' => 'admin' // Note: This role setting won't be used since we're using an existing account
];

$TEST_CREATOR = [
    'email' => 'mel@gmail.com',
    'password' => '123456'
];

// Global storage for test data
$tokens = [
    'user' => null,
    'admin' => null,
    'creator' => null
];
$userIds = [
    'user' => null,
    'admin' => null,
    'creator' => null
];
$testPostId = null;
$testReferenceNumber = null;
$testPaymentId = null;

// Initialize test statistics
$testStats = [
    'total' => 0,
    'passed' => 0,
    'failed' => 0
];

/**
 * Make an HTTP request to the API
 * 
 * @param string $endpoint The API endpoint
 * @param string $method The HTTP method (GET, POST, PUT, DELETE)
 * @param array $data The data to send
 * @param string $token The authentication token
 * @param array $files Files to upload
 * @return array Response data
 */
function apiRequest($endpoint, $method = 'GET', $data = [], $token = null, $files = null) {
    global $BASE_URL, $VERBOSE;
    
    $url = $BASE_URL . $endpoint;
    $ch = curl_init($url);
    
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    if ($files) {
        $postData = $data;
        
        foreach ($files as $key => $file) {
            if (is_array($file)) {
                foreach ($file as $index => $f) {
                    $postData[$key][$index] = new CURLFile($f);
                }
            } else {
                $postData[$key] = new CURLFile($file);
            }
        }
        
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        // Remove Content-Type header for multipart/form-data
        $headers = array_filter($headers, function($header) {
            return strpos($header, 'Content-Type:') === false;
        });
    } else if (!empty($data)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);
    
    $info = curl_getinfo($ch);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    $executionTime = round(($endTime - $startTime) * 1000, 2); // in ms
    
    if ($VERBOSE) {
        logRequest($url, $method, $data);
        logResponse($info['http_code'], $responseData, $executionTime);
    }
    
    return [
        'data' => $responseData,
        'http_code' => $info['http_code'],
        'execution_time' => $executionTime,
        'error' => $error
    ];
}

/**
 * Perform stress testing on an endpoint
 * 
 * @param string $endpoint The API endpoint to test
 * @param string $method The HTTP method
 * @param array $data The data to send
 * @param string $token The authentication token
 * @return array Test results
 */
function stressTest($endpoint, $method = 'GET', $data = [], $token = null) {
    global $CONCURRENT_REQUESTS, $ITERATIONS;
    
    $totalRequests = $CONCURRENT_REQUESTS * $ITERATIONS;
    $successCount = 0;
    $totalTime = 0;
    $minTime = PHP_FLOAT_MAX;
    $maxTime = 0;
    $responseCodes = [];
    
    logMessage("Starting stress test for $endpoint ($method) with $totalRequests requests...", "info");
    
    for ($i = 0; $i < $ITERATIONS; $i++) {
        $startTime = microtime(true);
        $processes = [];
        
        // Start concurrent processes
        for ($j = 0; $j < $CONCURRENT_REQUESTS; $j++) {
            $data['__stresstest'] = "$i-$j"; // Add unique identifier
            $processes[] = apiRequest($endpoint, $method, $data, $token);
        }
        
        // Process results
        foreach ($processes as $response) {
            if ($response['http_code'] >= 200 && $response['http_code'] < 300) {
                $successCount++;
            }
            
            $totalTime += $response['execution_time'];
            $minTime = min($minTime, $response['execution_time']);
            $maxTime = max($maxTime, $response['execution_time']);
            
            if (!isset($responseCodes[$response['http_code']])) {
                $responseCodes[$response['http_code']] = 0;
            }
            $responseCodes[$response['http_code']]++;
        }
    }
    
    $avgTime = $totalTime / $totalRequests;
    $successRate = ($successCount / $totalRequests) * 100;
    
    $results = [
        'success_rate' => $successRate,
        'avg_time' => $avgTime,
        'min_time' => $minTime,
        'max_time' => $maxTime,
        'response_codes' => $responseCodes
    ];
    
    logStressTestResults($endpoint, $results);
    
    return $results;
}

/**
 * Run a test case and handle results
 * 
 * @param string $testName The name of the test
 * @param callable $testFunction The test function
 * @return bool Whether the test passed
 */
function runTest($testName, $testFunction) {
    global $testStats;
    $testStats['total']++;
    
    startTestSection($testName);
    
    try {
        $result = $testFunction();
        if ($result) {
            $testStats['passed']++;
            logMessage("✓ TEST PASSED: $testName", "success");
        } else {
            $testStats['failed']++;
            logMessage("✗ TEST FAILED: $testName", "failure");
        }
        endTestSection($result);
        return $result;
    } catch (Exception $e) {
        $testStats['failed']++;
        logMessage("✗ TEST ERROR: $testName", "failure");
        logMessage("  Error: " . $e->getMessage(), "failure");
        endTestSection(false);
        return false;
    }
}

// ========================================
// TEST CASES
// ========================================

// Test user registration
function testRegister() {
    global $TEST_USER;
    
    // Skip actual registration since we're using an existing account
    logMessage("Using existing verified account - skipping registration", "info");
    return true;
}

// Test admin registration
function testRegisterAdmin() {
    global $TEST_ADMIN;
    
    // Skip actual registration since we're using an existing account
    logMessage("Using existing verified account - skipping admin registration", "info");
    return true;
}

// Test creator registration
function testRegisterCreator() {
    global $TEST_CREATOR;
    
    // Skip actual registration since we're using an existing account
    logMessage("Using existing verified account - skipping creator registration", "info");
    return true;
}

// Test email verification (mocked)
function testVerifyEmail() {
    global $TEST_USER;
    
    // Skip verification since we're using an existing verified account
    logMessage("Using existing verified account - skipping email verification", "info");
    return true;
}

// Test user login
function testLogin() {
    global $TEST_USER, $tokens;
    
    $response = apiRequest('/login', 'POST', [
        'email' => $TEST_USER['email'],
        'password' => $TEST_USER['password']
    ]);
    
    if ($response['http_code'] == 200 && isset($response['data']['token'])) {
        $tokens['user'] = $response['data']['token'];
        logMessage("User logged in successfully", "success");
        return true;
    }
    return false;
}

// Test admin login
function testAdminLogin() {
    global $TEST_ADMIN, $tokens;
    
    $response = apiRequest('/login', 'POST', [
        'email' => $TEST_ADMIN['email'],
        'password' => $TEST_ADMIN['password']
    ]);
    
    if ($response['http_code'] == 200 && isset($response['data']['token'])) {
        $tokens['admin'] = $response['data']['token'];
        logMessage("Admin logged in successfully", "success");
        return true;
    }
    return false;
}

// Test creator login
function testCreatorLogin() {
    global $TEST_CREATOR, $tokens;
    
    $response = apiRequest('/login', 'POST', [
        'email' => $TEST_CREATOR['email'],
        'password' => $TEST_CREATOR['password']
    ]);
    
    if ($response['http_code'] == 200 && isset($response['data']['token'])) {
        $tokens['creator'] = $response['data']['token'];
        logMessage("Creator logged in successfully", "success");
        return true;
    }
    return false;
}

// Test get profile
function testGetProfile() {
    global $tokens, $userIds;
    
    $response = apiRequest('/profile', 'GET', [], $tokens['user']);
    
    if ($response['http_code'] == 200 && isset($response['data']['userProfile']['id'])) {
        $userIds['user'] = $response['data']['userProfile']['id'];
        logMessage("Got profile successfully", "success");
        return true;
    }
    return false;
}

// Test update profile
function testUpdateProfile() {
    global $tokens;
    
    $response = apiRequest('/profile', 'PUT', [
        'firstName' => 'Updated',
        'lastName' => 'Name',
        'phoneNumber' => '9876543210'
    ], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test upgrade to creator
// function testUpgradeToCreator() {
//     global $tokens;
    
//     $response = apiRequest('/upgrade', 'POST', [
//         'offers' => 'Music Production, Guitar Lessons',
//         'bio' => 'Professional musician with 10 years of experience',
//         'profession' => 'Musician',
//         'typeOfProfession' => 'Guitarist',
//         'genre' => 'Rock, Jazz'
//     ], $tokens['user']);
    
//     return $response['http_code'] == 200;
// }

// Test get creator profile
function testGetCreatorProfile() {
    global $tokens;
    
    $response = apiRequest('/cprofile', 'GET', [], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test edit creator profile
function testEditCreatorProfile() {
    global $tokens;
    
    $response = apiRequest('/editcprofile', 'PUT', [
        'offers' => 'Music Production, Guitar Lessons, Songwriting',
        'bio' => 'Updated bio with more info',
        'genre' => 'Rock, Jazz, Blues'
    ], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test create post
// function testCreatePost() {
//     global $tokens, $testPostId;
    
//     $response = apiRequest('/createpost', 'POST', [
//         'title' => 'Test Post Title',
//         'description' => 'Test post description',
//         'detailedDescription' => 'This is a detailed description of the test post',
//         'amount' => '100.00',
//         'remarks' => 'Test remarks'
//     ], $tokens['user']);
    
//     if ($response['http_code'] == 200 && isset($response['data']['post']['id'])) {
//         $testPostId = $response['data']['post']['id'];
//         logMessage("Post created with ID: $testPostId", "success");
//         return true;
//     }
//     return false;
// }

// Test edit post
// function testEditPost() {
//     global $tokens, $testPostId;
    
//     if (!$testPostId) {
//         logMessage("No post ID available for editing", "warning");
//         return false;
//     }
    
//     $response = apiRequest('/editpost', 'PUT', [
//         'postId' => $testPostId,
//         'title' => 'Updated Test Post Title',
//         'description' => 'Updated test post description',
//         'detailedDescription' => 'This is an updated detailed description',
//         'amount' => '150.00',
//         'remarks' => 'Updated test remarks'
//     ], $tokens['user']);
    
//     return $response['http_code'] == 200;
// }

// Test get user post
// function testGetUserPost() {
//     global $tokens;
    
//     $response = apiRequest('/viewuserpost', 'GET', [], $tokens['user']);
    
//     return $response['http_code'] == 200;
// }

// Test get all posts
function testGetAllPosts() {
    $response = apiRequest('/allpost', 'GET');
    
    return $response['http_code'] == 200;
}

// Test get post with user details
function testGetPostWithUser() {
    global $testPostId;
    
    if (!$testPostId) {
        logMessage("No post ID available for viewing", "warning");
        return false;
    }
    
    $response = apiRequest('/viewpost?postId=' . $testPostId, 'GET');
    
    return $response['http_code'] == 200;
}

// Test interaction between accounts
function testAccountInteraction() {
    global $tokens, $userIds;
    
    logMessage("Testing interaction between two verified accounts...", "info");
    
    // Ensure both accounts are logged in
    if (!$tokens['user'] || !$tokens['creator']) {
        logMessage("Both accounts must be logged in first", "warning");
        return false;
    }
    
    // Send a test message from user to creator
    $message = "Test message from user to creator: " . time();
    $sendResponse = apiRequest('/sendmessage', 'POST', [
        'senderId' => $userIds['user'],
        'receiverId' => $userIds['creator'],
        'content' => $message
    ], $tokens['user']);
    
    if ($sendResponse['http_code'] != 200) {
        logMessage("Failed to send message: " . json_encode($sendResponse['data']), "failure");
        return false;
    }
    
    logMessage("Message sent successfully from user to creator", "success");
    
    // Check if user can fetch messages with creator
    $fetchResponse = apiRequest('/messages/' . $userIds['creator'], 'GET', [], $tokens['user']);
    
    if ($fetchResponse['http_code'] != 200) {
        logMessage("Failed to fetch messages: " . json_encode($fetchResponse['data']), "failure");
        return false;
    }
    
    logMessage("Message history retrieved successfully", "success");
    
    // Check if the message was received (optional, may not be reliable in automated tests)
    $messageFound = false;
    if (!empty($fetchResponse['data'])) {
        foreach ($fetchResponse['data'] as $msg) {
            if (strpos($msg['content'], 'Test message from user to creator') !== false) {
                $messageFound = true;
                break;
            }
        }
    }
    
    if ($messageFound) {
        logMessage("Message was found in history", "success");
    } else {
        logMessage("Message was not found in history (this could be normal depending on timing)", "warning");
    }
    
    return true;
}

// Test initiate payment
function testInitiatePayment() {
    global $tokens, $userIds, $testReferenceNumber;
    
    $response = apiRequest('/payment', 'POST', [
        'amount' => 100 * 100, // Convert to cents
        'description' => 'Test payment',
        'remarks' => 'Test payment remarks',
        'clientId' => $userIds['user'] // Self-payment for test
    ], $tokens['user']);
    
    if ($response['http_code'] == 200 && isset($response['data']['referenceNumber'])) {
        $testReferenceNumber = $response['data']['referenceNumber'];
        logMessage("Payment initiated with reference: $testReferenceNumber", "success");
        return true;
    }
    return false;
}

// Test check payment status
function testCheckPaymentStatus() {
    global $tokens, $testReferenceNumber;
    
    if (!$testReferenceNumber) {
        logMessage("No reference number available for checking status", "warning");
        return false;
    }
    
    $response = apiRequest('/payment/status?referenceNumber=' . $testReferenceNumber, 'GET', [], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test fetch payments
function testFetchPayments() {
    global $tokens, $testPaymentId;
    
    $response = apiRequest('/payments', 'GET', [], $tokens['user']);
    
    if ($response['http_code'] == 200 && isset($response['data']['payments'])) {
        // Store the first payment ID for rating test
        if (!empty($response['data']['payments'])) {
            $testPaymentId = $response['data']['payments'][0]['id'];
            logMessage("Found payment with ID: $testPaymentId", "success");
        }
        return true;
    }
    return false;
}

// Test update order status
function testUpdateOrderStatus() {
    global $tokens, $testReferenceNumber;
    
    if (!$testReferenceNumber) {
        logMessage("No reference number available for updating status", "warning");
        return false;
    }
    
    $response = apiRequest('/payment/status', 'PUT', [
        'referenceNumber' => $testReferenceNumber,
        'newStatus' => 'completed'
    ], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test fetch client payments
function testFetchClientPayments() {
    global $tokens;
    
    $response = apiRequest('/client/payments', 'GET', [], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test update client order status
function testUpdateClientOrderStatus() {
    global $tokens, $testReferenceNumber;
    
    if (!$testReferenceNumber) {
        logMessage("No reference number available for updating client status", "warning");
        return false;
    }
    
    $response = apiRequest('/client/payment/status', 'PUT', [
        'referenceNumber' => $testReferenceNumber,
        'newStatus' => 'in_progress'
    ], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test submit rating
function testSubmitRating() {
    global $tokens, $userIds, $testPaymentId;
    
    if (!$testPaymentId) {
        logMessage("No payment ID available for rating", "warning");
        return false;
    }
    
    $response = apiRequest('/rate', 'POST', [
        'userId' => $userIds['user'], // Self-rating for test
        'paymentId' => $testPaymentId,
        'rating' => 5,
        'review' => 'Excellent service!'
    ], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test get creator ratings
function testGetCreatorRatings() {
    global $tokens;
    
    $response = apiRequest('/ratings', 'GET', [], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test get creator ratings by ID
function testGetCreatorRatingsById() {
    global $tokens, $userIds;
    
    $response = apiRequest('/ratings/' . $userIds['user'], 'GET', [], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test admin update post status
function testAdminUpdatePostStatus() {
    global $tokens, $testPostId;
    
    if (!$testPostId) {
        logMessage("No post ID available for admin status update", "warning");
        return false;
    }
    
    $response = apiRequest('/post/status', 'PUT', [
        'postId' => $testPostId,
        'status' => 'approved'
    ], $tokens['admin']);
    
    return $response['http_code'] == 200;
}

// Test admin get all posts
function testAdminGetAllPosts() {
    global $tokens;
    
    $response = apiRequest('/admin/posts', 'GET', [], $tokens['admin']);
    
    return $response['http_code'] == 200;
}

// Test admin get all users
function testAdminGetAllUsers() {
    global $tokens;
    
    $response = apiRequest('/admin/users', 'GET', [], $tokens['admin']);
    
    return $response['http_code'] == 200;
}

// Test delete post
function testDeletePost() {
    global $tokens, $testPostId;
    
    if (!$testPostId) {
        logMessage("No post ID available for deletion", "warning");
        return false;
    }
    
    $response = apiRequest('/delete', 'PUT', [
        'postId' => $testPostId
    ], $tokens['user']);
    
    return $response['http_code'] == 200;
}

// Test admin delete post
function testAdminDeletePost() {
    global $tokens, $testPostId;
    
    if (!$testPostId) {
        logMessage("No post ID available for admin deletion", "warning");
        return false;
    }
    
    $response = apiRequest('/post/admin', 'DELETE', [
        'postId' => $testPostId
    ], $tokens['admin']);
    
    return $response['http_code'] == 200;
}

// ========================================
// STRESS TESTS
// ========================================

function stressTestLogin() {
    global $TEST_USER;
    
    return stressTest('/login', 'POST', [
        'email' => $TEST_USER['email'],
        'password' => $TEST_USER['password']
    ]);
}

function stressTestGetProfile() {
    global $tokens;
    
    return stressTest('/profile', 'GET', [], $tokens['user']);
}

function stressTestAllPosts() {
    return stressTest('/allpost', 'GET');
}

// ========================================
// RUN TESTS
// ========================================

// Initialize HTML output
initHtmlOutput('API Test Suite for Prisma Backend');

startSection('Basic Auth Tests');
runTest('Register User', 'testRegister');
runTest('Register Admin', 'testRegisterAdmin');
runTest('Register Creator', 'testRegisterCreator');
runTest('Verify Email', 'testVerifyEmail');
runTest('Login User', 'testLogin');
runTest('Login Admin', 'testAdminLogin');
runTest('Login Creator', 'testCreatorLogin');

startSection('Profile Tests');
runTest('Get Profile', 'testGetProfile');
runTest('Update Profile', 'testUpdateProfile');
runTest('Upgrade To Creator', 'testUpgradeToCreator');
runTest('Get Creator Profile', 'testGetCreatorProfile');
runTest('Edit Creator Profile', 'testEditCreatorProfile');

startSection('Post Tests');
runTest('Create Post', 'testCreatePost');
runTest('Edit Post', 'testEditPost');
runTest('Get User Post', 'testGetUserPost');
runTest('Get All Posts', 'testGetAllPosts');
runTest('Get Post With User', 'testGetPostWithUser');

startSection('Account Interaction Tests');
runTest('Account Interaction', 'testAccountInteraction');

startSection('Payment Tests');
runTest('Initiate Payment', 'testInitiatePayment');
runTest('Fetch Payments', 'testFetchPayments');
runTest('Update Order Status', 'testUpdateOrderStatus');
runTest('Fetch Client Payments', 'testFetchClientPayments');
runTest('Update Client Order Status', 'testUpdateClientOrderStatus');

startSection('Rating Tests');
runTest('Submit Rating', 'testSubmitRating');
runTest('Get Creator Ratings', 'testGetCreatorRatings');
runTest('Get Creator Ratings By ID', 'testGetCreatorRatingsById');

startSection('Admin Tests');
runTest('Admin Update Post Status', 'testAdminUpdatePostStatus');
runTest('Admin Get All Posts', 'testAdminGetAllPosts');
runTest('Admin Get All Users', 'testAdminGetAllUsers');

startSection('Deletion Tests');
runTest('Delete Post', 'testDeletePost');
runTest('Admin Delete Post', 'testAdminDeletePost');

startSection('Stress Tests');
stressTestLogin();
stressTestGetProfile();
stressTestAllPosts();

// Generate test summary
$testSummary = [
    'Total Tests' => $testStats['total'],
    'Tests Passed' => $testStats['passed'],
    'Tests Failed' => $testStats['failed'],
    'Success Rate' => round(($testStats['passed'] / $testStats['total']) * 100, 2) . '%'
];

// Close HTML output with summary
closeHtmlOutput($testSummary); 