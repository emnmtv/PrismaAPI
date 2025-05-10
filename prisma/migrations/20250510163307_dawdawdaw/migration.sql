-- CreateTable
CREATE TABLE `AdminAnalytics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` VARCHAR(191) NOT NULL,
    `totalUsers` INTEGER NOT NULL DEFAULT 0,
    `newUsers` INTEGER NOT NULL DEFAULT 0,
    `activeUsers` INTEGER NOT NULL DEFAULT 0,
    `totalCreators` INTEGER NOT NULL DEFAULT 0,
    `newCreators` INTEGER NOT NULL DEFAULT 0,
    `totalPosts` INTEGER NOT NULL DEFAULT 0,
    `newPosts` INTEGER NOT NULL DEFAULT 0,
    `totalPayments` INTEGER NOT NULL DEFAULT 0,
    `totalPaymentAmount` DOUBLE NOT NULL DEFAULT 0,
    `platformRevenue` DOUBLE NOT NULL DEFAULT 0,
    `pendingPayments` INTEGER NOT NULL DEFAULT 0,
    `completedPayments` INTEGER NOT NULL DEFAULT 0,
    `totalEngagements` INTEGER NOT NULL DEFAULT 0,
    `creatorProfiles` INTEGER NOT NULL DEFAULT 0,
    `metaData` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminAnalytics_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemRevenue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `originalAmount` DOUBLE NOT NULL,
    `platformFee` DOUBLE NOT NULL,
    `creatorAmount` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `processingDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemRevenue_paymentId_key`(`paymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
