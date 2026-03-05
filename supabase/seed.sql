-- Fundamental Edge Operations Center - Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
INSERT INTO team_members (id, name, role, initials, color) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Brett Caughran', 'Owner & Lead Trainer', 'BC', '#0762C8'),
  ('a1000000-0000-0000-0000-000000000002', 'Paul Teraberry', 'Operations & Financial Manager', 'PT', '#1B365D'),
  ('a1000000-0000-0000-0000-000000000003', 'Jessica Corbin', 'Marketing & Operations Coordinator', 'JC', '#B29838'),
  ('a1000000-0000-0000-0000-000000000004', 'Britt Williams', 'Graphic & Visual Designer', 'BW', '#437F94'),
  ('a1000000-0000-0000-0000-000000000005', 'Nick North', 'Branding Strategist', 'NN', '#647692');

-- ============================================================
-- WORKFLOW TEMPLATES
-- ============================================================
INSERT INTO workflow_templates (id, name, slug, color, total_weeks) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Course Launch', 'course-launch', '#0762C8', 8),
  ('b1000000-0000-0000-0000-000000000002', 'Podcast', 'podcast', '#437F94', 2),
  ('b1000000-0000-0000-0000-000000000003', 'Newsletter', 'newsletter', '#B29838', 2),
  ('b1000000-0000-0000-0000-000000000004', 'Subscription Buildout', 'subscription', '#046A38', 12);

-- ============================================================
-- TEMPLATE TASKS - COURSE LAUNCH
-- ============================================================
-- Phase: Week 8 - Idea & Positioning (phase_order=1, week_offset=0)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Define course outcome statement', 1, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Define target persona', 2, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Confirm format and session dates', 3, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Confirm pricing structure', 4, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Draft and distribute internal course brief', 5, 0, ARRAY['a1000000-0000-0000-0000-000000000001']);

-- Phase: Week 7 - Core Asset Creation (phase_order=2, week_offset=1)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Write all landing page copy', 1, 1, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Format syllabus into branded template', 2, 1, ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Build landing page on Squarespace', 3, 1, ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Design all landing page visual assets', 4, 1, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Send landing page to Nick for brand review', 5, 1, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Review landing page for brand alignment', 6, 1, ARRAY['a1000000-0000-0000-0000-000000000005']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Set up Teachable sales page', 7, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Test full enrollment flow end-to-end', 8, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Verify all tracking links', 9, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Verify automated email triggers', 10, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Customize Teachable confirmation email', 11, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Set up affiliate tracking links', 12, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Format FAQ into branded template', 13, 1, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Publish FAQ and syllabus', 14, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Brief both affiliates on upcoming launch', 15, 1, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Send affiliate promo kits', 16, 1, ARRAY['a1000000-0000-0000-0000-000000000003']);

-- Phase: Week 6 - Announcement & Enrollment Opens (phase_order=3, week_offset=2)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Post course announcement on Twitter and LinkedIn', 1, 2, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Send Email 1 enrollment open announcement', 2, 2, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Pin announcement post on all profiles', 3, 2, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Confirm Teachable enrollment is open', 4, 2, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Monitor for technical issues', 5, 2, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Instructor promotes to their network', 6, 2, ARRAY['a1000000-0000-0000-0000-000000000001']);

-- Phase: Weeks 6-5 - Content Production (phase_order=4, week_offset=2)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Record promotional video clips', 1, 2, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Edit and format all video clips with captions and branding', 2, 2, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Design social media graphics', 3, 2, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Upload approved content to content library', 4, 3, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Coordinate video production with instructors', 5, 2, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Schedule all social content across LinkedIn Instagram and X', 6, 3, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Manage and update content library', 7, 3, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Write all 10 emails in launch sequence', 8, 2, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Format and load all emails into email platform', 9, 3, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Send emails for approval', 10, 3, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Notify affiliates and send tracking links', 11, 3, ARRAY['a1000000-0000-0000-0000-000000000003']);

-- Phase: Week 4 - Pre-Close Check (phase_order=5, week_offset=4)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Brief guest instructors on dates and expectations', 1, 4, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Attend 30-min team launch sync', 2, 4, ARRAY['a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000005']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm all social posts scheduled through close', 3, 4, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm Email 1 queued for Week 6', 4, 4, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm landing page live and functional', 5, 4, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Verify all tracking links working', 6, 4, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Verify automated emails firing correctly', 7, 4, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm affiliate referral links live', 8, 4, ARRAY['a1000000-0000-0000-0000-000000000002']);

