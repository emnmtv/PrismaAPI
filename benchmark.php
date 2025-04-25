<?php
/**
 * API Benchmark Tool for Prisma Backend
 * 
 * This script conducts various performance tests on the API endpoints
 */

// Configuration
$BASE_URL = 'http://localhost:3200/auth';
$TEST_DURATION = 60; // Duration of each test in seconds
$RESULTS_FILE = 'benchmark_results_' . date('Y-m-d_H-i-s') . '.json';

// Load testing configurations
$LOAD_TESTS = [
    [
        'name' => 'Light Load',
        'users' => 10,
        'requests_per_second' => 5
    ],
    [
        'name' => 'Medium Load',
        'users' => 25,
        'requests_per_second' => 10
    ],
    [
        'name' => 'Heavy Load',
        'users' => 50,
        'requests_per_second' => 20
    ],
    [
        'name' => 'Extreme Load',
        'users' => 100,
        'requests_per_second' => 30
    ]
];

// Endpoints to test
$ENDPOINTS = [
    [
        'name' => 'Login (User 1)',
        'path' => '/login',
        'method' => 'POST',
        'data' => [
            'email' => 'shizukagremory5@gmail.com',
            'password' => '123456'
        ],
        'auth_required' => false
    ],
    [
        'name' => 'Login (User 2)',
        'path' => '/login',
        'method' => 'POST',
        'data' => [
            'email' => 'mel@gmail.com',
            'password' => '123456'
        ],
        'auth_required' => false
    ],
    [
        'name' => 'Get Posts',
        'path' => '/allpost',
        'method' => 'GET',
        'data' => [],
        'auth_required' => false
    ],
    [
        'name' => 'Get Profile',
        'path' => '/profile',
        'method' => 'GET',
        'data' => [],
        'auth_required' => true
    ]
];

// Use existing verified accounts
$TEST_USERS = [
    'user1' => [
        'email' => 'shizukagremory5@gmail.com',
        'password' => '123456'
    ],
    'user2' => [
        'email' => 'mel@gmail.com',
        'password' => '123456'
    ]
];

// We'll use the first user for authenticated tests
$TEST_USER = $TEST_USERS['user1'];

$USER_TOKEN = null;

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
    
    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);
    
    $info = curl_getinfo($ch);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    $executionTime = round(($endTime - $startTime) * 1000, 2); // in ms
    
    return [
        'data' => $responseData,
        'http_code' => $info['http_code'],
        'execution_time' => $executionTime,
        'error' => $error
    ];
}

/**
 * Register and login a test user
 * 
 * @return string|null JWT token if successful, null otherwise
 */
function setupTestUser() {
    global $TEST_USER;
    
    // Skip registration since we're using an existing account
    echo "Using existing verified account - skipping registration\n";
    
    // Login user
    $loginResponse = apiRequest('/login', 'POST', [
        'email' => $TEST_USER['email'],
        'password' => $TEST_USER['password']
    ]);
    
    if ($loginResponse['http_code'] != 200 || !isset($loginResponse['data']['token'])) {
        echo "Failed to login test user: " . json_encode($loginResponse['data']) . "\n";
        return null;
    }
    
    echo "Successfully logged in with verified account\n";
    return $loginResponse['data']['token'];
}

/**
 * Run a benchmark test on a specific endpoint with specific load parameters
 * 
 * @param array $endpoint Endpoint configuration
 * @param array $loadConfig Load test configuration
 * @return array Benchmark results
 */
