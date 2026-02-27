-- Create enum for package size
CREATE TYPE public.package_size AS ENUM ('small', 'medium', 'large');

-- Add column to stops table
ALTER TABLE public.stops ADD COLUMN package_size public.package_size NULL DEFAULT NULL;