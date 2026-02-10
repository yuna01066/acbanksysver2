
-- Add project_type column to projects table
ALTER TABLE public.projects 
ADD COLUMN project_type text NOT NULL DEFAULT 'client';

-- Add notion_url column for internal projects
ALTER TABLE public.projects 
ADD COLUMN notion_url text;

-- Add linked_project_id for resale cases (internal purchase linked to client sale)
ALTER TABLE public.projects 
ADD COLUMN linked_project_id uuid REFERENCES public.projects(id);

-- Add comment for clarity
COMMENT ON COLUMN public.projects.project_type IS 'client (매출) or internal (매입)';
COMMENT ON COLUMN public.projects.linked_project_id IS 'Links internal purchase project to client sale project for resale cases';
