/*
  Warnings:

  - You are about to drop the column `amount` on the `post` table. All the data in the column will be lost.
  - You are about to drop the column `detailedDescription` on the `post` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `post` DROP COLUMN `amount`,
    DROP COLUMN `detailedDescription`,
    DROP COLUMN `remarks`;