-- Phase: Weeks 3-2 - Active Sales Window (phase_order=6, week_offset=5)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Monitor email open and click rates daily', 1, 5, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Respond to social comments and DMs within 24 hours', 2, 5, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Post deadline reminder at 1-week mark', 3, 5, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Post deadline reminder at 48-hour mark', 4, 6, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Post deadline reminder on close day', 5, 6, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Monitor enrollment numbers daily', 6, 5, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Flag any technical or payment issues', 7, 5, ARRAY['a1000000-0000-0000-0000-000000000002']);

-- Phase: Week 1 - Final Push and Close (phase_order=7, week_offset=7)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Send Email 8 last 48 hours', 1, 7, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Send Email 9 enrollment closes tonight', 2, 7, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Close enrollment in Teachable', 3, 7, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Send Email 10 waitlist for next cohort', 4, 7, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Log total enrollment count and revenue', 5, 7, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Calculate and process affiliate commissions', 6, 7, ARRAY['a1000000-0000-0000-0000-000000000002']);

-- Phase: Course Start - Handoff (phase_order=8, week_offset=8)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Send student onboarding email', 1, 8, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Send session registration links to all students', 2, 8, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Resend session links before each session', 3, 8, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Confirm all session materials ready', 4, 8, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Confirm recording setup tested', 5, 8, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Hold post-launch debrief within 1 week', 6, 8, ARRAY['a1000000-0000-0000-0000-000000000001']);

-- Phase: Post Course - Wrap Up (phase_order=9, week_offset=10)
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send mid-course pulse survey', 1, 9, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send end-of-course survey', 2, 10, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Follow up with 3-5 students for video testimonials', 3, 10, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Store testimonials in content library', 4, 10, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send congratulations email with badge instructions', 5, 10, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send alumni check-in email 2 weeks after course ends', 6, 11, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Issue digital badges via Accredible', 7, 10, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Submit student list to certificate provider', 8, 10, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Compile and share post-launch performance report', 9, 10, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Design visual testimonial cards', 10, 10, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Format video testimonial clips for social', 11, 10, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Ensure Accredible badge design is on-brand', 12, 10, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Note student demand signals and share with team', 13, 10, ARRAY['a1000000-0000-0000-0000-000000000001']);

-- ============================================================
-- TEMPLATE TASKS - PODCAST
-- ============================================================
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000002', 'Week 1 - Prep & Record', 1, 'Confirm guest and send prep questions', 1, 0, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000002', 'Week 1 - Prep & Record', 1, 'Record episode', 2, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000002', 'Week 1 - Prep & Record', 1, 'Send raw audio to editor', 3, 0, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Review edited episode', 1, 1, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Write show notes and pull quote clips', 2, 1, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Upload to hosting platform and schedule publish', 3, 1, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Episode goes live, post clips on LinkedIn Instagram and X', 4, 1, ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000002', 'Ongoing', 3, 'Format podcast episode clips for social', 1, 1, ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000002', 'Ongoing', 3, 'Maintain podcast artwork to brand standards', 2, 1, ARRAY['a1000000-0000-0000-0000-000000000004']);

-- ============================================================
-- TEMPLATE TASKS - NEWSLETTER
-- ============================================================
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000003', 'Week 1 - Content Gathering', 1, 'Contribute Signal items and Field Notes', 1, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000003', 'Week 1 - Content Gathering', 1, 'Guest contributor submits Something Useful piece', 2, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Assemble issue in template, check links, schedule send', 1, 1, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Review and approve final draft', 2, 1, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Issue sends', 3, 1, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Post snippet on LinkedIn and X', 4, 1, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000003', 'Week 2 - Follow Up', 3, 'Review open and click rates and share with team', 1, 1, ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002']);

