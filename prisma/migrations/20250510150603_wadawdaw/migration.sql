/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the `copyrightviolation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `copyrightviolation` DROP FOREIGN KEY `CopyrightViolation_postId_fkey`;

-- DropForeignKey
ALTER TABLE `copyrightviolation` DROP FOREIGN KEY `CopyrightViolation_userId_fkey`;

-- AlterTable
ALTER TABLE `creatorprofile` ADD COLUMN `copyrightStrikes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reviewReason` VARCHAR(191) NULL,
    ADD COLUMN `underReview` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `notification` DROP COLUMN `updatedAt`,
    MODIFY `message` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `copyrightviolation`;