function runBenchmark($endpoint, $loadConfig) {
    global $TEST_DURATION, $USER_TOKEN;
    
    $results = [
        'endpoint' => $endpoint['name'],
        'load_config' => $loadConfig['name'],
        'users' => $loadConfig['users'],
        'requests_per_second' => $loadConfig['requests_per_second'],
        'total_requests' => 0,
        'successful_requests' => 0,
        'failed_requests' => 0,
        'avg_response_time' => 0,
        'min_response_time' => PHP_FLOAT_MAX,
        'max_response_time' => 0,
        'response_codes' => [],
        'requests_per_second_achieved' => 0,
        'error_rate' => 0
    ];
    
    $token = $endpoint['auth_required'] ? $USER_TOKEN : null;
    
    if ($endpoint['auth_required'] && !$token) {
        echo "ERROR: Authentication required for {$endpoint['name']} but no token available\n";
        return $results;
    }
    
    $totalTime = 0;
    $startTime = time();
    $endTime = $startTime + $TEST_DURATION;
    
    echo "Starting benchmark for {$endpoint['name']} with {$loadConfig['name']}...\n";
    
    $requestCount = 0;
    
    while (time() < $endTime) {
        $threadStartTime = microtime(true);
        $requestsThisSecond = 0;
        
        // Simulate concurrent users by making multiple requests
        $responses = [];
        for ($i = 0; $i < $loadConfig['users'] && $requestsThisSecond < $loadConfig['requests_per_second']; $i++) {
            $requestData = $endpoint['data'];
            $requestData['__benchmark'] = uniqid(); // Add unique identifier
            
            $responses[] = apiRequest($endpoint['path'], $endpoint['method'], $requestData, $token);
            $requestsThisSecond++;
            $requestCount++;
        }
        
        // Process responses
        foreach ($responses as $response) {
            $results['total_requests']++;
            
            if ($response['http_code'] >= 200 && $response['http_code'] < 300) {
                $results['successful_requests']++;
            } else {
                $results['failed_requests']++;
            }
            
            $totalTime += $response['execution_time'];
            $results['min_response_time'] = min($results['min_response_time'], $response['execution_time']);
            $results['max_response_time'] = max($results['max_response_time'], $response['execution_time']);
            
            if (!isset($results['response_codes'][$response['http_code']])) {
                $results['response_codes'][$response['http_code']] = 0;
            }
            $results['response_codes'][$response['http_code']]++;
        }
        
        // Calculate time to wait for next batch to maintain requests_per_second
        $elapsedTime = microtime(true) - $threadStartTime;
        $targetTime = 1; // 1 second
        
        if ($elapsedTime < $targetTime) {
            usleep(($targetTime - $elapsedTime) * 1000000);
        }
    }
    
    // Calculate final statistics
    $actualDuration = time() - $startTime;
    $results['avg_response_time'] = $totalTime / $results['total_requests'];
    $results['requests_per_second_achieved'] = $results['total_requests'] / $actualDuration;
    $results['error_rate'] = ($results['failed_requests'] / $results['total_requests']) * 100;
    
    echo "Completed benchmark for {$endpoint['name']} with {$loadConfig['name']}\n";
    echo "  Total Requests: {$results['total_requests']}\n";
    echo "  Successful: {$results['successful_requests']}\n";
    echo "  Failed: {$results['failed_requests']}\n";
    echo "  Avg Response Time: {$results['avg_response_time']}ms\n";
    echo "  Requests/Second: {$results['requests_per_second_achieved']}\n";
    echo "  Error Rate: {$results['error_rate']}%\n";
    echo "-------------------------\n";
    
    return $results;
}

/**
 * Save benchmark results to a JSON file
 * 
 * @param array $results Benchmark results
 */
function saveResults($results) {
    global $RESULTS_FILE;
    
    $jsonResults = json_encode($results, JSON_PRETTY_PRINT);
    file_put_contents($RESULTS_FILE, $jsonResults);
    
    echo "Results saved to $RESULTS_FILE\n";
}

/**
 * Generate HTML report from benchmark results
 * 
 * @param array $results Benchmark results
 */
