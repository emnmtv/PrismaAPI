/*
  Warnings:

  - You are about to drop the column `copyrightStrikes` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `reviewReason` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `underReview` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `relatedId` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedType` on the `notification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `creatorprofile` DROP COLUMN `copyrightStrikes`,
    DROP COLUMN `reviewReason`,
    DROP COLUMN `underReview`;

-- AlterTable
ALTER TABLE `notification` DROP COLUMN `relatedId`,
    DROP COLUMN `relatedType`,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `relatedEntityId` INTEGER NULL,
    ADD COLUMN `relatedEntityType` VARCHAR(191) NULL,
    ADD COLUMN `severity` VARCHAR(191) NOT NULL DEFAULT 'info',
    MODIFY `message` TEXT NOT NULL;

-- CreateTable
CREATE TABLE `CopyrightViolation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `postId` INTEGER NULL,
    `contentType` VARCHAR(191) NOT NULL,
    `detectionMethod` VARCHAR(191) NOT NULL,
    `violationDetails` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'detected',
    `warningCount` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CopyrightViolation` ADD CONSTRAINT `CopyrightViolation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CopyrightViolation` ADD CONSTRAINT `CopyrightViolation_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
