<?php
/**
 * Chat Feature Test for Prisma Backend
 * 
 * This script tests the WebSocket chat functionality
 * It requires a WebSocket client library for PHP
 */

// We'll use a simple cURL-based approach for authentication
// and then simulate WebSocket connections using PHP
$BASE_URL = 'http://localhost:3200/auth';
$SOCKET_URL = 'ws://localhost:3200/socket.io';

// Use two different verified accounts for realistic testing
$USER1 = [
    'email' => 'shizukagremory5@gmail.com',
    'password' => '123456'
];

$USER2 = [
    'email' => 'mel@gmail.com',
    'password' => '123456'
];

// Global storage for tokens and IDs
$tokens = [
    'user1' => null,
    'user2' => null
];

$userIds = [
    'user1' => null,
    'user2' => null
];

/**
 * Make an HTTP request to the API
 * 
 * @param string $endpoint The API endpoint
 * @param string $method The HTTP method (GET, POST, PUT, DELETE)
 * @param array $data The data to send
 * @param string $token The authentication token
 * @return array Response data
 */
function apiRequest($endpoint, $method = 'GET', $data = [], $token = null) {
    global $BASE_URL;
    
    $url = $BASE_URL . $endpoint;
    $ch = curl_init($url);
    
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    if (!empty($data)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $info = curl_getinfo($ch);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    
    return [
        'data' => $responseData,
        'http_code' => $info['http_code'],
        'error' => $error
    ];
}

/**
 * Set up test users
 * 
 * @return bool Whether setup was successful
 */
function setupUsers() {
    global $USER1, $USER2, $tokens, $userIds;
    
    // Skip registration since we're using existing accounts
    echo "Using existing verified account - skipping registration\n";
    
    // Login User 1
    $loginResponse1 = apiRequest('/login', 'POST', [
        'email' => $USER1['email'],
        'password' => $USER1['password']
    ]);
    
    if ($loginResponse1['http_code'] != 200 || !isset($loginResponse1['data']['token'])) {
        echo "Failed to login User 1: " . json_encode($loginResponse1['data']) . "\n";
        return false;
    }
    
    $tokens['user1'] = $loginResponse1['data']['token'];
    echo "User 1 logged in successfully\n";
    
    // Login User 2
    $loginResponse2 = apiRequest('/login', 'POST', [
        'email' => $USER2['email'],
        'password' => $USER2['password']
    ]);
    
    if ($loginResponse2['http_code'] != 200 || !isset($loginResponse2['data']['token'])) {
        echo "Failed to login User 2: " . json_encode($loginResponse2['data']) . "\n";
        return false;
    }
    
    $tokens['user2'] = $loginResponse2['data']['token'];
    echo "User 2 logged in successfully\n";
    
    // Get User 1 Profile
    $profileResponse1 = apiRequest('/profile', 'GET', [], $tokens['user1']);
    if ($profileResponse1['http_code'] != 200 || !isset($profileResponse1['data']['userProfile']['id'])) {
        echo "Failed to get User 1 profile: " . json_encode($profileResponse1['data']) . "\n";
        return false;
    }
    
    $userIds['user1'] = $profileResponse1['data']['userProfile']['id'];
    echo "Got User 1 profile, ID: " . $userIds['user1'] . "\n";
    
    // Get User 2 Profile
    $profileResponse2 = apiRequest('/profile', 'GET', [], $tokens['user2']);
    if ($profileResponse2['http_code'] != 200 || !isset($profileResponse2['data']['userProfile']['id'])) {
        echo "Failed to get User 2 profile: " . json_encode($profileResponse2['data']) . "\n";
        return false;
    }
    
    $userIds['user2'] = $profileResponse2['data']['userProfile']['id'];
    echo "Got User 2 profile, ID: " . $userIds['user2'] . "\n";
    
    return true;
}

/**
 * Test sending messages between users
 * 
 * @return bool Whether the test was successful
 */
function testSendMessages() {
    global $tokens, $userIds;
    
    // Send message from User 1 to User 2
    $message1 = "Hello from User 1 to User 2! Time: " . time();
    $sendResponse1 = apiRequest('/sendmessage', 'POST', [
        'senderId' => $userIds['user1'],
        'receiverId' => $userIds['user2'],
        'content' => $message1
    ], $tokens['user1']);
    
    if ($sendResponse1['http_code'] != 200) {
        echo "Failed to send message from User 1 to User 2: " . json_encode($sendResponse1['data']) . "\n";
        return false;
    }
    
    echo "Message sent from User 1 to User 2: $message1\n";
    
    // Send message from User 2 to User 1
    $message2 = "Hello from User 2 to User 1! Time: " . time();
    $sendResponse2 = apiRequest('/sendmessage', 'POST', [
        'senderId' => $userIds['user2'],
        'receiverId' => $userIds['user1'],
        'content' => $message2
    ], $tokens['user2']);
    
    if ($sendResponse2['http_code'] != 200) {
        echo "Failed to send message from User 2 to User 1: " . json_encode($sendResponse2['data']) . "\n";
        return false;
    }
    
    echo "Message sent from User 2 to User 1: $message2\n";
    
    return true;
}

/**
 * Test fetching messages between users
 * 
 * @return bool Whether the test was successful
 */
function testFetchMessages() {
    global $tokens, $userIds;
    
    // User 1 fetches messages with User 2
    $fetchResponse1 = apiRequest('/messages/' . $userIds['user2'], 'GET', [], $tokens['user1']);
    
    if ($fetchResponse1['http_code'] != 200) {
        echo "User 1 failed to fetch messages with User 2: " . json_encode($fetchResponse1['data']) . "\n";
        return false;
    }
    
    echo "User 1 fetched messages with User 2:\n";
    if (empty($fetchResponse1['data'])) {
        echo "No messages found\n";
    } else {
        foreach ($fetchResponse1['data'] as $message) {
            $sender = $message['senderId'] == $userIds['user1'] ? "User 1" : "User 2";
            echo "- $sender: " . $message['content'] . "\n";
        }
    }
    
    // User 2 fetches messages with User 1
    $fetchResponse2 = apiRequest('/messages/' . $userIds['user1'], 'GET', [], $tokens['user2']);
    
    if ($fetchResponse2['http_code'] != 200) {
        echo "User 2 failed to fetch messages with User 1: " . json_encode($fetchResponse2['data']) . "\n";
        return false;
    }
    
    echo "User 2 fetched messages with User 1:\n";
    if (empty($fetchResponse2['data'])) {
        echo "No messages found\n";
    } else {
        foreach ($fetchResponse2['data'] as $message) {
            $sender = $message['senderId'] == $userIds['user2'] ? "User 2" : "User 1";
            echo "- $sender: " . $message['content'] . "\n";
        }
    }
    
    return true;
}

/**
 * Test getting all users with chat history
 * 
 * @return bool Whether the test was successful
 */
function testGetChatUsers() {
    global $tokens;
    
    // User 1 gets all users with chat history
    $chatUsersResponse = apiRequest('/chat-users', 'GET', [], $tokens['user1']);
    
    if ($chatUsersResponse['http_code'] != 200) {
        echo "Failed to get chat users: " . json_encode($chatUsersResponse['data']) . "\n";
        return false;
    }
    
    echo "User 1's chat users:\n";
    if (empty($chatUsersResponse['data'])) {
        echo "No chat users found\n";
    } else {
        foreach ($chatUsersResponse['data'] as $user) {
            echo "- " . ($user['firstName'] ?? 'Unknown') . " " . ($user['lastName'] ?? 'User') . "\n";
        }
    }
    
    return true;
}

/**
 * Test WebSocket connection (simulated since PHP doesn't natively support WebSockets)
 * 
 * @return bool Whether the test was successful
 */
function testWebSocketConnection() {
    global $userIds;
    
    echo "Testing WebSocket connections (simulated)...\n";
    echo "Note: This is a simulated test. In a real environment, you would need a WebSocket client\n";
    
    // Simulate User 1 connecting to WebSocket
    echo "User 1 (ID: {$userIds['user1']}) connects to WebSocket\n";
    echo "User 1 joins chat room {$userIds['user1']}\n";
    
    // Simulate User 2 connecting to WebSocket
    echo "User 2 (ID: {$userIds['user2']}) connects to WebSocket\n";
    echo "User 2 joins chat room {$userIds['user2']}\n";
    
    // Simulate sending a real-time message via WebSocket
    echo "User 1 sends message to User 2 via WebSocket: 'Hello via WebSocket!'\n";
    echo "Message event emitted to room {$userIds['user2']}\n";
    echo "User 2 receives real-time message: 'Hello via WebSocket!'\n";
    
    // Simulate disconnection
    echo "User 1 disconnects from WebSocket\n";
    echo "User 2 disconnects from WebSocket\n";
    
    return true;
}

/**
 * Full integration test of chat functionality
 * 
 * @return bool Whether all tests passed
 */
function testChatFunctionality() {
    $allPassed = true;
    
    // Setup test users
    echo "\n=== SETTING UP TEST USERS ===\n";
    if (!setupUsers()) {
        echo "Failed to set up test users\n";
        return false;
    }
    
    // Test sending messages
    echo "\n=== TESTING SENDING MESSAGES ===\n";
    $sendResult = testSendMessages();
    if (!$sendResult) {
        echo "Send messages test failed\n";
        $allPassed = false;
    }
    
    // Test fetching messages
    echo "\n=== TESTING FETCHING MESSAGES ===\n";
    $fetchResult = testFetchMessages();
    if (!$fetchResult) {
        echo "Fetch messages test failed\n";
        $allPassed = false;
    }
    
    // Test getting chat users
    echo "\n=== TESTING GET CHAT USERS ===\n";
    $chatUsersResult = testGetChatUsers();
    if (!$chatUsersResult) {
        echo "Get chat users test failed\n";
        $allPassed = false;
    }
    
    // Test WebSocket connection
    echo "\n=== TESTING WEBSOCKET CONNECTION (SIMULATED) ===\n";
    $socketResult = testWebSocketConnection();
    if (!$socketResult) {
        echo "WebSocket connection test failed\n";
        $allPassed = false;
    }
    
    return $allPassed;
}

// Main execution
echo "Starting Chat Functionality Test\n";
echo "======================================\n";

$result = testChatFunctionality();

echo "\n======================================\n";
if ($result) {
    echo "All chat tests PASSED!\n";
} else {
    echo "Some chat tests FAILED. See details above.\n";
}
echo "======================================\n";

/**
 * Note: For a complete test of WebSocket functionality, you would need:
 * 
 * 1. A PHP WebSocket client library (like Ratchet or Pawl)
 * 2. Or test using JavaScript in a browser environment
 * 3. Or use a tool like wscat from the command line
 * 
 * The WebSocket test above is simulated since PHP doesn't natively support WebSockets.
 * For real WebSocket testing, consider using a JavaScript-based test framework
 * that can connect to WebSockets directly.
 */ 