-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');

-- Create enum for stop status
CREATE TYPE public.stop_status AS ENUM ('pending', 'picked', 'delivered');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Create stops table for pickups/deliveries
CREATE TABLE public.stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pickup information
    pickup_address TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    
    -- Delivery information
    delivery_address TEXT NOT NULL,
    delivery_lat DOUBLE PRECISION NOT NULL,
    delivery_lng DOUBLE PRECISION NOT NULL,
    
    -- Client information
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_notes TEXT,
    
    -- Assignment and status
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status stop_status DEFAULT 'pending' NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    picked_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Created by admin
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create driver_locations table for real-time tracking
CREATE TABLE public.driver_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Function to get user's profile ID
CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for stops
CREATE POLICY "Admins can do everything with stops"
ON public.stops FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their assigned stops"
ON public.stops FOR SELECT
USING (driver_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Drivers can update their assigned stops"
ON public.stops FOR UPDATE
USING (driver_id = public.get_profile_id(auth.uid()))
WITH CHECK (driver_id = public.get_profile_id(auth.uid()));

-- RLS Policies for driver_locations
CREATE POLICY "Admins can view all locations"
ON public.driver_locations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view and manage their own location"
ON public.driver_locations FOR ALL
USING (driver_id = public.get_profile_id(auth.uid()));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stops_updated_at
    BEFORE UPDATE ON public.stops
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_locations_updated_at
    BEFORE UPDATE ON public.driver_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for stops and driver_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.stops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();