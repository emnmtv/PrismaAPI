/*
  Warnings:

  - You are about to drop the column `availability` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `earnings` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `equipment` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `experience` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `portfolio` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `ratePerHour` on the `creatorprofile` table. All the data in the column will be lost.
  - You are about to drop the column `specialization` on the `creatorprofile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `creatorprofile` DROP COLUMN `availability`,
    DROP COLUMN `earnings`,
    DROP COLUMN `equipment`,
    DROP COLUMN `experience`,
    DROP COLUMN `portfolio`,
    DROP COLUMN `ratePerHour`,
    DROP COLUMN `specialization`;
