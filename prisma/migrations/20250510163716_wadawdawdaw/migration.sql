/*
  Warnings:

  - You are about to drop the `adminanalytics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `systemrevenue` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `payment` ADD COLUMN `adminFee` INTEGER NULL,
    ADD COLUMN `isFeeClaimed` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `adminanalytics`;

-- DropTable
DROP TABLE `systemrevenue`;

-- CreateTable
CREATE TABLE `AppAnalytics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` VARCHAR(191) NOT NULL,
    `totalTransactions` INTEGER NOT NULL DEFAULT 0,
    `totalAmount` INTEGER NOT NULL DEFAULT 0,
    `adminRevenue` INTEGER NOT NULL DEFAULT 0,
    `userCount` INTEGER NOT NULL DEFAULT 0,
    `newUserCount` INTEGER NOT NULL DEFAULT 0,
    `activeUserCount` INTEGER NOT NULL DEFAULT 0,
    `postCount` INTEGER NOT NULL DEFAULT 0,
    `newPostCount` INTEGER NOT NULL DEFAULT 0,
    `engagementCount` INTEGER NOT NULL DEFAULT 0,
    `messageCount` INTEGER NOT NULL DEFAULT 0,
    `copyrightStrikes` INTEGER NOT NULL DEFAULT 0,
    `averageRating` DOUBLE NULL,
    `conversionRate` DOUBLE NULL,
    `topCreators` TEXT NULL,
    `topPosts` TEXT NULL,
    `deviceStats` TEXT NULL,
    `metricBreakdown` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AppAnalytics_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
