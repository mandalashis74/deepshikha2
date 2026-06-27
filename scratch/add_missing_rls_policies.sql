-- ============================================================
-- Add RLS policies for ALL tables that may be missing them
-- This script is idempotent (safe to re-run)
-- ============================================================

-- Helper: skip tables that already have RLS enabled
DO $$ BEGIN
    -- expense_heads
    ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN END; $$;

-- ==========================================
-- 1. expenses — THIS IS THE BLOCKER
-- ==========================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read expenses" ON expenses;
DROP POLICY IF EXISTS "Auth insert expenses" ON expenses;
DROP POLICY IF EXISTS "Auth update expenses" ON expenses;
DROP POLICY IF EXISTS "Auth delete expenses" ON expenses;
CREATE POLICY "Auth read expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update expenses" ON expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete expenses" ON expenses FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 2. expense_heads
-- ==========================================
ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read expense_heads" ON expense_heads;
DROP POLICY IF EXISTS "Auth insert expense_heads" ON expense_heads;
DROP POLICY IF EXISTS "Auth update expense_heads" ON expense_heads;
DROP POLICY IF EXISTS "Auth delete expense_heads" ON expense_heads;
CREATE POLICY "Auth read expense_heads" ON expense_heads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert expense_heads" ON expense_heads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update expense_heads" ON expense_heads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete expense_heads" ON expense_heads FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 3. maintenance_rates
-- ==========================================
ALTER TABLE maintenance_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read maintenance_rates" ON maintenance_rates;
DROP POLICY IF EXISTS "Auth insert maintenance_rates" ON maintenance_rates;
DROP POLICY IF EXISTS "Auth update maintenance_rates" ON maintenance_rates;
DROP POLICY IF EXISTS "Auth delete maintenance_rates" ON maintenance_rates;
CREATE POLICY "Auth read maintenance_rates" ON maintenance_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert maintenance_rates" ON maintenance_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update maintenance_rates" ON maintenance_rates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete maintenance_rates" ON maintenance_rates FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 4. occupancy_history
-- ==========================================
ALTER TABLE occupancy_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read occupancy_history" ON occupancy_history;
DROP POLICY IF EXISTS "Auth insert occupancy_history" ON occupancy_history;
DROP POLICY IF EXISTS "Auth update occupancy_history" ON occupancy_history;
CREATE POLICY "Auth read occupancy_history" ON occupancy_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert occupancy_history" ON occupancy_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update occupancy_history" ON occupancy_history FOR UPDATE TO authenticated USING (true);

-- ==========================================
-- 5. tickets
-- ==========================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read tickets" ON tickets;
DROP POLICY IF EXISTS "Auth insert tickets" ON tickets;
DROP POLICY IF EXISTS "Auth update tickets" ON tickets;
DROP POLICY IF EXISTS "Auth delete tickets" ON tickets;
CREATE POLICY "Auth read tickets" ON tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert tickets" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update tickets" ON tickets FOR UPDATE TO authenticated USING (true);

-- ==========================================
-- 6. ticket_comments
-- ==========================================
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read ticket_comments" ON ticket_comments;
DROP POLICY IF EXISTS "Auth insert ticket_comments" ON ticket_comments;
DROP POLICY IF EXISTS "Auth update ticket_comments" ON ticket_comments;
DROP POLICY IF EXISTS "Auth delete ticket_comments" ON ticket_comments;
CREATE POLICY "Auth read ticket_comments" ON ticket_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert ticket_comments" ON ticket_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update ticket_comments" ON ticket_comments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete ticket_comments" ON ticket_comments FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 7. roles
-- ==========================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read roles" ON roles;
DROP POLICY IF EXISTS "Auth insert roles" ON roles;
DROP POLICY IF EXISTS "Auth update roles" ON roles;
DROP POLICY IF EXISTS "Auth delete roles" ON roles;
CREATE POLICY "Auth read roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert roles" ON roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update roles" ON roles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Auth delete roles" ON roles FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 8. building_config
-- ==========================================
ALTER TABLE building_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read building_config" ON building_config;
DROP POLICY IF EXISTS "Auth update building_config" ON building_config;
CREATE POLICY "Auth read building_config" ON building_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth update building_config" ON building_config FOR UPDATE TO authenticated USING (public.is_admin());