-- ============================================================
-- TEMPLATE TASKS - SUBSCRIPTION BUILDOUT
-- ============================================================
INSERT INTO template_tasks (workflow_template_id, phase, phase_order, task_name, task_order, week_offset, owner_ids) VALUES
  ('b1000000-0000-0000-0000-000000000004', 'Planning', 1, 'Define subscription tiers and pricing', 1, 0, ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('b1000000-0000-0000-0000-000000000004', 'Build', 2, 'Build subscription landing page', 1, 2, ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('b1000000-0000-0000-0000-000000000004', 'Build', 2, 'Set up payment and billing infrastructure', 2, 3, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000004', 'Build', 2, 'Write welcome email sequence for new subscribers', 3, 4, ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000004', 'Integration', 3, 'Integrate newsletter platform with subscription', 1, 5, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000004', 'Integration', 3, 'Integrate podcast feed with subscription', 2, 6, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000004', 'Integration', 3, 'Build subscriber dashboard or portal', 3, 7, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000004', 'Testing & Launch', 4, 'Test full subscription signup flow', 1, 9, ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('b1000000-0000-0000-0000-000000000004', 'Testing & Launch', 4, 'Launch subscription to existing audience', 2, 10, ARRAY['a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003']),
  ('b1000000-0000-0000-0000-000000000004', 'Testing & Launch', 4, 'Monitor subscriber growth weekly', 3, 11, ARRAY['a1000000-0000-0000-0000-000000000002']);

-- ============================================================
-- SEED PROJECTS WITH TASKS
-- ============================================================

-- Project 1: AI Accelerator - Cohort 3 (Course Launch, Week 6 of 8)
-- Start date: 6 weeks ago from ~today (2026-03-04), so start = 2026-01-19
INSERT INTO projects (id, name, workflow_template_id, workflow_type, start_date, current_week, status) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'AI Accelerator - Cohort 3', 'b1000000-0000-0000-0000-000000000001', 'course-launch', '2026-01-19', 6, 'active');

-- Generate project tasks for Course Launch project (realistic mid-launch state)
-- Week 8 tasks (week_offset=0, due 2026-01-19) - ALL DONE
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Define course outcome statement', 1, '2026-01-19', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Define target persona', 2, '2026-01-19', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Confirm format and session dates', 3, '2026-01-19', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Confirm pricing structure', 4, '2026-01-19', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 8 - Idea & Positioning', 1, 'Draft and distribute internal course brief', 5, '2026-01-19', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']);

-- Week 7 tasks (week_offset=1, due 2026-01-26) - ALL DONE
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Write all landing page copy', 1, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Format syllabus into branded template', 2, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Build landing page on Squarespace', 3, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Design all landing page visual assets', 4, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Send landing page to Nick for brand review', 5, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Review landing page for brand alignment', 6, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000005']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Set up Teachable sales page', 7, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Test full enrollment flow end-to-end', 8, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Verify all tracking links', 9, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Verify automated email triggers', 10, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Customize Teachable confirmation email', 11, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Set up affiliate tracking links', 12, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Format FAQ into branded template', 13, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Publish FAQ and syllabus', 14, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Brief both affiliates on upcoming launch', 15, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 7 - Core Asset Creation', 2, 'Send affiliate promo kits', 16, '2026-01-26', 2, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']);

-- Week 6 - Announcement (week_offset=2, due 2026-02-02) - ALL DONE
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Post course announcement on Twitter and LinkedIn', 1, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Send Email 1 enrollment open announcement', 2, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Pin announcement post on all profiles', 3, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Confirm Teachable enrollment is open', 4, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Monitor for technical issues', 5, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 6 - Announcement & Enrollment Opens', 3, 'Instructor promotes to their network', 6, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']);

-- Weeks 6-5 Content Production (week_offset=2-3, due 2026-02-02 to 2026-02-09) - MIX
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Record promotional video clips', 1, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Edit and format all video clips with captions and branding', 2, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Design social media graphics', 3, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Upload approved content to content library', 4, '2026-02-09', 4, 'done', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Coordinate video production with instructors', 5, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Schedule all social content across LinkedIn Instagram and X', 6, '2026-02-09', 4, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Manage and update content library', 7, '2026-02-09', 4, 'in_progress', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Write all 10 emails in launch sequence', 8, '2026-02-02', 3, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Format and load all emails into email platform', 9, '2026-02-09', 4, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Send emails for approval', 10, '2026-02-09', 4, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 6-5 - Content Production', 4, 'Notify affiliates and send tracking links', 11, '2026-02-09', 4, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']);

-- Week 4 - Pre-Close Check (week_offset=4, due 2026-02-16) - DONE
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Brief guest instructors on dates and expectations', 1, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Attend 30-min team launch sync', 2, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000005']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm all social posts scheduled through close', 3, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm Email 1 queued for Week 6', 4, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm landing page live and functional', 5, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Verify all tracking links working', 6, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Verify automated emails firing correctly', 7, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 4 - Pre-Close Check', 5, 'Confirm affiliate referral links live', 8, '2026-02-16', 5, 'done', ARRAY['a1000000-0000-0000-0000-000000000002']);

-- Weeks 3-2 Active Sales (week_offset=5-6, due 2026-02-23 to 2026-03-02) - MIX (current phase!)
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Monitor email open and click rates daily', 1, '2026-02-23', 6, 'in_progress', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Respond to social comments and DMs within 24 hours', 2, '2026-02-23', 6, 'in_progress', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Post deadline reminder at 1-week mark', 3, '2026-02-23', 6, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Post deadline reminder at 48-hour mark', 4, '2026-03-02', 7, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Post deadline reminder on close day', 5, '2026-03-02', 7, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Monitor enrollment numbers daily', 6, '2026-02-23', 6, 'in_progress', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Weeks 3-2 - Active Sales Window', 6, 'Flag any technical or payment issues', 7, '2026-02-23', 6, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']);

