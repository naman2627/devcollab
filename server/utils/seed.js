/**
 * Seed the database with a believable demo dataset.
 *
 * Run with: npm run seed
 *
 * WHY a script and not fixtures loaded by the app: the demo data must exist in
 * Atlas before the examiner opens the app, and it must be reproducible. Running
 * it twice has to give the same result, so the script WIPES the collections it
 * owns first - otherwise every run would double the feed.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { default: connectDB } = await import('../config/db.js');
const { default: User } = await import('../models/User.js');
const { default: Project } = await import('../models/Project.js');
const { default: Comment } = await import('../models/Comment.js');
const { default: Application } = await import('../models/Application.js');
const { default: Message, conversationKey } = await import('../models/Message.js');
const { default: Notification } = await import('../models/Notification.js');

// One password for every demo account, printed at the end and documented in the
// README so the examiner can log in as anyone.
const DEMO_PASSWORD = 'password123';

const USERS = [
  {
    name: 'Aarav Mehta',
    username: 'aarav',
    email: 'aarav@devcollab.dev',
    bio: 'Backend engineer. I like boring databases and fast queries.',
    skills: ['node', 'mongodb', 'express', 'redis'],
    githubUrl: 'https://github.com/aarav',
  },
  {
    name: 'Isha Kapoor',
    username: 'isha',
    email: 'isha@devcollab.dev',
    bio: 'Frontend developer. Design systems, accessibility, too many fonts.',
    skills: ['react', 'typescript', 'tailwind', 'figma'],
    githubUrl: 'https://github.com/isha',
  },
  {
    name: 'Rohan Desai',
    username: 'rohan',
    email: 'rohan@devcollab.dev',
    bio: 'ML student. Mostly notebooks, slowly learning to ship.',
    skills: ['python', 'pytorch', 'fastapi'],
    githubUrl: 'https://github.com/rohan',
  },
  {
    name: 'Meera Nair',
    username: 'meera',
    email: 'meera@devcollab.dev',
    bio: 'Full-stack. Building small tools that do one thing well.',
    skills: ['react', 'node', 'postgres', 'docker'],
    githubUrl: 'https://github.com/meera',
  },
  {
    name: 'Kabir Singh',
    username: 'kabir',
    email: 'kabir@devcollab.dev',
    bio: 'Mobile dev, React Native. Will argue about navigation libraries.',
    skills: ['react-native', 'expo', 'typescript'],
    githubUrl: 'https://github.com/kabir',
  },
  {
    name: 'Ananya Rao',
    username: 'ananya',
    email: 'ananya@devcollab.dev',
    bio: 'DevOps-curious backend dev. I enjoy deleting YAML.',
    skills: ['go', 'kubernetes', 'terraform', 'node'],
    githubUrl: 'https://github.com/ananya',
  },
  {
    name: 'Vikram Joshi',
    username: 'vikram',
    email: 'vikram@devcollab.dev',
    bio: 'Game dev on weekends, web dev on weekdays.',
    skills: ['unity', 'csharp', 'react', 'threejs'],
    githubUrl: 'https://github.com/vikram',
  },
  {
    name: 'Zoya Khan',
    username: 'zoya',
    email: 'zoya@devcollab.dev',
    bio: 'Data engineer. Pipelines, parquet, and strong opinions on timezones.',
    skills: ['python', 'airflow', 'spark', 'sql'],
    githubUrl: 'https://github.com/zoya',
  },
];

const PROJECTS = [
  {
    title: 'Campus Ride Share',
    summary: 'Match students heading the same way so nobody pays for a whole cab alone.',
    description:
      'Campus Ride Share pairs students travelling between hostels, the station and the airport. The hard part is not the UI, it is the matching: people leave within a fuzzy window, from slightly different places, and plans change an hour before.\n\nWe want to build a simple matcher first - same destination, overlapping time window, seats available - and then make it better with distance weighting. A collaborator would own either the matching service or the booking flow end to end.',
    techStack: ['react', 'node', 'mongodb', 'maps'],
    rolesNeeded: [
      { title: 'Backend developer', count: 2 },
      { title: 'React developer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'intermediate',
    repoUrl: 'https://github.com/devcollab/campus-ride-share',
  },
  {
    title: 'Markdown Resume Builder',
    summary: 'Write a resume in Markdown, get a clean PDF that recruiters can actually parse.',
    description:
      'Every resume builder either locks you into a WYSIWYG editor or produces a PDF that ATS software reads as one blob of text. We want a build pipeline instead: Markdown in, structured semantic PDF out, with templates that are just CSS.\n\nThe interesting work is in the print stylesheet and the PDF generation. A collaborator who enjoys typography would have a lot of room here.',
    techStack: ['react', 'node', 'puppeteer', 'tailwind'],
    rolesNeeded: [
      { title: 'React developer', count: 1 },
      { title: 'Designer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'beginner',
    repoUrl: 'https://github.com/devcollab/md-resume',
  },
  {
    title: 'Study Group Scheduler',
    summary: 'Find the one hour this week when all six of you are actually free.',
    description:
      'Scheduling a study group over chat takes forty messages and still fails. This tool takes everyone timetable, overlays it, and proposes the slots that work for the most people.\n\nWe already have the overlap algorithm. What we need is a calendar UI that does not feel like enterprise software, and an import path from the college timetable PDF.',
    techStack: ['react', 'node', 'mongodb'],
    rolesNeeded: [{ title: 'Frontend developer', count: 2 }],
    status: 'in-progress',
    difficulty: 'beginner',
  },
  {
    title: 'Open Source Contribution Tracker',
    summary: 'Track your first-PR journey across repos and see what you actually finished.',
    description:
      'Contributing to open source is mostly a motivation problem. This tracker pulls your PRs across repositories, shows which are still open, and nudges you about the ones that went stale.\n\nIt needs careful GitHub API work - rate limits, pagination, and webhooks for live updates rather than polling.',
    techStack: ['node', 'react', 'mongodb', 'github-api'],
    rolesNeeded: [
      { title: 'Backend developer', count: 1 },
      { title: 'React developer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'intermediate',
    repoUrl: 'https://github.com/devcollab/oss-tracker',
  },
  {
    title: 'Lecture Notes Semantic Search',
    summary: 'Ask a question in English, get the slide and the minute of the lecture that answers it.',
    description:
      'We have four semesters of lecture recordings and slide decks, and no way to search them. The plan is to transcribe the audio, embed both transcripts and slides, and serve a search box that returns a timestamp.\n\nThis is the most research-shaped project on here. A collaborator comfortable with embeddings and vector search would be driving it, not assisting.',
    techStack: ['python', 'fastapi', 'react', 'embeddings'],
    rolesNeeded: [
      { title: 'ML engineer', count: 2 },
      { title: 'Frontend developer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'advanced',
  },
  {
    title: 'Hostel Mess Menu Voting',
    summary: 'Vote on next week menu instead of complaining about it afterwards.',
    description:
      'A tiny, finishable project. Students vote on dishes for next week, the mess committee sees a ranked list, and everyone stops arguing in the group chat.\n\nDeliberately small scope: one week of voting, one results page, no accounts beyond the college email. Good first collaboration if you have never shipped anything.',
    techStack: ['react', 'node', 'mongodb'],
    rolesNeeded: [{ title: 'Full-stack developer', count: 1 }],
    status: 'completed',
    difficulty: 'beginner',
  },
  {
    title: 'Code Review Practice Arena',
    summary: 'Practise reviewing deliberately flawed pull requests and compare against expert notes.',
    description:
      'Interviews ask you to review code, but nobody practises it. This gives you a PR with planted bugs, takes your review, then shows what an experienced reviewer flagged and what you missed.\n\nThe content is the hard part - we need realistic diffs with defensible bugs. A collaborator who has reviewed real code professionally would be invaluable.',
    techStack: ['react', 'node', 'postgres', 'monaco'],
    rolesNeeded: [
      { title: 'Backend developer', count: 1 },
      { title: 'Content writer', count: 2 },
    ],
    status: 'recruiting',
    difficulty: 'intermediate',
  },
  {
    title: 'Local Event Board for Developers',
    summary: 'One board for every meetup, hackathon and talk happening in your city this month.',
    description:
      'Dev events are scattered across Discord servers, Twitter threads and Luma pages. We scrape and normalise them into one board you can filter by city and topic.\n\nThe scraping is fiddly and the deduplication is worse - the same hackathon appears under three names. A collaborator who likes data cleaning would enjoy this more than most people.',
    techStack: ['node', 'react', 'mongodb', 'cheerio'],
    rolesNeeded: [
      { title: 'Backend developer', count: 2 },
      { title: 'React developer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'intermediate',
  },
  {
    title: 'Terminal Dashboard for Student Life',
    summary: 'Attendance, deadlines and mess menu in one TUI, because the browser is a distraction.',
    description:
      'A terminal dashboard that pulls attendance, assignment deadlines and the mess menu into one screen you can check in four seconds.\n\nBuilt with Ink so it is still React, just rendered to a terminal. Niche, fun, and surprisingly good for learning how rendering actually works.',
    techStack: ['node', 'ink', 'react'],
    rolesNeeded: [{ title: 'Node developer', count: 1 }],
    status: 'in-progress',
    difficulty: 'advanced',
  },
  {
    title: 'Accessible Component Library',
    summary: 'The twelve components every student project needs, built properly for screen readers.',
    description:
      'Every project here rebuilds a modal, a dropdown and a date picker, and every one of them is inaccessible. We want twelve components done correctly once - focus management, ARIA, keyboard navigation - that anyone can drop in.\n\nThis is the project where being pedantic is the whole point. A collaborator who tests with a screen reader would set the standard for the rest.',
    techStack: ['react', 'typescript', 'tailwind', 'storybook'],
    rolesNeeded: [
      { title: 'React developer', count: 2 },
      { title: 'Accessibility reviewer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'intermediate',
    repoUrl: 'https://github.com/devcollab/a11y-kit',
  },
  {
    title: 'Expense Splitter for Flatmates',
    summary: 'Settle shared rent and groceries with the fewest possible transfers.',
    description:
      'Splitwise is good but heavy. We want the minimal version: add an expense, see who owes whom, and get the settlement with the smallest number of payments.\n\nThe settlement minimisation is a neat graph problem, and the UI has to be fast enough to use while standing in a shop.',
    techStack: ['react-native', 'expo', 'node', 'mongodb'],
    rolesNeeded: [
      { title: 'Mobile developer', count: 1 },
      { title: 'Backend developer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'intermediate',
  },
  {
    title: 'Interview Question Bank with Spaced Repetition',
    summary: 'Flashcards for DSA and system design that resurface exactly before you forget them.',
    description:
      'Grinding problems randomly wastes time. This schedules questions on an SM-2 spaced repetition curve, so you revisit a topic right as it is about to fade.\n\nWe need the scheduling engine, a review UI that works on a phone, and a seed bank of good questions. The algorithm is well documented, so this is mostly careful product work.',
    techStack: ['react', 'node', 'mongodb', 'tailwind'],
    rolesNeeded: [
      { title: 'Full-stack developer', count: 2 },
      { title: 'Content writer', count: 1 },
    ],
    status: 'recruiting',
    difficulty: 'beginner',
  },
];

const COMMENTS = [
  'This is the first idea on here I would actually use. Count me in for the backend.',
  'How are you planning to handle the edge case where two people pick the same slot?',
  'I built something similar last semester and the hardest part was the data cleaning, not the API.',
  'Is the repo public yet? Happy to read through before applying.',
  'The scope looks right - small enough to finish, interesting enough to matter.',
  'Would you take someone who is still learning React? I can commit about six hours a week.',
  'Strong yes on doing accessibility properly. Most student projects skip it entirely.',
  'Have you considered caching that? It will fall over around a thousand rows otherwise.',
  'Applied for the backend role. I have shipped two Express APIs and can start this week.',
  'This solves a real problem in my hostel, not a hypothetical one. Following.',
];

/** Deterministic pick so repeated seeds produce a comparable dataset. */
const pick = (arr, i) => arr[i % arr.length];

