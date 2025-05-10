/*
  Warnings:

  - You are about to drop the column `adminNotes` on the `copyrightviolation` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedAt` on the `copyrightviolation` table. All the data in the column will be lost.
  - You are about to drop the column `violationType` on the `copyrightviolation` table. All the data in the column will be lost.
  - You are about to drop the column `metaData` on the `notification` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `CopyrightViolation` table without a default value. This is not possible if the table is not empty.
  - Made the column `postId` on table `copyrightviolation` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `copyrightviolation` DROP FOREIGN KEY `CopyrightViolation_postId_fkey`;

-- DropIndex
DROP INDEX `CopyrightViolation_postId_fkey` ON `copyrightviolation`;

-- AlterTable
ALTER TABLE `copyrightviolation` DROP COLUMN `adminNotes`,
    DROP COLUMN `resolvedAt`,
    DROP COLUMN `violationType`,
    ADD COLUMN `reviewNotes` TEXT NULL,
    ADD COLUMN `reviewedBy` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `postId` INTEGER NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `notification` DROP COLUMN `metaData`,
    ADD COLUMN `relatedId` INTEGER NULL,
    ADD COLUMN `relatedType` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AddForeignKey
ALTER TABLE `CopyrightViolation` ADD CONSTRAINT `CopyrightViolation_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