-- Week 1 Final Push (week_offset=7, due 2026-03-09) - NOT STARTED
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Send Email 8 last 48 hours', 1, '2026-03-09', 8, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Send Email 9 enrollment closes tonight', 2, '2026-03-09', 8, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Close enrollment in Teachable', 3, '2026-03-09', 8, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Send Email 10 waitlist for next cohort', 4, '2026-03-09', 8, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Log total enrollment count and revenue', 5, '2026-03-09', 8, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Week 1 - Final Push and Close', 7, 'Calculate and process affiliate commissions', 6, '2026-03-09', 8, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']);

-- Course Start - Handoff tasks (not started)
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Send student onboarding email', 1, '2026-03-16', 9, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Send session registration links to all students', 2, '2026-03-16', 9, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Resend session links before each session', 3, '2026-03-16', 9, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Confirm all session materials ready', 4, '2026-03-16', 9, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Confirm recording setup tested', 5, '2026-03-16', 9, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000001', 'Course Start - Handoff', 8, 'Hold post-launch debrief within 1 week', 6, '2026-03-16', 9, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000001']);

-- Post Course Wrap Up tasks (not started)
INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send mid-course pulse survey', 1, '2026-03-30', 10, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send end-of-course survey', 2, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Follow up with 3-5 students for video testimonials', 3, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Store testimonials in content library', 4, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send congratulations email with badge instructions', 5, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Send alumni check-in email 2 weeks after course ends', 6, '2026-04-13', 12, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Issue digital badges via Accredible', 7, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Submit student list to certificate provider', 8, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Compile and share post-launch performance report', 9, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Design visual testimonial cards', 10, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Format video testimonial clips for social', 11, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Ensure Accredible badge design is on-brand', 12, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000001', 'Post Course - Wrap Up', 9, 'Note student demand signals and share with team', 13, '2026-04-06', 11, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000001']);

-- ============================================================
-- Project 2: Episode 12 - AI in Portfolio Construction (Podcast, Week 1 of 2)
-- Start date: this week (2026-03-02)
-- ============================================================
INSERT INTO projects (id, name, workflow_template_id, workflow_type, start_date, current_week, status) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'Episode 12 - AI in Portfolio Construction', 'b1000000-0000-0000-0000-000000000002', 'podcast', '2026-03-02', 1, 'active');

INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'Week 1 - Prep & Record', 1, 'Confirm guest and send prep questions', 1, '2026-03-02', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000002', 'Week 1 - Prep & Record', 1, 'Record episode', 2, '2026-03-04', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000002', 'Week 1 - Prep & Record', 1, 'Send raw audio to editor', 3, '2026-03-06', 1, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Review edited episode', 1, '2026-03-09', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Write show notes and pull quote clips', 2, '2026-03-10', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Upload to hosting platform and schedule publish', 3, '2026-03-11', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000002']),
  ('c1000000-0000-0000-0000-000000000002', 'Week 2 - Edit & Publish', 2, 'Episode goes live, post clips on LinkedIn Instagram and X', 4, '2026-03-12', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000002', 'Ongoing', 3, 'Format podcast episode clips for social', 1, '2026-03-12', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000004']),
  ('c1000000-0000-0000-0000-000000000002', 'Ongoing', 3, 'Maintain podcast artwork to brand standards', 2, '2026-03-12', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000004']);

-- ============================================================
-- Project 3: Signal & Noise - Issue 14 (Newsletter, due Monday)
-- Start date: last week (2026-02-23)
-- ============================================================
INSERT INTO projects (id, name, workflow_template_id, workflow_type, start_date, current_week, status) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'Signal & Noise - Issue 14', 'b1000000-0000-0000-0000-000000000003', 'newsletter', '2026-02-23', 2, 'active');

INSERT INTO project_tasks (project_id, phase, phase_order, task_name, task_order, due_date, week_number, status, owner_ids) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'Week 1 - Content Gathering', 1, 'Contribute Signal items and Field Notes', 1, '2026-02-26', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000003', 'Week 1 - Content Gathering', 1, 'Guest contributor submits Something Useful piece', 2, '2026-02-26', 1, 'done', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Assemble issue in template, check links, schedule send', 1, '2026-03-01', 2, 'in_progress', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Review and approve final draft', 2, '2026-03-01', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000001']),
  ('c1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Issue sends', 3, '2026-03-02', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000003', 'Week 2 - Assembly & Send', 2, 'Post snippet on LinkedIn and X', 4, '2026-03-02', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003']),
  ('c1000000-0000-0000-0000-000000000003', 'Week 2 - Follow Up', 3, 'Review open and click rates and share with team', 1, '2026-03-06', 2, 'not_started', ARRAY['a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002']);
