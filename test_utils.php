<?php
/**
 * Test Utilities for API Testing
 * 
 * This file provides utility functions for formatting test output in HTML
 */

// Track if we're in a test section
$inTestSection = false;

/**
 * Initialize HTML output 
 * 
 * @param string $title The title of the test suite
 */
function initHtmlOutput($title) {
    echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . htmlspecialchars($title) . '</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        header {
            background-color: #2c3e50;
            color: white;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
        }
        h1 {
            margin: 0;
        }
        .section {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
        }
        .section-header {
            background-color: #3498db;
            color: white;
            padding: 10px 15px;
            margin: 0;
        }
        .test-list {
            padding: 0;
            margin: 0;
        }
        .test-item {
            border-bottom: 1px solid #eee;
            padding: 15px;
            position: relative;
        }
        .test-item:last-child {
            border-bottom: none;
        }
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .test-content {
            display: none;
            padding: 10px;
            background-color: #f9f9f9;
            border-radius: 5px;
            margin-top: 10px;
        }
        .test-content.active {
            display: block;
        }
        .success {
            color: #2ecc71;
        }
        .failure {
            color: #e74c3c;
        }
        .warning {
            color: #f39c12;
        }
        .info {
            color: #3498db;
        }
        .request, .response {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-family: monospace;
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .request {
            background-color: #ecf0f1;
        }
        .response {
            background-color: #f8f9fa;
        }
        .stress-test-results {
            margin-top: 15px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .summary {
            margin-top: 30px;
            padding: 20px;
            background-color: #2c3e50;
            color: white;
            border-radius: 5px;
        }
        .summary table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary th, .summary td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #34495e;
        }
        .summary tbody tr:last-child td {
            border-bottom: none;
        }
        .toggle-btn {
            display: inline-block;
            width: 20px;
            height: 20px;
            line-height: 20px;
            text-align: center;
            background-color: #ddd;
            border-radius: 50%;
            margin-right: 10px;
        }
        .test-pass-icon {
            color: #2ecc71;
            font-weight: bold;
        }
        .test-fail-icon {
            color: #e74c3c;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <header>
        <h1>' . htmlspecialchars($title) . '</h1>
        <div>Test Run: ' . date('Y-m-d H:i:s') . '</div>
    </header>
    <main>';
}

/**
 * Start a new section of tests
 * 
 * @param string $sectionName The name of the section
 */
function startSection($sectionName) {
    if (isset($GLOBALS['inTestSection']) && $GLOBALS['inTestSection']) {
        echo '</div></div>';
        $GLOBALS['inTestSection'] = false;
    }
    
    echo '<div class="section">
        <h2 class="section-header">' . htmlspecialchars($sectionName) . '</h2>
        <div class="test-list">';
}

/**
 * Start a test section
 * 
 * @param string $testName The name of the test
 */
function startTestSection($testName) {
    $GLOBALS['inTestSection'] = true;
    echo '<div class="test-item">
        <div class="test-header" onclick="toggleContent(this)">
            <span><span class="toggle-btn">+</span>' . htmlspecialchars($testName) . '</span>
            <span class="test-status">Running...</span>
        </div>
        <div class="test-content">';
}

/**
 * End a test section
 * 
 * @param bool $success Whether the test passed or failed
 */
function endTestSection($success) {
    echo '</div>';
    $icon = $success ? '<span class="test-pass-icon">✓</span>' : '<span class="test-fail-icon">✗</span>';
    $status = $success ? 'Pass' : 'Fail';
    $statusClass = $success ? 'success' : 'failure';
    
    echo '<script>
        document.currentScript.parentElement.querySelector(".test-status").innerHTML = 
            "' . $icon . ' <span class=\"' . $statusClass . '\">' . $status . '</span>";
    </script>';
    
    $GLOBALS['inTestSection'] = false;
}

/**
 * Format an API request
 * 
 * @param string $url The URL of the request
 * @param string $method The HTTP method
 * @param array $data The request data
 */
function logRequest($url, $method, $data) {
    echo '<div class="request">
        <strong>Request:</strong> ' . htmlspecialchars($method) . ' ' . htmlspecialchars($url) . '
        ' . (!empty($data) ? '<div><strong>Data:</strong> <pre>' . htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT)) . '</pre></div>' : '') . '
    </div>';
}

/**
 * Format an API response
 * 
 * @param int $code The HTTP status code
 * @param mixed $data The response data
 * @param float $time The response time in ms
 */
function logResponse($code, $data, $time) {
    $statusClass = ($code >= 200 && $code < 300) ? 'success' : 'failure';
    
    echo '<div class="response">
        <div><strong>Status:</strong> <span class="' . $statusClass . '">' . htmlspecialchars($code) . '</span></div>
        <div><strong>Time:</strong> ' . htmlspecialchars($time) . 'ms</div>
        <div><strong>Response:</strong> <pre>' . htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT)) . '</pre></div>
    </div>';
}

/**
 * Log a message with a specific status
 * 
 * @param string $message The message to log
 * @param string $type The type of message (success, failure, warning, info)
 */
function logMessage($message, $type = 'info') {
    echo '<div class="' . htmlspecialchars($type) . '">' . htmlspecialchars($message) . '</div>';
}

/**
 * Format stress test results
 * 
 * @param string $endpoint The endpoint tested
 * @param array $results The test results
 */
function logStressTestResults($endpoint, $results) {
    $successRate = $results['success_rate'];
    $statusClass = $successRate >= 90 ? 'success' : ($successRate >= 70 ? 'warning' : 'failure');
    
    echo '<div class="stress-test-results">
        <h3>Stress Test Results for ' . htmlspecialchars($endpoint) . '</h3>
        <div><strong>Success Rate:</strong> <span class="' . $statusClass . '">' . htmlspecialchars($successRate) . '%</span></div>
        <div><strong>Average Time:</strong> ' . htmlspecialchars($results['avg_time']) . 'ms</div>
        <div><strong>Min Time:</strong> ' . htmlspecialchars($results['min_time']) . 'ms</div>
        <div><strong>Max Time:</strong> ' . htmlspecialchars($results['max_time']) . 'ms</div>
        <div><strong>Response Codes:</strong> <pre>' . htmlspecialchars(json_encode($results['response_codes'], JSON_PRETTY_PRINT)) . '</pre></div>
    </div>';
}

/**
 * Close the HTML output with a summary
 * 
 * @param array $summary The test summary
 */
function closeHtmlOutput($summary) {
    if (isset($GLOBALS['inTestSection']) && $GLOBALS['inTestSection']) {
        echo '</div></div>';
        $GLOBALS['inTestSection'] = false;
    }
    
    echo '</div></div>';
    
    echo '<div class="summary">
        <h2>Test Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>';
    
    foreach ($summary as $key => $value) {
        echo '<tr>
            <td>' . htmlspecialchars($key) . '</td>
            <td>' . htmlspecialchars($value) . '</td>
        </tr>';
    }
    
    echo '</tbody>
        </table>
    </div>';
    
    echo '</main>
    <script>
        function toggleContent(element) {
            const content = element.parentElement.querySelector(".test-content");
            const toggleBtn = element.querySelector(".toggle-btn");
            
            content.classList.toggle("active");
            toggleBtn.textContent = content.classList.contains("active") ? "-" : "+";
        }
    </script>
</body>
</html>';
} 