function generateHtmlReport($results) {
    $reportFile = 'benchmark_report_' . date('Y-m-d_H-i-s') . '.html';
    
    $html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .success { color: green; }
        .warning { color: orange; }
        .error { color: red; }
        .chart-container { height: 400px; margin-bottom: 30px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h1>API Benchmark Report</h1>
    <p>Generated on: ' . date('Y-m-d H:i:s') . '</p>
    
    <h2>Summary</h2>
    <table>
        <tr>
            <th>Endpoint</th>
            <th>Load Level</th>
            <th>Requests</th>
            <th>Success Rate</th>
            <th>Avg Response Time</th>
            <th>Requests/Second</th>
        </tr>';
    
    foreach ($results as $result) {
        $successRate = ($result['successful_requests'] / $result['total_requests']) * 100;
        $successClass = $successRate > 95 ? 'success' : ($successRate > 80 ? 'warning' : 'error');
        
        $html .= '
        <tr>
            <td>' . htmlspecialchars($result['endpoint']) . '</td>
            <td>' . htmlspecialchars($result['load_config']) . '</td>
            <td>' . number_format($result['total_requests']) . '</td>
            <td class="' . $successClass . '">' . number_format($successRate, 2) . '%</td>
            <td>' . number_format($result['avg_response_time'], 2) . ' ms</td>
            <td>' . number_format($result['requests_per_second_achieved'], 2) . '</td>
        </tr>';
    }
    
    $html .= '
    </table>
    
    <h2>Response Time by Endpoint</h2>
    <div class="chart-container">
        <canvas id="responseTimeChart"></canvas>
    </div>
    
    <h2>Requests per Second by Endpoint</h2>
    <div class="chart-container">
        <canvas id="rpsChart"></canvas>
    </div>
    
    <h2>Success Rate by Endpoint</h2>
    <div class="chart-container">
        <canvas id="successRateChart"></canvas>
    </div>
    
    <h2>Detailed Results</h2>';
    
    foreach ($results as $result) {
        $successRate = ($result['successful_requests'] / $result['total_requests']) * 100;
        
        $html .= '
    <h3>' . htmlspecialchars($result['endpoint']) . ' - ' . htmlspecialchars($result['load_config']) . '</h3>
    <table>
        <tr>
            <td>Total Requests</td>
            <td>' . number_format($result['total_requests']) . '</td>
        </tr>
        <tr>
            <td>Successful Requests</td>
            <td>' . number_format($result['successful_requests']) . '</td>
        </tr>
        <tr>
            <td>Failed Requests</td>
            <td>' . number_format($result['failed_requests']) . '</td>
        </tr>
        <tr>
            <td>Success Rate</td>
            <td>' . number_format($successRate, 2) . '%</td>
        </tr>
        <tr>
            <td>Average Response Time</td>
            <td>' . number_format($result['avg_response_time'], 2) . ' ms</td>
        </tr>
        <tr>
            <td>Min Response Time</td>
            <td>' . number_format($result['min_response_time'], 2) . ' ms</td>
        </tr>
        <tr>
            <td>Max Response Time</td>
            <td>' . number_format($result['max_response_time'], 2) . ' ms</td>
        </tr>
        <tr>
            <td>Requests per Second</td>
            <td>' . number_format($result['requests_per_second_achieved'], 2) . '</td>
        </tr>
        <tr>
            <td>Error Rate</td>
            <td>' . number_format($result['error_rate'], 2) . '%</td>
        </tr>
        <tr>
            <td>Response Codes</td>
            <td>';
        
        foreach ($result['response_codes'] as $code => $count) {
            $html .= 'HTTP ' . $code . ': ' . $count . '<br>';
        }
        
        $html .= '
            </td>
        </tr>
    </table>';
    }
    
    // Generate JavaScript for charts
    $html .= '
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            // Prepare chart data
            const endpoints = ' . json_encode(array_values(array_unique(array_column($results, 'endpoint')))) . ';
            const loadLevels = ' . json_encode(array_values(array_unique(array_column($results, 'load_config')))) . ';
            const results = ' . json_encode($results) . ';
            
            // Response Time Chart
            const responseTimeCtx = document.getElementById("responseTimeChart").getContext("2d");
            new Chart(responseTimeCtx, {
                type: "bar",
                data: {
                    labels: loadLevels,
                    datasets: endpoints.map((endpoint, index) => ({
                        label: endpoint,
                        data: loadLevels.map(load => {
                            const result = results.find(r => r.endpoint === endpoint && r.load_config === load);
                            return result ? result.avg_response_time : 0;
                        }),
                        backgroundColor: getColor(index, 0.7),
                        borderColor: getColor(index, 1),
                        borderWidth: 1
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Response Time (ms)"
                            }
                        }
                    }
                }
            });
            
            // RPS Chart
            const rpsCtx = document.getElementById("rpsChart").getContext("2d");
            new Chart(rpsCtx, {
                type: "bar",
                data: {
                    labels: loadLevels,
                    datasets: endpoints.map((endpoint, index) => ({
                        label: endpoint,
                        data: loadLevels.map(load => {
                            const result = results.find(r => r.endpoint === endpoint && r.load_config === load);
                            return result ? result.requests_per_second_achieved : 0;
                        }),
                        backgroundColor: getColor(index, 0.7),
                        borderColor: getColor(index, 1),
                        borderWidth: 1
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Requests per Second"
                            }
                        }
                    }
                }
            });
            
            // Success Rate Chart
            const successRateCtx = document.getElementById("successRateChart").getContext("2d");
            new Chart(successRateCtx, {
                type: "bar",
                data: {
                    labels: loadLevels,
                    datasets: endpoints.map((endpoint, index) => ({
                        label: endpoint,
                        data: loadLevels.map(load => {
                            const result = results.find(r => r.endpoint === endpoint && r.load_config === load);
                            return result ? (result.successful_requests / result.total_requests) * 100 : 0;
                        }),
                        backgroundColor: getColor(index, 0.7),
                        borderColor: getColor(index, 1),
                        borderWidth: 1
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: "Success Rate (%)"
                            }
                        }
                    }
                }
            });
            
            // Helper function to generate colors
            function getColor(index, alpha) {
                const colors = [
                    `rgba(54, 162, 235, ${alpha})`,
                    `rgba(255, 99, 132, ${alpha})`,
                    `rgba(75, 192, 192, ${alpha})`,
                    `rgba(255, 159, 64, ${alpha})`,
                    `rgba(153, 102, 255, ${alpha})`,
                    `rgba(255, 205, 86, ${alpha})`,
                    `rgba(201, 203, 207, ${alpha})`
                ];
                return colors[index % colors.length];
            }
        });
    </script>
</body>
</html>';
    
    file_put_contents($reportFile, $html);
    
    echo "HTML report generated: $reportFile\n";
}

// Main execution
echo "Starting API Benchmark\n";
echo "======================================\n";

// Setup test user
echo "Setting up test user...\n";
$USER_TOKEN = setupTestUser();

if (!$USER_TOKEN) {
    echo "Failed to setup test user. Exiting.\n";
    exit(1);
}

echo "Test user setup complete. Running benchmarks...\n";

// Run benchmarks
$allResults = [];

foreach ($ENDPOINTS as $endpoint) {
    foreach ($LOAD_TESTS as $loadConfig) {
        $result = runBenchmark($endpoint, $loadConfig);
        $allResults[] = $result;
    }
}

// Save results and generate report
saveResults($allResults);
generateHtmlReport($allResults);

echo "\n======================================\n";
echo "Benchmark Completed\n";
echo "======================================\n"; 