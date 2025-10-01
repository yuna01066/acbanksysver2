-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can manage panel sizes" ON panel_sizes;

-- Create new policy allowing all users to manage panel sizes (for admin pages)
CREATE POLICY "Anyone can manage panel sizes"
ON panel_sizes
FOR ALL
USING (true)
WITH CHECK (true);