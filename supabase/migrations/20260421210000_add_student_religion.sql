-- Add religion column to students table
ALTER TABLE students
ADD COLUMN IF NOT EXISTS religion TEXT;
