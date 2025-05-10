-- AlterTable
ALTER TABLE `user` ADD COLUMN `restrictionExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `restrictionType` VARCHAR(191) NULL;
