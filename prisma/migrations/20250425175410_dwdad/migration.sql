/*
  Warnings:

  - You are about to drop the column `totalEngagements` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `totalPostViews` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `totalProfileViews` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the `postengagement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `postview` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `profileview` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `postengagement` DROP FOREIGN KEY `PostEngagement_postId_fkey`;

-- DropForeignKey
ALTER TABLE `postview` DROP FOREIGN KEY `PostView_postId_fkey`;

-- AlterTable
ALTER TABLE `creatorprofile` DROP COLUMN `totalEngagements`,
    DROP COLUMN `totalPostViews`,
    DROP COLUMN `totalProfileViews`;

-- DropTable
DROP TABLE `postengagement`;

-- DropTable
DROP TABLE `postview`;

-- DropTable
DROP TABLE `profileview`;

-- CreateTable
CREATE TABLE `Engagement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creatorId` INTEGER NOT NULL,
    `viewerId` INTEGER NULL,
    `postId` INTEGER NULL,
    `sourceId` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalyticsData` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creatorId` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `totalDuration` INTEGER NULL,

    UNIQUE INDEX `AnalyticsData_creatorId_date_type_key`(`creatorId`, `date`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Engagement` ADD CONSTRAINT `Engagement_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Engagement` ADD CONSTRAINT `Engagement_viewerId_fkey` FOREIGN KEY (`viewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Engagement` ADD CONSTRAINT `Engagement_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalyticsData` ADD CONSTRAINT `AnalyticsData_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
