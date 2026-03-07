import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SeedTemplate {
  name: string;
  type: string;
  description: string;
  tasks: { title: string; description: string | null; owner: string; week_number: number; order_index: number }[];
}

const SEED_TEMPLATES: SeedTemplate[] = [
  // 1. Existing Course - New Cohort (original)
  {
    name: 'Existing Course - New Cohort',
    type: 'course-launch',
    description: 'Full 34-task workflow for launching a new cohort of an existing course, from setup through post-cohort wrap-up.',
    tasks: [
      // WEEK 6 - Setup
      { title: 'Set cohort dates - start, end, office hours schedule', description: null, owner: 'Paul', week_number: 6, order_index: 1 },
      { title: 'Confirm faculty availability - Brett and all instructors', description: null, owner: 'Paul', week_number: 6, order_index: 2 },
      { title: 'Create new course in Teachable for new cohort', description: null, owner: 'Paul', week_number: 6, order_index: 3 },
      { title: 'Remove old cohort live session recordings from Teachable', description: null, owner: 'Paul', week_number: 6, order_index: 4 },
      { title: 'Update syllabus document with new dates', description: null, owner: 'Paul', week_number: 6, order_index: 5 },
      { title: 'Load updated syllabus into Kit for download', description: null, owner: 'Paul', week_number: 6, order_index: 6 },
      { title: 'Create new enrollment form in Formsite', description: null, owner: 'Jess', week_number: 6, order_index: 7 },
      { title: 'Update website with new cohort dates and enrollment form', description: null, owner: 'Jess', week_number: 6, order_index: 8 },
      { title: 'Update sales page copy and pricing', description: null, owner: 'Jess', week_number: 6, order_index: 9 },
      { title: 'Update welcome email in Kit', description: null, owner: 'Jess', week_number: 6, order_index: 10 },
      { title: 'Set up Zapier automation - Teachable enrollment to Kit list to welcome email', description: null, owner: 'Jess', week_number: 6, order_index: 11 },
      { title: 'Test full enrollment flow end to end', description: null, owner: 'Jess + Paul', week_number: 6, order_index: 12 },
      // WEEK 4 - Marketing Launch
      { title: 'Write launch announcement email', description: null, owner: 'Jess', week_number: 4, order_index: 13 },
      { title: 'Write social posts for X, LinkedIn, YouTube', description: null, owner: 'Jess', week_number: 4, order_index: 14 },
      { title: 'Schedule email campaign in Kit', description: null, owner: 'Jess', week_number: 4, order_index: 15 },
      { title: 'Publish social content', description: null, owner: 'Jess', week_number: 4, order_index: 16 },
      { title: 'Send to enterprise contacts', description: null, owner: 'Jess', week_number: 4, order_index: 17 },
      // WEEK 2 - Enrollment Push
      { title: 'Send mid-campaign email', description: null, owner: 'Jess', week_number: 2, order_index: 18 },
      { title: 'Monitor enrollment numbers daily', description: null, owner: 'Jess', week_number: 2, order_index: 19 },
      { title: 'Send final urgency email - last 48 hours', description: null, owner: 'Jess', week_number: 2, order_index: 20 },
      { title: 'Close enrollment and update website', description: null, owner: 'Jess', week_number: 2, order_index: 21 },
      // WEEK 1 - Delivery Prep
      { title: 'Set up Zoom recurring meeting for live office hours', description: null, owner: 'Paul', week_number: 1, order_index: 22 },
      { title: 'Send welcome email to enrolled students with Zoom links and schedule', description: null, owner: 'Paul', week_number: 1, order_index: 23 },
      { title: 'Upload any updated content and materials to Teachable', description: null, owner: 'Paul', week_number: 1, order_index: 24 },
      { title: 'Confirm all students have Teachable access', description: null, owner: 'Paul', week_number: 1, order_index: 25 },
      // WEEK 0 - Delivery
      { title: 'Weekly office hours session delivered', description: null, owner: 'Brett', week_number: 0, order_index: 26 },
      { title: 'Upload office hours recording to Teachable', description: null, owner: 'Paul', week_number: 0, order_index: 27 },
      { title: 'Monitor student progress and flag disengaged students', description: null, owner: 'Paul', week_number: 0, order_index: 28 },
      // WEEK -1 - Wrap Up
      { title: 'Send completion email to students', description: null, owner: 'Paul', week_number: -1, order_index: 29 },
      { title: 'Send feedback survey', description: null, owner: 'Paul', week_number: -1, order_index: 30 },
      { title: 'Collect testimonials for marketing', description: null, owner: 'Jess', week_number: -1, order_index: 31 },
      { title: 'Log final enrollment count and revenue', description: null, owner: 'Paul', week_number: -1, order_index: 32 },
      { title: 'Debrief - document what changed for next cohort', description: null, owner: 'Paul', week_number: -1, order_index: 33 },
      { title: 'Identify upsell opportunities to AI Accelerator and PM Academy', description: null, owner: 'Jess', week_number: -1, order_index: 34 },
    ],
  },

  // 2. New Course Launch
  {
    name: 'New Course Launch',
    type: 'course-launch',
    description: 'Full workflow for launching a brand new course from scratch.',
    tasks: [
      // WEEK 8 - Course Design
      { title: 'Define course learning objectives and target audience', description: null, owner: 'Brett', week_number: 8, order_index: 1 },
      { title: 'Draft course outline and module structure', description: null, owner: 'Brett', week_number: 8, order_index: 2 },
      { title: 'Identify guest instructors or co-teachers if needed', description: null, owner: 'Brett', week_number: 8, order_index: 3 },
      { title: 'Choose delivery format - live cohort, self-paced, hybrid', description: null, owner: 'Brett + Paul', week_number: 8, order_index: 4 },
      { title: 'Set pricing strategy and payment options', description: null, owner: 'Brett + Jess', week_number: 8, order_index: 5 },
      // WEEK 6 - Content Creation
      { title: 'Write full syllabus document', description: null, owner: 'Brett', week_number: 6, order_index: 6 },
      { title: 'Record or outline all module content', description: null, owner: 'Brett', week_number: 6, order_index: 7 },
      { title: 'Create slide decks and supplemental materials', description: null, owner: 'Brett', week_number: 6, order_index: 8 },
      { title: 'Design course branding and visual assets', description: null, owner: 'Britt', week_number: 6, order_index: 9 },
      { title: 'Build course in Teachable with all modules and content', description: null, owner: 'Paul', week_number: 6, order_index: 10 },
      { title: 'Upload syllabus to Kit for download', description: null, owner: 'Paul', week_number: 6, order_index: 11 },
      // WEEK 4 - Platform & Sales Setup
      { title: 'Build sales page with copy, pricing, and enrollment CTA', description: null, owner: 'Jess', week_number: 4, order_index: 12 },
      { title: 'Create enrollment form in Formsite', description: null, owner: 'Jess', week_number: 4, order_index: 13 },
      { title: 'Set up Zapier automation - enrollment to Kit to welcome email', description: null, owner: 'Jess', week_number: 4, order_index: 14 },
      { title: 'Write welcome email sequence in Kit', description: null, owner: 'Jess', week_number: 4, order_index: 15 },
      { title: 'Test full enrollment flow end to end', description: null, owner: 'Jess + Paul', week_number: 4, order_index: 16 },
      { title: 'Add course to website navigation and course catalog', description: null, owner: 'Jess', week_number: 4, order_index: 17 },
      // WEEK 3 - Marketing Launch
      { title: 'Write launch announcement email', description: null, owner: 'Jess', week_number: 3, order_index: 18 },
      { title: 'Write social posts for X, LinkedIn, YouTube', description: null, owner: 'Jess', week_number: 3, order_index: 19 },
      { title: 'Create promotional graphics and video', description: null, owner: 'Britt', week_number: 3, order_index: 20 },
      { title: 'Schedule email campaign in Kit', description: null, owner: 'Jess', week_number: 3, order_index: 21 },
      { title: 'Publish social content', description: null, owner: 'Jess', week_number: 3, order_index: 22 },
      { title: 'Send to enterprise contacts', description: null, owner: 'Jess', week_number: 3, order_index: 23 },
      // WEEK 2 - Enrollment Push
      { title: 'Send mid-campaign email', description: null, owner: 'Jess', week_number: 2, order_index: 24 },
      { title: 'Monitor enrollment numbers daily', description: null, owner: 'Jess', week_number: 2, order_index: 25 },
      { title: 'Send final urgency email - last 48 hours', description: null, owner: 'Jess', week_number: 2, order_index: 26 },
      { title: 'Close enrollment and update website', description: null, owner: 'Jess', week_number: 2, order_index: 27 },
      // WEEK 1 - Delivery Prep
      { title: 'Set up Zoom sessions for live components', description: null, owner: 'Paul', week_number: 1, order_index: 28 },
      { title: 'Send welcome email with access links and schedule', description: null, owner: 'Paul', week_number: 1, order_index: 29 },
      { title: 'Confirm all students have Teachable access', description: null, owner: 'Paul', week_number: 1, order_index: 30 },
      // WEEK 0 - Delivery
      { title: 'Deliver first live session or open course access', description: null, owner: 'Brett', week_number: 0, order_index: 31 },
      { title: 'Monitor student progress and engagement', description: null, owner: 'Paul', week_number: 0, order_index: 32 },
      // WEEK -1 - Wrap Up
      { title: 'Send completion email to students', description: null, owner: 'Paul', week_number: -1, order_index: 33 },
      { title: 'Send feedback survey', description: null, owner: 'Paul', week_number: -1, order_index: 34 },
      { title: 'Collect testimonials for marketing', description: null, owner: 'Jess', week_number: -1, order_index: 35 },
      { title: 'Log final enrollment count and revenue', description: null, owner: 'Paul', week_number: -1, order_index: 36 },
      { title: 'Debrief - document lessons learned', description: null, owner: 'Brett + Paul', week_number: -1, order_index: 37 },
    ],
  },

  // 3. New Podcast Launch
  {
    name: 'New Podcast Launch',
    type: 'podcast',
    description: 'Full workflow for launching a brand new podcast from scratch.',
    tasks: [
      // WEEK 8 - Concept & Planning
      { title: 'Define podcast concept, format, and target audience', description: null, owner: 'Brett', week_number: 8, order_index: 1 },
      { title: 'Choose podcast name and tagline', description: null, owner: 'Brett', week_number: 8, order_index: 2 },
      { title: 'Plan first 10 episode topics', description: null, owner: 'Brett', week_number: 8, order_index: 3 },
      { title: 'Select hosting platform and set up account', description: null, owner: 'Paul', week_number: 8, order_index: 4 },
      // WEEK 6 - Branding & Setup
      { title: 'Design podcast cover art and branding', description: null, owner: 'Britt', week_number: 6, order_index: 5 },
      { title: 'Write podcast description for directories', description: null, owner: 'Brett', week_number: 6, order_index: 6 },
      { title: 'Set up recording equipment and test audio quality', description: null, owner: 'Paul', week_number: 6, order_index: 7 },
      { title: 'Submit podcast to Apple Podcasts, Spotify, and directories', description: null, owner: 'Paul', week_number: 6, order_index: 8 },
      { title: 'Create podcast page on website', description: null, owner: 'Jess', week_number: 6, order_index: 9 },
      // WEEK 4 - Content Production
      { title: 'Record first 3 episodes', description: null, owner: 'Brett', week_number: 4, order_index: 10 },
      { title: 'Send recordings to editor', description: null, owner: 'Paul', week_number: 4, order_index: 11 },
      { title: 'Write show notes for first 3 episodes', description: null, owner: 'Jess', week_number: 4, order_index: 12 },
      { title: 'Design episode thumbnails', description: null, owner: 'Britt', week_number: 4, order_index: 13 },
      { title: 'Create intro and outro audio', description: null, owner: 'Paul', week_number: 4, order_index: 14 },
      // WEEK 2 - Pre-Launch Marketing
      { title: 'Write launch announcement email', description: null, owner: 'Jess', week_number: 2, order_index: 15 },
      { title: 'Create social media launch campaign', description: null, owner: 'Jess', week_number: 2, order_index: 16 },
      { title: 'Create launch graphics and teaser clips', description: null, owner: 'Britt', week_number: 2, order_index: 17 },
      { title: 'Schedule email and social campaigns', description: null, owner: 'Jess', week_number: 2, order_index: 18 },
      { title: 'Set up YouTube channel for video episodes', description: null, owner: 'Paul', week_number: 2, order_index: 19 },
      // WEEK 0 - Launch
      { title: 'Publish first 3 episodes', description: null, owner: 'Paul', week_number: 0, order_index: 20 },
      { title: 'Send launch email to full list', description: null, owner: 'Jess', week_number: 0, order_index: 21 },
      { title: 'Publish social launch posts', description: null, owner: 'Jess', week_number: 0, order_index: 22 },
      { title: 'Upload episodes to YouTube with thumbnails', description: null, owner: 'Paul', week_number: 0, order_index: 23 },
      // WEEK -1 - Post-Launch
      { title: 'Track download numbers and subscriber growth', description: null, owner: 'Jess', week_number: -1, order_index: 24 },
      { title: 'Share listener reviews and feedback', description: null, owner: 'Jess', week_number: -1, order_index: 25 },
      { title: 'Establish weekly production cadence', description: null, owner: 'Paul', week_number: -1, order_index: 26 },
      { title: 'Debrief on launch and plan ongoing promotion', description: null, owner: 'Brett + Jess', week_number: -1, order_index: 27 },
    ],
  },

  // 4. New Newsletter Launch
  {
    name: 'New Newsletter Launch',
    type: 'newsletter',
    description: 'Full workflow for launching a brand new newsletter from scratch.',
    tasks: [
      // WEEK 6 - Strategy & Setup
      { title: 'Define newsletter audience, format, and cadence', description: null, owner: 'Brett', week_number: 6, order_index: 1 },
      { title: 'Choose newsletter name and tagline', description: null, owner: 'Brett', week_number: 6, order_index: 2 },
      { title: 'Set up Kit list and segments', description: null, owner: 'Paul', week_number: 6, order_index: 3 },
      { title: 'Design newsletter template in Kit', description: null, owner: 'Britt', week_number: 6, order_index: 4 },
      { title: 'Create newsletter landing page on website', description: null, owner: 'Jess', week_number: 6, order_index: 5 },
      { title: 'Set up signup form and embed on website', description: null, owner: 'Jess', week_number: 6, order_index: 6 },
      // WEEK 4 - Content Prep
      { title: 'Write first 2 newsletter issues', description: null, owner: 'Brett', week_number: 4, order_index: 7 },
      { title: 'Edit and proof first 2 issues', description: null, owner: 'Paul', week_number: 4, order_index: 8 },
      { title: 'Design issues in Kit using template', description: null, owner: 'Britt', week_number: 4, order_index: 9 },
      { title: 'Create welcome email sequence for new subscribers', description: null, owner: 'Jess', week_number: 4, order_index: 10 },
      { title: 'QA test emails on desktop and mobile', description: null, owner: 'Paul', week_number: 4, order_index: 11 },
      // WEEK 2 - Pre-Launch Marketing
      { title: 'Write launch announcement email', description: null, owner: 'Jess', week_number: 2, order_index: 12 },
      { title: 'Create social posts announcing newsletter', description: null, owner: 'Jess', week_number: 2, order_index: 13 },
      { title: 'Create promotional graphics', description: null, owner: 'Britt', week_number: 2, order_index: 14 },
      { title: 'Schedule pre-launch email and social campaigns', description: null, owner: 'Jess', week_number: 2, order_index: 15 },
      // WEEK 0 - Launch
      { title: 'Send first issue to subscribers', description: null, owner: 'Jess', week_number: 0, order_index: 16 },
      { title: 'Publish to website archive', description: null, owner: 'Paul', week_number: 0, order_index: 17 },
      { title: 'Post launch announcement on social media', description: null, owner: 'Jess', week_number: 0, order_index: 18 },
      // WEEK -1 - Post-Launch
      { title: 'Track open rate, click rate, and subscriber growth', description: null, owner: 'Jess', week_number: -1, order_index: 19 },
      { title: 'Log performance metrics to dashboard', description: null, owner: 'Paul', week_number: -1, order_index: 20 },
      { title: 'Establish recurring production cadence', description: null, owner: 'Brett + Jess', week_number: -1, order_index: 21 },
    ],
  },

  // 5. Subscription Buildout
  {
    name: 'Subscription Buildout',
    type: 'subscription',
    description: 'Full workflow for building out a new subscription product.',
    tasks: [
      // WEEK 8 - Product Design
      { title: 'Define subscription value proposition and tier structure', description: null, owner: 'Brett', week_number: 8, order_index: 1 },
      { title: 'Define content roadmap for first 3 months', description: null, owner: 'Brett', week_number: 8, order_index: 2 },
      { title: 'Set pricing for each tier', description: null, owner: 'Brett + Jess', week_number: 8, order_index: 3 },
      { title: 'Choose membership platform and payment processor', description: null, owner: 'Paul', week_number: 8, order_index: 4 },
      // WEEK 6 - Platform Build
      { title: 'Set up membership platform with tiers and access levels', description: null, owner: 'Paul', week_number: 6, order_index: 5 },
      { title: 'Configure payment processing and billing', description: null, owner: 'Paul', week_number: 6, order_index: 6 },
      { title: 'Design member dashboard and content layout', description: null, owner: 'Britt', week_number: 6, order_index: 7 },
      { title: 'Build onboarding email sequence in Kit', description: null, owner: 'Jess', week_number: 6, order_index: 8 },
      { title: 'Create first month of subscriber content', description: null, owner: 'Brett', week_number: 6, order_index: 9 },
      // WEEK 4 - Sales & Marketing Setup
      { title: 'Build sales page with tier comparison and CTAs', description: null, owner: 'Jess', week_number: 4, order_index: 10 },
      { title: 'Create promotional graphics and video', description: null, owner: 'Britt', week_number: 4, order_index: 11 },
      { title: 'Set up Zapier automation for new subscriber flow', description: null, owner: 'Jess', week_number: 4, order_index: 12 },
      { title: 'Test full signup and payment flow end to end', description: null, owner: 'Jess + Paul', week_number: 4, order_index: 13 },
      { title: 'Add subscription to website navigation', description: null, owner: 'Jess', week_number: 4, order_index: 14 },
      // WEEK 2 - Pre-Launch Marketing
      { title: 'Write launch announcement email', description: null, owner: 'Jess', week_number: 2, order_index: 15 },
      { title: 'Write social posts for X, LinkedIn, YouTube', description: null, owner: 'Jess', week_number: 2, order_index: 16 },
      { title: 'Schedule email campaign in Kit', description: null, owner: 'Jess', week_number: 2, order_index: 17 },
      { title: 'Send early access invite to VIP contacts', description: null, owner: 'Jess', week_number: 2, order_index: 18 },
      // WEEK 0 - Launch
      { title: 'Open subscription for public enrollment', description: null, owner: 'Paul', week_number: 0, order_index: 19 },
      { title: 'Send launch email to full list', description: null, owner: 'Jess', week_number: 0, order_index: 20 },
      { title: 'Publish social launch posts', description: null, owner: 'Jess', week_number: 0, order_index: 21 },
      // WEEK -1 - Post-Launch
      { title: 'Monitor subscriber signups and churn', description: null, owner: 'Jess', week_number: -1, order_index: 22 },
      { title: 'Log revenue and subscriber metrics', description: null, owner: 'Paul', week_number: -1, order_index: 23 },
      { title: 'Gather early subscriber feedback', description: null, owner: 'Brett', week_number: -1, order_index: 24 },
      { title: 'Debrief and plan month 2 content', description: null, owner: 'Brett + Jess', week_number: -1, order_index: 25 },
    ],
  },

  // 6. Podcast - New Episode (recurring)
  {
    name: 'Podcast - New Episode',
    type: 'podcast',
    description: 'Workflow for producing and publishing a single podcast episode.',
    tasks: [
      { title: 'Confirm episode topic and guest', description: null, owner: 'Brett', week_number: 2, order_index: 1 },
      { title: 'Send guest prep notes and questions', description: null, owner: 'Brett', week_number: 2, order_index: 2 },
      { title: 'Write episode outline and talking points', description: null, owner: 'Brett', week_number: 2, order_index: 3 },
      { title: 'Promote upcoming episode on social', description: null, owner: 'Jess', week_number: 2, order_index: 4 },
      { title: 'Record episode', description: null, owner: 'Brett', week_number: 1, order_index: 5 },
      { title: 'Send recording to editor', description: null, owner: 'Paul', week_number: 1, order_index: 6 },
      { title: 'Write show notes and episode description', description: null, owner: 'Jess', week_number: 1, order_index: 7 },
      { title: 'Design episode thumbnail and cover art', description: null, owner: 'Britt', week_number: 1, order_index: 8 },
      { title: 'Review and approve edited audio', description: null, owner: 'Brett', week_number: 0, order_index: 9 },
      { title: 'Upload episode to podcast platform', description: null, owner: 'Paul', week_number: 0, order_index: 10 },
      { title: 'Upload to YouTube with thumbnail', description: null, owner: 'Paul', week_number: 0, order_index: 11 },
      { title: 'Schedule episode email in Kit with show notes', description: null, owner: 'Jess', week_number: 0, order_index: 12 },
      { title: 'Publish social posts for episode launch', description: null, owner: 'Jess', week_number: 0, order_index: 13 },
      { title: 'Share episode clip on X, LinkedIn, YouTube Shorts', description: null, owner: 'Jess', week_number: -1, order_index: 14 },
      { title: 'Track and log episode performance metrics', description: null, owner: 'Jess', week_number: -1, order_index: 15 },
    ],
  },

  // 7. Newsletter - New Issue (recurring)
  {
    name: 'Newsletter - New Issue',
    type: 'newsletter',
    description: 'Workflow for writing, designing, and sending a newsletter issue.',
    tasks: [
      { title: 'Confirm issue topic and angle', description: null, owner: 'Brett', week_number: 2, order_index: 1 },
      { title: 'Write content outline and key points', description: null, owner: 'Brett', week_number: 2, order_index: 2 },
      { title: 'Research and gather supporting data and links', description: null, owner: 'Jess', week_number: 2, order_index: 3 },
      { title: 'Write first draft of newsletter', description: null, owner: 'Brett', week_number: 1, order_index: 4 },
      { title: 'Edit and proof newsletter copy', description: null, owner: 'Paul', week_number: 1, order_index: 5 },
      { title: 'Design newsletter in email platform', description: null, owner: 'Britt', week_number: 1, order_index: 6 },
      { title: 'Add links, CTAs, and tracking', description: null, owner: 'Jess', week_number: 1, order_index: 7 },
      { title: 'QA test email on desktop and mobile', description: null, owner: 'Paul', week_number: 1, order_index: 8 },
      { title: 'Get final approval from Brett', description: null, owner: 'Brett', week_number: 1, order_index: 9 },
      { title: 'Schedule or send newsletter in Kit', description: null, owner: 'Jess', week_number: 0, order_index: 10 },
      { title: 'Publish newsletter to website archive', description: null, owner: 'Paul', week_number: 0, order_index: 11 },
      { title: 'Post newsletter teaser on social media', description: null, owner: 'Jess', week_number: 0, order_index: 12 },
      { title: 'Track open rate, click rate, unsubscribes', description: null, owner: 'Jess', week_number: -1, order_index: 13 },
      { title: 'Log performance metrics to dashboard', description: null, owner: 'Paul', week_number: -1, order_index: 14 },
      { title: 'Pull best content for social repurposing', description: null, owner: 'Jess', week_number: -1, order_index: 15 },
    ],
  },
];