-- ==========================================
-- 9. committee_members
-- ==========================================
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read committee_members" ON committee_members;
DROP POLICY IF EXISTS "Auth insert committee_members" ON committee_members;
DROP POLICY IF EXISTS "Auth update committee_members" ON committee_members;
DROP POLICY IF EXISTS "Auth delete committee_members" ON committee_members;
CREATE POLICY "Auth read committee_members" ON committee_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert committee_members" ON committee_members FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update committee_members" ON committee_members FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Auth delete committee_members" ON committee_members FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 10. committee_positions
-- ==========================================
ALTER TABLE committee_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read committee_positions" ON committee_positions;
DROP POLICY IF EXISTS "Auth insert committee_positions" ON committee_positions;
DROP POLICY IF EXISTS "Auth update committee_positions" ON committee_positions;
CREATE POLICY "Auth read committee_positions" ON committee_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert committee_positions" ON committee_positions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update committee_positions" ON committee_positions FOR UPDATE TO authenticated USING (public.is_admin());

-- ==========================================
-- 11. committee_handovers
-- ==========================================
ALTER TABLE committee_handovers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read committee_handovers" ON committee_handovers;
DROP POLICY IF EXISTS "Auth insert committee_handovers" ON committee_handovers;
DROP POLICY IF EXISTS "Auth update committee_handovers" ON committee_handovers;
CREATE POLICY "Auth read committee_handovers" ON committee_handovers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert committee_handovers" ON committee_handovers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update committee_handovers" ON committee_handovers FOR UPDATE TO authenticated USING (true);

-- ==========================================
-- 12. handover_checklist
-- ==========================================
ALTER TABLE handover_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read handover_checklist" ON handover_checklist;
DROP POLICY IF EXISTS "Auth insert handover_checklist" ON handover_checklist;
DROP POLICY IF EXISTS "Auth update handover_checklist" ON handover_checklist;
CREATE POLICY "Auth read handover_checklist" ON handover_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert handover_checklist" ON handover_checklist FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update handover_checklist" ON handover_checklist FOR UPDATE TO authenticated USING (true);

-- ==========================================
-- 13. community_posts
-- ==========================================
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read community_posts" ON community_posts;
DROP POLICY IF EXISTS "Auth insert community_posts" ON community_posts;
DROP POLICY IF EXISTS "Auth update community_posts" ON community_posts;
DROP POLICY IF EXISTS "Auth delete community_posts" ON community_posts;
CREATE POLICY "Auth read community_posts" ON community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert community_posts" ON community_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update community_posts" ON community_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.is_admin());
CREATE POLICY "Auth delete community_posts" ON community_posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_admin());

-- ==========================================
-- 14. community_replies
-- ==========================================
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read community_replies" ON community_replies;
DROP POLICY IF EXISTS "Auth insert community_replies" ON community_replies;
DROP POLICY IF EXISTS "Auth update community_replies" ON community_replies;
DROP POLICY IF EXISTS "Auth delete community_replies" ON community_replies;
CREATE POLICY "Auth read community_replies" ON community_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert community_replies" ON community_replies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update community_replies" ON community_replies FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.is_admin());
CREATE POLICY "Auth delete community_replies" ON community_replies FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_admin());

-- ==========================================
-- 15. community_notifications
-- ==========================================
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read community_notifications" ON community_notifications;
DROP POLICY IF EXISTS "Auth insert community_notifications" ON community_notifications;
CREATE POLICY "Auth read community_notifications" ON community_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert community_notifications" ON community_notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ==========================================
-- 16. community_upvotes
-- ==========================================
ALTER TABLE community_upvotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read community_upvotes" ON community_upvotes;
DROP POLICY IF EXISTS "Auth insert community_upvotes" ON community_upvotes;
DROP POLICY IF EXISTS "Auth delete community_upvotes" ON community_upvotes;
CREATE POLICY "Auth read community_upvotes" ON community_upvotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert community_upvotes" ON community_upvotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete community_upvotes" ON community_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==========================================
-- 17. community_reports
-- ==========================================
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read community_reports" ON community_reports;
DROP POLICY IF EXISTS "Auth insert community_reports" ON community_reports;
DROP POLICY IF EXISTS "Auth update community_reports" ON community_reports;
CREATE POLICY "Auth read community_reports" ON community_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert community_reports" ON community_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update community_reports" ON community_reports FOR UPDATE TO authenticated USING (public.is_admin());

