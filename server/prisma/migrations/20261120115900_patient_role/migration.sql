-- PostgreSQL cannot use a new enum value in the same transaction that adds it.
-- Keep this migration separate from the tables that reference PATIENT.
ALTER TYPE "UserRole" ADD VALUE 'PATIENT';
