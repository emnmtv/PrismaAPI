<?php
/**
 * Database Seed Script for Prisma App
 * 
 * This script inserts three users with different roles (admin, user, creator)
 * into the MySQL database. All users have the password "123" (bcrypt hashed).
 */

// Database connection details
$host = 'localhost';
$username = 'root';
$password = '';
$database = 'prisma_db';

// Connect to MySQL
$conn = new mysqli($host, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected to database successfully!\n";

// Function to hash password (similar to bcrypt in Node.js)
function hashPassword($password) {
    // Use bcrypt algorithm with cost factor 10 (same as in Node.js bcrypt)
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
}

// Common test password
$plainPassword = '123';
$hashedPassword = hashPassword($plainPassword);

// Sample users data
$users = [
    [
        'email' => 'admin@tuneup.com',
        'password' => $hashedPassword,
        'firstName' => 'Admin',
        'lastName' => 'User',
        'role' => 'admin',
        'verified' => 1
    ],
    [
        'email' => 'user@tuneup.com',
        'password' => $hashedPassword,
        'firstName' => 'Regular',
        'lastName' => 'User',
        'role' => 'user',
        'verified' => 1
    ],
    [
        'email' => 'creator@tuneup.com',
        'password' => $hashedPassword,
        'firstName' => 'Music',
        'lastName' => 'Creator',
        'role' => 'creator',
        'verified' => 1
    ]
];

// Insert users
$userIds = [];
foreach ($users as $user) {
    // Check if user already exists
    $stmt = $conn->prepare("SELECT id FROM User WHERE email = ?");
    $stmt->bind_param("s", $user['email']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        // User exists, get ID and update
        $row = $result->fetch_assoc();
        $userId = $row['id'];
        
        $stmt = $conn->prepare("UPDATE User SET password = ?, firstName = ?, lastName = ?, role = ?, verified = ? WHERE id = ?");
        $stmt->bind_param("ssssi", 
            $user['password'], 
            $user['firstName'], 
            $user['lastName'], 
            $user['role'], 
            $user['verified'],
            $userId
        );
        $stmt->execute();
        
        echo "Updated user {$user['email']} with ID: $userId\n";
    } else {
        // Insert new user
        $stmt = $conn->prepare("INSERT INTO User (email, password, firstName, lastName, role, verified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())");
        $stmt->bind_param("sssssi", 
            $user['email'], 
            $user['password'], 
            $user['firstName'], 
            $user['lastName'], 
            $user['role'], 
            $user['verified']
        );
        $stmt->execute();
        
        $userId = $conn->insert_id;
        echo "Inserted new user {$user['email']} with ID: $userId\n";
    }
    
    $userIds[$user['role']] = $userId;
}

// Create creator profile for the creator user if it doesn't exist
if (isset($userIds['creator'])) {
    $creatorId = $userIds['creator'];
    
    // Check if creator profile exists
    $stmt = $conn->prepare("SELECT id FROM CreatorProfile WHERE userId = ?");
    $stmt->bind_param("i", $creatorId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $offers = "Music Production, Sound Engineering, Live Performance";
    $bio = "Professional musician with over 5 years of experience in the industry.";
    $profession = "Musician";
    $typeOfProfession = "Producer";
    $genre = "Rock, Pop, Electronic";
    
    if ($result->num_rows > 0) {
        // Update existing profile
        $row = $result->fetch_assoc();
        $profileId = $row['id'];
        
        $stmt = $conn->prepare("UPDATE CreatorProfile SET offers = ?, bio = ?, profession = ?, typeOfProfession = ?, genre = ?, updatedAt = NOW() WHERE id = ?");
        $stmt->bind_param("sssssi", 
            $offers, 
            $bio, 
            $profession, 
            $typeOfProfession, 
            $genre,
            $profileId
        );
        $stmt->execute();
        
        echo "Updated creator profile for user with ID: $creatorId\n";
    } else {
        // Create new profile
        $stmt = $conn->prepare("INSERT INTO CreatorProfile (userId, offers, bio, profession, typeOfProfession, genre, creatorLevel, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())");
        $stmt->bind_param("isssss", 
            $creatorId, 
            $offers, 
            $bio, 
            $profession, 
            $typeOfProfession, 
            $genre
        );
        $stmt->execute();
        
        echo "Created creator profile for user with ID: $creatorId\n";
    }
}

$conn->close();
echo "Database seeding completed successfully!\n";
echo "You can now login with:\n";
echo "Admin: admin@tuneup.com (password: 123)\n";
echo "User: user@tuneup.com (password: 123)\n";
echo "Creator: creator@tuneup.com (password: 123)\n";
?> 