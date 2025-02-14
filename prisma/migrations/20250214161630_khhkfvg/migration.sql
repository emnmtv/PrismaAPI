/*
  Warnings:

  - Added the required column `amount` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `detailedDescription` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remarks` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `post` ADD COLUMN `amount` DOUBLE NOT NULL,
    ADD COLUMN `detailedDescription` VARCHAR(191) NOT NULL,
    ADD COLUMN `remarks` VARCHAR(191) NOT NULL;
