/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedEntityId` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedEntityType` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the `copyrightviolation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `copyrightviolation` DROP FOREIGN KEY `CopyrightViolation_postId_fkey`;

-- DropForeignKey
ALTER TABLE `copyrightviolation` DROP FOREIGN KEY `CopyrightViolation_userId_fkey`;

-- AlterTable
ALTER TABLE `notification` DROP COLUMN `expiresAt`,
    DROP COLUMN `isRead`,
    DROP COLUMN `relatedEntityId`,
    DROP COLUMN `relatedEntityType`,
    DROP COLUMN `severity`,
    ADD COLUMN `metadata` TEXT NULL,
    ADD COLUMN `read` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `relatedId` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `copyrightStrikes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `underReview` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `copyrightviolation`;