const WEEK_PHASES: Record<number, string> = {
  8: 'Planning',
  6: 'Setup',
  4: 'Build',
  3: 'Marketing Launch',
  2: 'Pre-Launch',
  1: 'Delivery Prep',
  0: 'Launch',
  [-1]: 'Wrap Up',
};

async function seedMissingTemplates() {
  // Fetch existing template names
  const { data: existing } = await supabase
    .from('project_templates')
    .select('name');

  const existingNames = new Set((existing || []).map((t: { name: string }) => t.name));

  for (const seed of SEED_TEMPLATES) {
    if (existingNames.has(seed.name)) continue;

    // Insert template
    const { data: inserted, error: insertError } = await supabase
      .from('project_templates')
      .insert({ name: seed.name, type: seed.type, description: seed.description })
      .select()
      .single();

    if (insertError || !inserted) continue;

    // Insert tasks
    const tasksToInsert = seed.tasks.map(t => ({
      ...t,
      template_id: inserted.id,
    }));

    await supabase
      .from('project_template_tasks')
      .insert(tasksToInsert);
  }
}

export async function GET() {
  try {
    // Seed any missing templates (idempotent - checks by name)
    await seedMissingTemplates();

    // Fetch all templates
    const { data: templates, error } = await supabase
      .from('project_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch tasks for all templates
    const templateIds = (templates || []).map(t => t.id);
    let allTasks: Record<string, unknown>[] = [];
    if (templateIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('project_template_tasks')
        .select('*')
        .in('template_id', templateIds)
        .order('order_index', { ascending: true });
      allTasks = tasksData || [];
    }

    const templatesWithTasks = (templates || []).map(t => ({
      ...t,
      tasks: allTasks.filter((task: any) => task.template_id === t.id),
    }));

    return NextResponse.json(templatesWithTasks);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a project from a template, or create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Create a new template (from the template editor)
    if (body.action === 'create_template') {
      const { name, type, description } = body;
      if (!name || !type) {
        return NextResponse.json({ error: 'Missing name or type' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('project_templates')
        .insert({ name, type, description: description || null })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data, { status: 201 });
    }

    // Create a project from a template
    const { template_id, name, start_date } = body;

    if (!template_id || !name || !start_date) {
      return NextResponse.json(
        { error: 'Missing required fields: template_id, name, start_date' },
        { status: 400 }
      );
    }

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch template tasks
    const { data: templateTasks, error: tasksError } = await supabase
      .from('project_template_tasks')
      .select('*')
      .eq('template_id', template_id)
      .order('order_index', { ascending: true });

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Fetch team members to resolve owner names to IDs and role_ids
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, name, role_id');

    const nameToId: Record<string, string> = {};
    const nameToRoleId: Record<string, string | null> = {};
    (teamMembers || []).forEach((m: any) => {
      const firstName = m.name.split(' ')[0];
      nameToId[firstName.toLowerCase()] = m.id;
      nameToId[m.name.toLowerCase()] = m.id;
      nameToRoleId[firstName.toLowerCase()] = m.role_id || null;
      nameToRoleId[m.name.toLowerCase()] = m.role_id || null;
    });

    function resolveOwnerIds(ownerStr: string): string[] {
      const parts = ownerStr.split(/\s*\+\s*/);
      const ids: string[] = [];
      for (const part of parts) {
        const key = part.trim().toLowerCase();
        if (nameToId[key]) {
          ids.push(nameToId[key]);
        }
      }
      return ids;
    }

    function resolveRoleId(ownerStr: string): string | null {
      const parts = ownerStr.split(/\s*\+\s*/);
      // Use the first owner's role_id
      for (const part of parts) {
        const key = part.trim().toLowerCase();
        if (nameToRoleId[key]) return nameToRoleId[key];
      }
      return null;
    }

    // Look up a matching workflow template for the project type
    let workflowTemplateId: string | null = null;
    const { data: wfTemplates } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('slug', template.type)
      .limit(1);

    if (wfTemplates && wfTemplates.length > 0) {
      workflowTemplateId = wfTemplates[0].id;
    }

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        workflow_type: template.type,
        start_date,
        workflow_template_id: workflowTemplateId,
        current_week: 1,
        status: 'active',
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // Generate project tasks with dates calculated from start date
    if (templateTasks && templateTasks.length > 0) {
      const startDateObj = new Date(start_date + 'T00:00:00');

      const weekNumbers = templateTasks.map(t => t.week_number);
      const uniqueWeeks = [...new Set(weekNumbers)].sort((a, b) => b - a);
      const phaseOrder: Record<number, number> = {};
      uniqueWeeks.forEach((w, i) => { phaseOrder[w] = i + 1; });

      const projectTasks = templateTasks.map((task: any) => {
        const offsetDays = -task.week_number * 7;
        const dueDate = new Date(startDateObj.getTime() + offsetDays * 24 * 60 * 60 * 1000);
        const dueDateStr = dueDate.toISOString().split('T')[0];
        const phase = WEEK_PHASES[task.week_number] || `Week ${task.week_number}`;

        return {
          project_id: project.id,
          phase,
          phase_order: phaseOrder[task.week_number] || 99,
          task_name: task.title,
          task_order: task.order_index,
          due_date: dueDateStr,
          week_number: task.week_number,
          status: 'not_started',
          owner_ids: resolveOwnerIds(task.owner),
          role_id: task.role_id || resolveRoleId(task.owner),
        };
      });

      const { error: insertError } = await supabase
        .from('project_tasks')
        .insert(projectTasks);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