async function seed() {
  await connectDB();

  // Wipe only the collections this script owns, in parallel. WHY a wipe:
  // re-running the seed must be idempotent. Without it, the second run would
  // fail on the unique email index and leave the data half-written.
  console.log('[seed] clearing collections...');
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Comment.deleteMany({}),
    Application.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // create() in a loop, NOT insertMany. WHY: insertMany bypasses the
  // pre('save') hook, so every seeded password would be stored in plain text
  // and no demo account could log in.
  console.log('[seed] creating 8 users...');
  const users = [];
  for (const u of USERS) {
    users.push(await User.create({ ...u, password: DEMO_PASSWORD }));
  }

  // A small follow graph so the "Following" feed tab has something in it.
  console.log('[seed] building follow graph...');
  for (let i = 0; i < users.length; i += 1) {
    const targets = [users[(i + 1) % users.length], users[(i + 3) % users.length]];
    for (const target of targets) {
      await User.updateOne({ _id: users[i]._id }, { $addToSet: { following: target._id } });
      await User.updateOne({ _id: target._id }, { $addToSet: { followers: users[i]._id } });
    }
  }

  console.log('[seed] creating 12 projects...');
  const projects = [];
  for (let i = 0; i < PROJECTS.length; i += 1) {
    const owner = users[i % users.length];
    // Stagger createdAt backwards so the feed has a realistic spread instead
    // of twelve projects with the same timestamp (which would make the
    // newest-first sort arbitrary).
    const createdAt = new Date(Date.now() - (PROJECTS.length - i) * 36 * 60 * 60 * 1000);

    const project = await Project.create({
      ...PROJECTS[i],
      owner: owner._id,
      views: 20 + i * 13,
      createdAt,
      updatedAt: createdAt,
    });

    // Spread likes from users who are not the owner.
    const likers = users.filter((u) => String(u._id) !== String(owner._id)).slice(0, (i % 5) + 1);
    if (likers.length) {
      await Project.updateOne(
        { _id: project._id },
        { $addToSet: { likes: { $each: likers.map((u) => u._id) } } }
      );
    }

    projects.push(project);
  }

  console.log('[seed] creating comments...');
  let commentIndex = 0;
  for (let i = 0; i < projects.length; i += 1) {
    const howMany = (i % 3) + 1;
    for (let c = 0; c < howMany; c += 1) {
      const author = users[(i + c + 1) % users.length];
      await Comment.create({
        project: projects[i]._id,
        author: author._id,
        text: pick(COMMENTS, commentIndex),
      });
      commentIndex += 1;
    }
    // Keep the denormalised counter honest with what we just inserted.
    await Project.updateOne({ _id: projects[i]._id }, { $set: { commentCount: howMany } });
  }

  console.log('[seed] creating applications...');
  let accepted = 0;
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i];
    if (!project.rolesNeeded.length) continue;

    // Two applicants per project, neither of them the owner.
    const candidates = users.filter((u) => String(u._id) !== String(project.owner)).slice(i % 4, (i % 4) + 2);

    for (let a = 0; a < candidates.length; a += 1) {
      const role = project.rolesNeeded[a % project.rolesNeeded.length];
      // Every third application is pre-accepted, so the demo has real
      // collaborators (and therefore real chat threads) from the start.
      const status = i % 3 === 0 && a === 0 ? 'accepted' : 'pending';

      await Application.create({
        project: project._id,
        applicant: candidates[a]._id,
        roleTitle: role.title,
        message: `I would like to take the ${role.title.toLowerCase()} role. I have worked with ${candidates[a].skills.slice(0, 2).join(' and ')} before.`,
        status,
      });

      if (status === 'accepted') {
        await Project.updateOne(
          { _id: project._id, 'rolesNeeded.title': role.title },
          {
            $addToSet: { collaborators: candidates[a]._id },
            $inc: { 'rolesNeeded.$.filled': 1 },
          }
        );
        accepted += 1;
      }
    }
  }

  console.log('[seed] creating messages...');
  const chats = [
    [users[0], users[1], ['Saw you applied for the backend role - are you free to talk tomorrow?', 'Yes, after 6pm works. I read the repo, I have questions about the matcher.', 'Perfect. I will send a call link.']],
    [users[2], users[4], ['Is the ML role still open?', 'It is. Have you worked with embeddings before?', 'A little - I did a semantic search toy project last term.']],
    [users[3], users[5], ['Your accessibility project is exactly what I was looking for.', 'Great. Can you test with a screen reader?', 'I use NVDA daily, so yes.']],
  ];

  for (const [a, b, lines] of chats) {
    for (let i = 0; i < lines.length; i += 1) {
      const sender = i % 2 === 0 ? a : b;
      const recipient = i % 2 === 0 ? b : a;

      // Space the timestamps minutes apart. WHY: created in a tight loop they
      // would all share one millisecond, and a thread sorted by createdAt
      // would render the replies out of order in the demo.
      const sentAt = new Date(Date.now() - (lines.length - i) * 7 * 60 * 1000);

      await Message.create({
        conversation: conversationKey(a._id, b._id),
        sender: sender._id,
        recipient: recipient._id,
        text: lines[i],
        // Leave the last line unread so the unread badge is visible in the demo.
        read: i < lines.length - 1,
        createdAt: sentAt,
        updatedAt: sentAt,
      });
    }
  }

  console.log('[seed] creating notifications...');
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i];
    const sender = users[(i + 2) % users.length];
    if (String(sender._id) === String(project.owner)) continue;

    await Notification.create({
      recipient: project.owner,
      sender: sender._id,
      type: i % 2 === 0 ? 'like' : 'comment',
      project: project._id,
      text:
        i % 2 === 0
          ? `@${sender.username} upvoted "${project.title}"`
          : `@${sender.username} commented on "${project.title}"`,
      read: i > 3, // a few unread, so the bell shows a count
    });
  }

  const counts = {
    users: await User.countDocuments(),
    projects: await Project.countDocuments(),
    comments: await Comment.countDocuments(),
    applications: await Application.countDocuments(),
    messages: await Message.countDocuments(),
    notifications: await Notification.countDocuments(),
  };

  console.log('\n[seed] done. Documents in Atlas:');
  console.table(counts);
  console.log(`[seed] ${accepted} applications pre-accepted (so chat threads exist).`);
  console.log('\n[seed] demo logins - password for every account: ' + DEMO_PASSWORD);
  for (const u of USERS) console.log(`  ${u.email.padEnd(26)} @${u.username}`);

  // Close explicitly: without this the open Mongoose pool keeps the Node
  // process alive and `npm run seed` never returns to the prompt.
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
