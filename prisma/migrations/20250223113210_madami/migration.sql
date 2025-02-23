-- AlterTable
ALTER TABLE `creatorprofile` ADD COLUMN `availability` VARCHAR(191) NULL,
    ADD COLUMN `equipment` VARCHAR(191) NULL,
    ADD COLUMN `experience` INTEGER NULL,
    ADD COLUMN `portfolio` VARCHAR(191) NULL,
    ADD COLUMN `ratePerHour` DOUBLE NULL,
    ADD COLUMN `specialization` VARCHAR(191) NULL;
