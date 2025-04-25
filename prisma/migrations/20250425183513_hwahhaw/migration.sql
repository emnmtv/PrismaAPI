-- AlterTable
ALTER TABLE `analyticsdata` ADD COLUMN `avgEngagementTime` DOUBLE NULL,
    ADD COLUMN `bounceRate` DOUBLE NULL,
    ADD COLUMN `conversionRate` DOUBLE NULL,
    ADD COLUMN `deviceBreakdown` TEXT NULL,
    ADD COLUMN `locationData` TEXT NULL,
    ADD COLUMN `referrerData` TEXT NULL,
    ADD COLUMN `uniqueVisitors` INTEGER NULL;

-- AlterTable
ALTER TABLE `engagement` ADD COLUMN `deviceInfo` VARCHAR(191) NULL,
    ADD COLUMN `exitUrl` VARCHAR(191) NULL,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `referrerUrl` VARCHAR(191) NULL,
    ADD COLUMN `sessionId` VARCHAR(191) NULL;
