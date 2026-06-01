-- Fix: Add missing DELETE policy for event_performances
-- Admin can delete any performance
CREATE POLICY "Allow admin insert/update/delete performances" ON event_performances
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