-- ==========================================
-- 18. community_categories
-- ==========================================
ALTER TABLE community_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read community_categories" ON community_categories;
DROP POLICY IF EXISTS "Auth insert community_categories" ON community_categories;
CREATE POLICY "Auth read community_categories" ON community_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert community_categories" ON community_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ==========================================
-- 19. meetings
-- ==========================================
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read meetings" ON meetings;
DROP POLICY IF EXISTS "Auth insert meetings" ON meetings;
DROP POLICY IF EXISTS "Auth update meetings" ON meetings;
DROP POLICY IF EXISTS "Auth delete meetings" ON meetings;
CREATE POLICY "Auth read meetings" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert meetings" ON meetings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update meetings" ON meetings FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Auth delete meetings" ON meetings FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 20. meeting_attendance
-- ==========================================
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read meeting_attendance" ON meeting_attendance;
DROP POLICY IF EXISTS "Auth insert meeting_attendance" ON meeting_attendance;
DROP POLICY IF EXISTS "Auth update meeting_attendance" ON meeting_attendance;
CREATE POLICY "Auth read meeting_attendance" ON meeting_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert meeting_attendance" ON meeting_attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update meeting_attendance" ON meeting_attendance FOR UPDATE TO authenticated USING (public.is_admin());

-- ==========================================
-- 21. resolutions
-- ==========================================
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read resolutions" ON resolutions;
DROP POLICY IF EXISTS "Auth insert resolutions" ON resolutions;
DROP POLICY IF EXISTS "Auth update resolutions" ON resolutions;
CREATE POLICY "Auth read resolutions" ON resolutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert resolutions" ON resolutions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update resolutions" ON resolutions FOR UPDATE TO authenticated USING (public.is_admin());

-- ==========================================
-- 22. meeting_acknowledgments
-- ==========================================
ALTER TABLE meeting_acknowledgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read meeting_acknowledgments" ON meeting_acknowledgments;
DROP POLICY IF EXISTS "Auth insert meeting_acknowledgments" ON meeting_acknowledgments;
CREATE POLICY "Auth read meeting_acknowledgments" ON meeting_acknowledgments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert meeting_acknowledgments" ON meeting_acknowledgments FOR INSERT TO authenticated WITH CHECK (true);

-- ==========================================
-- 23. cultural_events / events tables
-- ==========================================
ALTER TABLE cultural_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read cultural_events" ON cultural_events;
DROP POLICY IF EXISTS "Auth insert cultural_events" ON cultural_events;
DROP POLICY IF EXISTS "Auth update cultural_events" ON cultural_events;
CREATE POLICY "Auth read cultural_events" ON cultural_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert cultural_events" ON cultural_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cultural_events" ON cultural_events FOR UPDATE TO authenticated USING (true);

-- event_schedules
ALTER TABLE event_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_schedules" ON event_schedules;
DROP POLICY IF EXISTS "Auth insert event_schedules" ON event_schedules;
DROP POLICY IF EXISTS "Auth update event_schedules" ON event_schedules;
CREATE POLICY "Auth read event_schedules" ON event_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_schedules" ON event_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_schedules" ON event_schedules FOR UPDATE TO authenticated USING (true);

-- event_vendors
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_vendors" ON event_vendors;
DROP POLICY IF EXISTS "Auth insert event_vendors" ON event_vendors;
DROP POLICY IF EXISTS "Auth update event_vendors" ON event_vendors;
CREATE POLICY "Auth read event_vendors" ON event_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_vendors" ON event_vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_vendors" ON event_vendors FOR UPDATE TO authenticated USING (true);

-- event_volunteers
ALTER TABLE event_volunteers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_volunteers" ON event_volunteers;
DROP POLICY IF EXISTS "Auth insert event_volunteers" ON event_volunteers;
DROP POLICY IF EXISTS "Auth update event_volunteers" ON event_volunteers;
CREATE POLICY "Auth read event_volunteers" ON event_volunteers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_volunteers" ON event_volunteers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_volunteers" ON event_volunteers FOR UPDATE TO authenticated USING (true);

-- event_competitions
ALTER TABLE event_competitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_competitions" ON event_competitions;
DROP POLICY IF EXISTS "Auth insert event_competitions" ON event_competitions;
DROP POLICY IF EXISTS "Auth update event_competitions" ON event_competitions;
CREATE POLICY "Auth read event_competitions" ON event_competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_competitions" ON event_competitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_competitions" ON event_competitions FOR UPDATE TO authenticated USING (true);

-- event_performances
ALTER TABLE event_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_performances" ON event_performances;
DROP POLICY IF EXISTS "Auth insert event_performances" ON event_performances;
DROP POLICY IF EXISTS "Auth update event_performances" ON event_performances;
CREATE POLICY "Auth read event_performances" ON event_performances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_performances" ON event_performances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_performances" ON event_performances FOR UPDATE TO authenticated USING (true);

