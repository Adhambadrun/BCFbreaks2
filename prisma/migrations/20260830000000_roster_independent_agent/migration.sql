-- =============================================================================
-- Roster alignment: Independent Agent role + full-name column.
--
--   1. Adds 'INDEPENDENT' to the Role enum (Dominick Grant, CAI 1).
--   2. Adds User.fullName so the canonical roster's full name is persisted
--      alongside the display name (User.name remains the first name).
-- =============================================================================

-- AddEnumValue
ALTER TYPE "Role" ADD VALUE 'INDEPENDENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
