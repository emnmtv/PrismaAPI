/*
  Warnings:

  - You are about to drop the column `audioPlaytime` on the `postview` table. All the data in the column will be lost.
  - You are about to drop the column `audioStartCount` on the `postview` table. All the data in the column will be lost.
  - You are about to drop the column `clickType` on the `postview` table. All the data in the column will be lost.
  - You are about to drop the column `profileOwnerId` on the `profileview` table. All the data in the column will be lost.
  - You are about to drop the `engagementmetrics` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `profileId` to the `ProfileView` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `engagementmetrics` DROP FOREIGN KEY `EngagementMetrics_userId_fkey`;

-- DropForeignKey
ALTER TABLE `postview` DROP FOREIGN KEY `PostView_postId_fkey`;

-- DropForeignKey
ALTER TABLE `postview` DROP FOREIGN KEY `PostView_viewerId_fkey`;

-- DropForeignKey
ALTER TABLE `profileview` DROP FOREIGN KEY `ProfileView_profileOwnerId_fkey`;

-- DropForeignKey
ALTER TABLE `profileview` DROP FOREIGN KEY `ProfileView_viewerId_fkey`;

-- DropIndex
DROP INDEX `PostView_createdAt_idx` ON `postview`;

-- DropIndex
DROP INDEX `ProfileView_createdAt_idx` ON `profileview`;

-- DropIndex
DROP INDEX `ProfileView_profileOwnerId_idx` ON `profileview`;

-- AlterTable
ALTER TABLE `creatorprofile` ADD COLUMN `totalEngagements` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalPostViews` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalProfileViews` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `postview` DROP COLUMN `audioPlaytime`,
    DROP COLUMN `audioStartCount`,
    DROP COLUMN `clickType`,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `referrer` VARCHAR(191) NULL,
    MODIFY `viewerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `profileview` DROP COLUMN `profileOwnerId`,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `profileId` INTEGER NOT NULL,
    ADD COLUMN `referrer` VARCHAR(191) NULL,
    MODIFY `viewerId` INTEGER NULL;

-- DropTable
DROP TABLE `engagementmetrics`;

-- CreateTable
CREATE TABLE `PostEngagement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostEngagement_postId_idx`(`postId`),
    INDEX `PostEngagement_userId_idx`(`userId`),
    INDEX `PostEngagement_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ProfileView_profileId_idx` ON `ProfileView`(`profileId`);

-- AddForeignKey
ALTER TABLE `PostView` ADD CONSTRAINT `PostView_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostEngagement` ADD CONSTRAINT `PostEngagement_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