-- event_gallery
ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_gallery" ON event_gallery;
DROP POLICY IF EXISTS "Auth insert event_gallery" ON event_gallery;
DROP POLICY IF EXISTS "Auth update event_gallery" ON event_gallery;
DROP POLICY IF EXISTS "Auth delete event_gallery" ON event_gallery;
CREATE POLICY "Auth read event_gallery" ON event_gallery FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_gallery" ON event_gallery FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_gallery" ON event_gallery FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete event_gallery" ON event_gallery FOR DELETE TO authenticated USING (public.is_admin());

-- event_scores
ALTER TABLE event_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_scores" ON event_scores;
DROP POLICY IF EXISTS "Auth insert event_scores" ON event_scores;
DROP POLICY IF EXISTS "Auth update event_scores" ON event_scores;
CREATE POLICY "Auth read event_scores" ON event_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_scores" ON event_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_scores" ON event_scores FOR UPDATE TO authenticated USING (true);

-- event_votes
ALTER TABLE event_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_votes" ON event_votes;
DROP POLICY IF EXISTS "Auth insert event_votes" ON event_votes;
DROP POLICY IF EXISTS "Auth delete event_votes" ON event_votes;
CREATE POLICY "Auth read event_votes" ON event_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_votes" ON event_votes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete event_votes" ON event_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- event_judges
ALTER TABLE event_judges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_judges" ON event_judges;
DROP POLICY IF EXISTS "Auth insert event_judges" ON event_judges;
CREATE POLICY "Auth read event_judges" ON event_judges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_judges" ON event_judges FOR INSERT TO authenticated WITH CHECK (true);

-- event_visitor_passes
ALTER TABLE event_visitor_passes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_visitor_passes" ON event_visitor_passes;
DROP POLICY IF EXISTS "Auth insert event_visitor_passes" ON event_visitor_passes;
DROP POLICY IF EXISTS "Auth update event_visitor_passes" ON event_visitor_passes;
CREATE POLICY "Auth read event_visitor_passes" ON event_visitor_passes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_visitor_passes" ON event_visitor_passes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_visitor_passes" ON event_visitor_passes FOR UPDATE TO authenticated USING (true);

-- event_notifications
ALTER TABLE event_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_notifications" ON event_notifications;
DROP POLICY IF EXISTS "Auth insert event_notifications" ON event_notifications;
CREATE POLICY "Auth read event_notifications" ON event_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_notifications" ON event_notifications FOR INSERT TO authenticated WITH CHECK (true);

-- event_food_coupons
ALTER TABLE event_food_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read event_food_coupons" ON event_food_coupons;
DROP POLICY IF EXISTS "Auth insert event_food_coupons" ON event_food_coupons;
DROP POLICY IF EXISTS "Auth update event_food_coupons" ON event_food_coupons;
CREATE POLICY "Auth read event_food_coupons" ON event_food_coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert event_food_coupons" ON event_food_coupons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_food_coupons" ON event_food_coupons FOR UPDATE TO authenticated USING (true);

-- food_coupon_registrations
ALTER TABLE food_coupon_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read food_coupon_registrations" ON food_coupon_registrations;
DROP POLICY IF EXISTS "Auth insert food_coupon_registrations" ON food_coupon_registrations;
CREATE POLICY "Auth read food_coupon_registrations" ON food_coupon_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert food_coupon_registrations" ON food_coupon_registrations FOR INSERT TO authenticated WITH CHECK (true);

