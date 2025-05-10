-- AlterTable
ALTER TABLE `user` ADD COLUMN `resetCode` VARCHAR(191) NULL,
    ADD COLUMN `resetCodeExpiry` DATETIME(3) NULL;
