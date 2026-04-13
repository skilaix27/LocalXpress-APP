
ALTER TABLE public.stops 
ADD COLUMN paid_by_client boolean NOT NULL DEFAULT false,
ADD COLUMN paid_by_client_at timestamp with time zone,
ADD COLUMN paid_to_driver boolean NOT NULL DEFAULT false,
ADD COLUMN paid_to_driver_at timestamp with time zone;