-- ==========================================
-- 24. assets, parking, polls, visitors, vendors, security (Phase 3/4 modules)
-- ==========================================
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read assets" ON assets;
DROP POLICY IF EXISTS "Auth insert assets" ON assets;
DROP POLICY IF EXISTS "Auth update assets" ON assets;
DROP POLICY IF EXISTS "Auth delete assets" ON assets;
CREATE POLICY "Auth read assets" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert assets" ON assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update assets" ON assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete assets" ON assets FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE parking_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read parking_slots" ON parking_slots;
DROP POLICY IF EXISTS "Auth insert parking_slots" ON parking_slots;
DROP POLICY IF EXISTS "Auth update parking_slots" ON parking_slots;
CREATE POLICY "Auth read parking_slots" ON parking_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert parking_slots" ON parking_slots FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update parking_slots" ON parking_slots FOR UPDATE TO authenticated USING (public.is_admin());

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read polls" ON polls;
DROP POLICY IF EXISTS "Auth insert polls" ON polls;
DROP POLICY IF EXISTS "Auth update polls" ON polls;
CREATE POLICY "Auth read polls" ON polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert polls" ON polls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update polls" ON polls FOR UPDATE TO authenticated USING (public.is_admin());

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read poll_votes" ON poll_votes;
DROP POLICY IF EXISTS "Auth insert poll_votes" ON poll_votes;
DROP POLICY IF EXISTS "Auth delete poll_votes" ON poll_votes;
CREATE POLICY "Auth read poll_votes" ON poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert poll_votes" ON poll_votes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete poll_votes" ON poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read visitor_passes" ON visitor_passes;
DROP POLICY IF EXISTS "Auth insert visitor_passes" ON visitor_passes;
DROP POLICY IF EXISTS "Auth update visitor_passes" ON visitor_passes;
CREATE POLICY "Auth read visitor_passes" ON visitor_passes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert visitor_passes" ON visitor_passes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update visitor_passes" ON visitor_passes FOR UPDATE TO authenticated USING (true);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read vendors" ON vendors;
DROP POLICY IF EXISTS "Auth insert vendors" ON vendors;
DROP POLICY IF EXISTS "Auth update vendors" ON vendors;
DROP POLICY IF EXISTS "Auth delete vendors" ON vendors;
CREATE POLICY "Auth read vendors" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vendors" ON vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vendors" ON vendors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete vendors" ON vendors FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 25. security & gate
-- ==========================================
ALTER TABLE security_personnel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read security_personnel" ON security_personnel;
DROP POLICY IF EXISTS "Auth insert security_personnel" ON security_personnel;
DROP POLICY IF EXISTS "Auth update security_personnel" ON security_personnel;
CREATE POLICY "Auth read security_personnel" ON security_personnel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert security_personnel" ON security_personnel FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Auth update security_personnel" ON security_personnel FOR UPDATE TO authenticated USING (public.is_admin());

ALTER TABLE monthly_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read monthly_staff" ON monthly_staff;
DROP POLICY IF EXISTS "Auth insert monthly_staff" ON monthly_staff;
DROP POLICY IF EXISTS "Auth update monthly_staff" ON monthly_staff;
CREATE POLICY "Auth read monthly_staff" ON monthly_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert monthly_staff" ON monthly_staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update monthly_staff" ON monthly_staff FOR UPDATE TO authenticated USING (true);

ALTER TABLE gate_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read gate_log" ON gate_log;
DROP POLICY IF EXISTS "Auth insert gate_log" ON gate_log;
DROP POLICY IF EXISTS "Auth update gate_log" ON gate_log;
CREATE POLICY "Auth read gate_log" ON gate_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert gate_log" ON gate_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update gate_log" ON gate_log FOR UPDATE TO authenticated USING (true);

-- ==========================================
-- 26. compliance & documents
-- ==========================================
ALTER TABLE compliance_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read compliance_calendar" ON compliance_calendar;
DROP POLICY IF EXISTS "Auth insert compliance_calendar" ON compliance_calendar;
DROP POLICY IF EXISTS "Auth update compliance_calendar" ON compliance_calendar;
CREATE POLICY "Auth read compliance_calendar" ON compliance_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert compliance_calendar" ON compliance_calendar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update compliance_calendar" ON compliance_calendar FOR UPDATE TO authenticated USING (true);

ALTER TABLE document_vault ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read document_vault" ON document_vault;
DROP POLICY IF EXISTS "Auth insert document_vault" ON document_vault;
DROP POLICY IF EXISTS "Auth update document_vault" ON document_vault;
DROP POLICY IF EXISTS "Auth delete document_vault" ON document_vault;
CREATE POLICY "Auth read document_vault" ON document_vault FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert document_vault" ON document_vault FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update document_vault" ON document_vault FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete document_vault" ON document_vault FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 27. push_subscriptions
-- ==========================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Auth insert push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Auth delete push_subscriptions" ON push_subscriptions;
CREATE POLICY "Auth read push_subscriptions" ON push_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert push_subscriptions" ON push_subscriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete push_subscriptions" ON push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==========================================
-- 28. maintenance_schedules (phase 3)
-- ==========================================
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read maintenance_schedules" ON maintenance_schedules;
DROP POLICY IF EXISTS "Auth insert maintenance_schedules" ON maintenance_schedules;
DROP POLICY IF EXISTS "Auth update maintenance_schedules" ON maintenance_schedules;
CREATE POLICY "Auth read maintenance_schedules" ON maintenance_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert maintenance_schedules" ON maintenance_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update maintenance_schedules" ON maintenance_schedules FOR UPDATE TO authenticated USING (true);

-- ==========================================
-- 29. app_secrets
-- ==========================================
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read app_secrets" ON app_secrets;
DROP POLICY IF EXISTS "Auth update app_secrets" ON app_secrets;
CREATE POLICY "Auth read app_secrets" ON app_secrets FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Auth update app_secrets" ON app_secrets FOR UPDATE TO authenticated USING (public.is_admin());
