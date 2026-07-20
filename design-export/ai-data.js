/* ============================================================
   AI Assistant — content model (per role × system)
   ------------------------------------------------------------
   systems : which AI systems the role may use, in tab order
             'tutor' = Academic AI Tutor · 'data' = Analytics AI
   examRole: 'learner' (Tutor locks in exams)
             'monitor' (sees integrity flags in exams)
             'none'    (analytics keeps working in exams)
   Each system block: { name, scope/context, seed, suggest[], answers{} , fallback }
   An answer = { text, sources?[], actions?[], result? }
   result types: stat{big,sub} · list{rows:[[name,val,tag?]]} ·
                 bars{heights,x,hl} · qlist{items[]}
   ============================================================ */
window.AI_DATA = {

  /* ---------------- STUDENT ---------------- */
  student: {
    systems: ['tutor', 'data'], examRole: 'learner',
    tutor: {
      name: 'Study Companion', context: 'Biology · Lesson 4: Osmosis',
      seed: "Hi Maya 👋 I'm grounded in your Biology lesson on osmosis. Ask me anything, or start with one of these.",
      suggest: ['Explain osmosis simply', 'Make 5 practice questions', 'Summarise this lesson', 'Quiz me'],
      answers: {
        'Explain osmosis simply': { text: "Osmosis is water moving across a membrane — from where there's lots of water to where there's less — until both sides even out. Like squash spreading evenly through a glass of water.",
          sources: ['Lesson 4 · slide 6', 'Textbook p.112'], actions: ['Make it simpler', 'Give an example'] },
        'Make 5 practice questions': { text: "5 practice questions from today's lesson:",
          result: { type: 'qlist', items: ['Define osmosis in one sentence.', 'Which way does water move across a membrane?', 'What is a hypertonic solution?', 'Why do plant cells stay firm in pure water?', 'Give one real-life example of osmosis.'] },
          sources: ['Lesson 4 · whole deck'], actions: ['Show answers', 'Make 5 more'] },
        'Summarise this lesson': { text: "Lesson 4 in three points:\n• Osmosis = water diffusion across a selectively-permeable membrane.\n• Direction: low → high solute concentration.\n• Affects cells — turgid in water, plasmolysed in salt.",
          sources: ['Lesson 4 · slides 1–9'], actions: ['Make flashcards', 'Add to study plan'] },
        'Quiz me': { text: "Question 1 of 5 — In which direction does water move during osmosis?",
          actions: ['A · High → low solute', 'B · Low → high solute', 'C · No movement'], sources: ['Lesson 4'] },
      },
      fallback: { text: "Good question. From Lesson 4: osmosis only moves water (not the dissolved solute) across the membrane, and it never needs energy. Want me to expand or quiz you on it?",
        sources: ['Lesson 4 · slide 7'], actions: ['Explain more', 'Quiz me'] },
    },
    data: {
      name: 'My Insights', scope: 'My own records only',
      seed: "I can answer about your own attendance, grades and deadlines — nothing about other students.",
      suggest: ['What assignments are due this week?', 'How is my attendance?', 'Show my grade trend'],
      answers: {
        'What assignments are due this week?': { text: "You have 4 assignments due this week:",
          result: { type: 'list', rows: [['Biology · Lab report', 'Tomorrow 5pm', 'warn'], ['Maths · Problem set 7', 'In 3 days'], ['English · Persuasive essay', 'In 5 days'], ['History · Source analysis', 'Submitted', 'ok']] },
          actions: ['Open Biology report', 'Plan my week'] },
        'How is my attendance?': { text: "Your attendance this term is strong:",
          result: { type: 'stat', big: '96%', sub: 'present · 2 lates' }, actions: ['Show by subject'] },
        'Show my grade trend': { text: "Your average is trending up over the last 6 assessments:",
          result: { type: 'bars', heights: [62, 68, 65, 74, 78, 84], x: ['A1', 'A2', 'A3', 'A4', 'A5', 'Now'], hl: 5 }, actions: ['Where to improve?'] },
      },
      fallback: { text: "I can only see your own records. Your attendance is 96%, GPA 3.7, with 4 assignments due this week. What would you like to dig into?",
        result: { type: 'stat', big: '3.7', sub: 'current GPA' }, actions: ['Assignments', 'Attendance'] },
    },
  },

  /* ---------------- TEACHER ---------------- */
  teacher: {
    systems: ['tutor', 'data'], examRole: 'monitor',
    tutor: {
      name: 'Teaching Assistant', context: 'Biology · 11B · Lesson 4',
      seed: "I'm grounded in your Biology 11B material. I can generate questions, summarise lessons or suggest activities.",
      suggest: ['Generate 5 questions on osmosis', 'Summarise my last lesson', 'Suggest a class activity'],
      answers: {
        'Generate 5 questions on osmosis': { text: "5 exam-style questions, mixed difficulty:",
          result: { type: 'qlist', items: ['Define osmosis. (1 mark)', 'Explain water potential. (3 marks)', 'Predict cell behaviour in a hypertonic solution. (2 marks)', 'Describe an osmosis experiment with potatoes. (4 marks)', 'Compare osmosis and diffusion. (3 marks)'] },
          sources: ['Biology 11B · Lesson 4'], actions: ['Add to assignment', 'Export to question bank'] },
        'Summarise my last lesson': { text: "Lesson 4 (Osmosis) covered: definition, water potential, and effect on plant/animal cells. 26 of 28 students completed the follow-up quiz.",
          sources: ['Lesson 4 deck', 'Quiz results'], actions: ['Draft revision notes'] },
        'Suggest a class activity': { text: "Try the potato-in-salt-water practical: groups measure mass change over 30 min, then plot results. Low prep, ties directly to Lesson 4.",
          sources: ['Curriculum · B3.2'], actions: ['Make a worksheet'] },
      },
      fallback: { text: "From your Biology 11B materials I can build questions, summaries, flashcards or activities. What do you need for the next lesson?",
        sources: ['Biology 11B'], actions: ['Generate questions', 'Summarise lesson'] },
    },
    data: {
      name: 'Class Insights', scope: 'My classes & students',
      seed: "I see your 4 classes and their students — not the wider school. Ask about performance, risk or completion.",
      suggest: ['Which students are at risk?', 'Show class average trend', 'Who missed the last assignment?'],
      answers: {
        'Which students are at risk?': { text: "3 students in 11B may need intervention — falling grades plus attendance dips:",
          result: { type: 'list', rows: [['S. Kemi', 'Grade ↓ · 82% att.', 'warn'], ['T. Peters', '2 missed tasks', 'warn'], ['L. Carter', 'Quiz scores ↓', 'warn']] },
          actions: ['Draft a note home', 'Flag to class teacher'] },
        'Show class average trend': { text: "11B average over the last 6 assessments — slight upward trend:",
          result: { type: 'bars', heights: [64, 66, 62, 70, 72, 75], x: ['', '', '', '', '', 'Now'], hl: 5 }, actions: ['Compare to 11A'] },
        'Who missed the last assignment?': { text: "4 students haven't submitted the osmosis lab report:",
          result: { type: 'list', rows: [['T. Peters', 'Not started', 'warn'], ['L. Carter', 'Draft', ''], ['N. Obi', 'Not started', 'warn'], ['S. Kemi', 'Not started', 'warn']] },
          actions: ['Send reminder', 'Extend deadline'] },
      },
      fallback: { text: "Within your classes: 11B average is 75%, 3 students flagged at-risk, and 4 owe the latest lab report. Want details on any of these?",
        actions: ['At-risk students', 'Missing work'] },
    },
  },

  /* ---------------- CLASS TEACHER ---------------- */
  classteacher: {
    systems: ['tutor', 'data'], examRole: 'monitor',
    tutor: {
      name: 'Teaching Assistant', context: '9B · Integrated Science',
      seed: "Grounded in your 9B materials. I can prep questions, summaries or activities for your class.",
      suggest: ['Make a quick starter quiz', 'Summarise this week', 'Suggest a form-time activity'],
      answers: {
        'Make a quick starter quiz': { text: "A 5-question recap starter on the particle model:",
          result: { type: 'qlist', items: ['Name the three states of matter.', 'What happens to particles when a solid melts?', 'Define evaporation in one sentence.', 'Why can gases be compressed but solids cannot?', 'Give one everyday example of condensation.'] },
          sources: ['9B Science · Lesson 6'], actions: ['Project to class'] },
        'Summarise this week': { text: "This week with 9B: 2 lessons delivered, 1 behaviour incident logged, attendance at 93%. Two students need a catch-up on Tuesday's topic.",
          sources: ['9B register', 'Behaviour log'], actions: ['Note for parents'] },
        'Suggest a form-time activity': { text: "Run a 10-minute 'goal of the week' circle — each student sets one academic target. Quick, builds the pastoral relationship.",
          sources: ['Pastoral toolkit'], actions: ['More ideas'] },
      },
      fallback: { text: "For 9B I can prep starters, summarise the week, or suggest pastoral activities. What would help right now?",
        sources: ['9B'], actions: ['Starter quiz', "This week's summary"] },
    },
    data: {
      name: 'Class Insights', scope: 'Class 9B only',
      seed: "I see your 9B class — attendance, behaviour and performance. Ask away.",
      suggest: ["Who's absent in 9B today?", 'Any behaviour alerts?', 'Show class attendance trend'],
      answers: {
        "Who's absent in 9B today?": { text: "2 of 30 students absent today, no reason logged yet:",
          result: { type: 'list', rows: [['Tomi Ade', 'No reason logged', 'warn'], ['K. Bello', 'No reason logged', 'warn']] },
          actions: ['Message parents', 'Mark follow-up'] },
        'Any behaviour alerts?': { text: "1 behaviour alert this week — an incident at break time on Tuesday. Logged, awaiting your note.",
          result: { type: 'stat', big: '1', sub: 'open alert' }, actions: ['Open incident'] },
        'Show class attendance trend': { text: "9B attendance over two weeks — steady around 92%:",
          result: { type: 'bars', heights: [93, 90, 96, 88, 92, 95, 90, 93, 86, 94], x: ['M', 'T', 'W', 'T', 'F', 'M', 'T', 'W', 'T', 'F'], hl: 9 }, actions: ['Who is most absent?'] },
      },
      fallback: { text: "For 9B today: 28 of 30 present, 1 behaviour alert open, attendance ~92% this fortnight. What do you want to look at?",
        actions: ["Today's absences", 'Behaviour'] },
    },
  },

  /* ---------------- PARENT ---------------- */
  parent: {
    systems: ['data'], examRole: 'none',
    data: {
      name: 'Family Assistant', scope: "My children only · Maya & Leo",
      seed: "I can answer about Maya and Leo — progress, attendance, fees and events. I can't see other children.",
      suggest: ['How is Maya doing this term?', 'What does Maya need help with?', 'Any upcoming events?'],
      answers: {
        'How is Maya doing this term?': { text: "Maya is having a solid term — grades up, attendance high:",
          result: { type: 'list', rows: [['Average grade', 'A− · trending up', 'ok'], ['Attendance', '95%', 'ok'], ['Assignments', '2 due this week', 'warn'], ['Fees', '₦120k due 14 Jun', 'warn']] },
          actions: ['See full report', 'Pay fees'] },
        'What does Maya need help with?': { text: "Maths is Maya's weakest area this term (quiz average B). Her teacher suggests 15 min of practice problems, 3× a week. The Study Companion can generate these.",
          actions: ['Open practice plan', 'Message teacher'] },
        'Any upcoming events?': { text: "3 things coming up for your family:",
          result: { type: 'list', rows: [['Parents evening', 'Thu 6pm · book slot', 'warn'], ['Leo · trip consent', 'Due Fri'], ['Term newsletter', 'Published']] },
          actions: ['Book a slot'] },
      },
      fallback: { text: "Across Maya and Leo: Maya is at A− with 95% attendance, Leo just scored B+ in Maths. ₦120k fees are due 14 Jun. Which child shall I focus on?",
        actions: ['Maya', 'Leo'] },
    },
  },

  /* ---------------- PRINCIPAL ---------------- */
  principal: {
    systems: ['data'], examRole: 'monitor',
    data: {
      name: 'School Analytics', scope: 'Whole school · academic',
      seed: "Ask me anything about the school in plain English — attendance, performance, approvals, intervention.",
      suggest: ['How many students were absent today?', 'Which students may need intervention?', 'Show attendance trend'],
      answers: {
        'How many students were absent today?': { text: "108 students absent today (7.6%) — slightly above the term average of 6%. Concentrated in JSS 3 and 9A.",
          result: { type: 'stat', big: '108', sub: 'absent today · 1,312 present' }, actions: ['Break down by class', 'Notify class teachers'] },
        'Which students may need intervention?': { text: "31 students flagged across the school — combining grade drop, attendance and behaviour signals:",
          result: { type: 'list', rows: [['9A', '8 students', 'warn'], ['JSS 3', '11 students', 'warn'], ['SS 1', '7 students', ''], ['SS 2', '5 students', '']] },
          actions: ['Open intervention list', 'Assign to VP Academic'] },
        'Show attendance trend': { text: "School attendance over two weeks — stable, weekend dips expected:",
          result: { type: 'bars', heights: [90, 92, 88, 94, 91, 60, 40, 93, 95, 90, 96, 92], x: ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F'], hl: 10 }, actions: ['Compare to last term'] },
      },
      fallback: { text: "School-wide right now: 1,312 present (92%), 5 approvals pending, 2 discipline cases, 31 students flagged for intervention. What should I pull up?",
        actions: ['Intervention list', 'Approvals'] },
    },
  },

  /* ---------------- OWNER ---------------- */
  owner: {
    systems: ['data'], examRole: 'none',
    data: {
      name: 'School Analytics', scope: 'Whole school · all areas',
      seed: "I cover the whole school — enrolment, finance, staffing and academics. Ask in plain English.",
      suggest: ['Show fee collection this term', 'Which classes have low attendance?', 'How many admissions pending?'],
      answers: {
        'Show fee collection this term': { text: "₦12.4M collected this term — up 9% on last term. ₦3.1M still outstanding across 142 students.",
          result: { type: 'bars', heights: [40, 44, 48, 46, 55, 60, 58, 66, 70, 72, 76, 80], x: ['', '', '', '', '', '', '', '', '', '', '', 'Now'], hl: 11 }, actions: ['Who owes most?', 'Email defaulters'] },
        'Which classes have low attendance?': { text: "3 classes are below the 90% target this week:",
          result: { type: 'list', rows: [['9A', '88%', 'warn'], ['JSS 3', '89%', 'warn'], ['SS 1', '90%', '']] },
          actions: ['Notify class teachers'] },
        'How many admissions pending?': { text: "38 admission applications are awaiting review, 12 submitted in the last 7 days.",
          result: { type: 'stat', big: '38', sub: 'pending · 12 new' }, actions: ['Open review queue'] },
      },
      fallback: { text: "School snapshot: 1,420 students, ₦12.4M revenue this term (▲9%), ₦3.1M outstanding, 38 admissions pending. Where shall I look?",
        actions: ['Finance', 'Admissions'] },
    },
  },

  /* ---------------- VP ACADEMIC ---------------- */
  vpacademic: {
    systems: ['data'], examRole: 'monitor',
    data: {
      name: 'Academic Analytics', scope: 'Academics · all classes',
      seed: "I cover curriculum, lessons, assessment and teaching staff. Ask about coverage, completion or support.",
      suggest: ['Which subjects are behind on curriculum?', 'Which teachers need support?', 'Show assignment completion'],
      answers: {
        'Which subjects are behind on curriculum?': { text: "2 subjects are behind the 75% coverage target for this point in term:",
          result: { type: 'list', rows: [['Physics', '62% · target 75%', 'warn'], ['Chemistry', '69% · target 75%', 'warn'], ['English', '76% · on track', 'ok']] },
          actions: ['Message subject leads'] },
        'Which teachers need support?': { text: "3 teachers flagged for low lesson-plan completion or coverage. Worth a check-in this week.",
          result: { type: 'stat', big: '3', sub: 'teachers flagged' }, actions: ['Open list', 'Schedule reviews'] },
        'Show assignment completion': { text: "Whole-school assignment completion trend — improving:",
          result: { type: 'bars', heights: [58, 60, 64, 66, 70, 72], x: ['', '', '', '', '', 'Now'], hl: 5 }, actions: ['By department'] },
      },
      fallback: { text: "Academics overview: 72% curriculum coverage, 7 lesson plans pending review, Physics behind target, 3 teachers flagged. What next?",
        actions: ['Curriculum gaps', 'Lesson plans'] },
    },
  },

  /* ---------------- VP ADMIN ---------------- */
  vpadmin: {
    systems: ['data'], examRole: 'none',
    data: {
      name: 'Operations Analytics', scope: 'Operations · facilities & staff',
      seed: "I track requests, maintenance, inventory, transport and staff attendance. What needs attention?",
      suggest: ['What maintenance is urgent?', 'Show staff attendance', 'Any inventory below threshold?'],
      answers: {
        'What maintenance is urgent?': { text: "1 urgent and 2 open maintenance requests:",
          result: { type: 'list', rows: [['AC fault · Block C', 'Urgent · 18m ago', 'warn'], ['Projector · Lab 2', 'Open'], ['Plumbing · Hostel', 'Scheduled', 'ok']] },
          actions: ['Assign technician'] },
        'Show staff attendance': { text: "Staff attendance is 92% today — 8 of 96 absent, 2 classes need cover.",
          result: { type: 'stat', big: '92%', sub: '88 of 96 present' }, actions: ['Arrange cover'] },
        'Any inventory below threshold?': { text: "5 inventory items are below reorder threshold — stationery is the most urgent.",
          result: { type: 'list', rows: [['Stationery', 'Below threshold', 'warn'], ['Cleaning supplies', 'Low'], ['Lab consumables', 'Low']] },
          actions: ['Raise purchase order'] },
      },
      fallback: { text: "Operations now: 14 open requests, 1 urgent maintenance (Block C AC), staff attendance 92%, 5 inventory alerts. Where to start?",
        actions: ['Maintenance', 'Requests'] },
    },
  },

  /* ---------------- BURSAR ---------------- */
  bursar: {
    systems: ['data'], examRole: 'none',
    data: {
      name: 'Finance Analytics', scope: 'Finance · fees & payments',
      seed: "Ask me about collections, defaulters, invoices and revenue. Plain English is fine.",
      suggest: ['Show fee collection trends this term', 'Who are the top defaulters?', 'Revenue vs last term?'],
      answers: {
        'Show fee collection trends this term': { text: "Daily collections over two weeks — Fridays peak, weekends quiet:",
          result: { type: 'bars', heights: [50, 62, 45, 70, 55, 30, 20, 66, 72, 58, 80, 64], x: ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F'], hl: 10 }, actions: ['Export report'] },
        'Who are the top defaulters?': { text: "4 students account for the largest overdue balances:",
          result: { type: 'list', rows: [['S. Kemi · SS 1', '₦200k · 56 days', 'warn'], ['A. Rivera · SS 2', '₦120k · 34 days', 'warn'], ['M. Jones · JSS 3', '₦80k · 21 days'], ['T. Peters · JSS 1', '₦60k · 12 days']] },
          actions: ['Send reminders', 'Set payment plan'] },
        'Revenue vs last term?': { text: "Revenue is ₦12.4M this term, up 9% on last term's ₦11.4M. Collection rate improved from 78% to 84%.",
          result: { type: 'stat', big: '+9%', sub: 'vs last term' }, actions: ['Full breakdown'] },
      },
      fallback: { text: "Finance now: ₦12.4M collected (▲9%), ₦3.1M outstanding across 142 defaulters, 27 invoices pending. What shall I pull?",
        actions: ['Defaulters', 'Collections'] },
    },
  },

  /* ---------------- LIBRARIAN ---------------- */
  librarian: {
    systems: ['data'], examRole: 'none',
    data: {
      name: 'Library Analytics', scope: 'Library · catalogue & loans',
      seed: "I cover loans, returns, overdue items and stock. Ask in plain English.",
      suggest: ['What books are overdue?', 'Show borrowing trend', 'Which titles are low stock?'],
      answers: {
        'What books are overdue?': { text: "17 books are overdue — the longest is 20 days:",
          result: { type: 'list', rows: [['Beloved · T. Peters', '20 days', 'warn'], ['Sula · N. Obi', '12 days', 'warn'], ['1984 · L. Carter', '8 days'], ['Americanah · K. Bello', '5 days']] },
          actions: ['Send reminders', 'Apply fines'] },
        'Show borrowing trend': { text: "Borrowing over two weeks — Thursdays are busiest:",
          result: { type: 'bars', heights: [40, 55, 48, 62, 70, 30, 18, 58, 66, 72, 60, 80], x: ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F'], hl: 11 }, actions: ['By genre'] },
        'Which titles are low stock?': { text: "3 titles are down to fewer than 2 copies and have active reservations.",
          result: { type: 'list', rows: [['Half of a Yellow Sun', '1 copy · 3 waiting', 'warn'], ['Purple Hibiscus', '1 copy'], ['Born a Crime', '2 copies']] },
          actions: ['Order more'] },
      },
      fallback: { text: "Library now: 142 issued, 17 overdue, 9 reservations to fulfil, 3 titles low on stock. What would you like?",
        actions: ['Overdue', 'Stock'] },
    },
  },

  /* ---------------- ARCHITECT (platform) ---------------- */
  architect: {
    systems: ['data'], examRole: 'none',
    data: {
      name: 'Platform Analytics', scope: 'Platform · all schools',
      seed: "I see anonymised platform-wide metrics across every tenant — growth, revenue, health. No single-school private data.",
      suggest: ['How many active schools this month?', 'Show MRR trend', 'Which schools are near expiry?'],
      answers: {
        'How many active schools this month?': { text: "1,190 of 1,284 schools are active this month (92.7%) — up 4% on last month.",
          result: { type: 'stat', big: '1,190', sub: 'active · 94 dormant' }, actions: ['Break down by plan'] },
        'Show MRR trend': { text: "Monthly recurring revenue over the last year — steady climb to $84.2k:",
          result: { type: 'bars', heights: [35, 42, 40, 52, 58, 55, 64, 70, 68, 78, 84, 92], x: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], hl: 11 }, actions: ['By region'] },
        'Which schools are near expiry?': { text: "12 schools have subscriptions lapsing within 7 days — worth a retention nudge:",
          result: { type: 'list', rows: [['Little Acorns', '9 Jun · Starter', 'warn'], ['Dawn Nursery', '11 Jun · Starter', 'warn'], ['SkillForge Institute', '15 Jun · Trial', 'warn']] },
          actions: ['Send renewal campaign'] },
      },
      fallback: { text: "Platform now: 1,284 schools, 1,190 active, 312k users, $84.2k MRR (▲6%), 12 near expiry. What shall I surface?",
        actions: ['Growth', 'Renewals'] },
    },
  },

};

/* ------------------------------------------------------------
   Integrity monitor — runs IN PARALLEL with the assistant during
   Assessment Mode (oversight roles keep full AI; this is a track,
   not a replacement). Each flag is expandable (meta + detail) and
   collects human feedback (confirm / false positive).
   ------------------------------------------------------------ */
window.AI_INTEGRITY = {
  teacher: { scope: 'Biology · 11B mid-term', live: 'Auto-monitoring 28 students',
    headline: 'Student Tutor locked for 28 students',
    flags: [
      { hot: true, glyph: '⚑', title: '2 students left the exam tab', sub: '3+ times each · last 4 min', sev: 'High',
        meta: [['Who', 'S. Kemi · T. Peters'], ['Window', '10:42–10:46'], ['Signal', 'Tab blur ×7']],
        detail: 'Both repeatedly switched away from the exam window. The platform logged each blur event; no AI prompts were attempted. Worth a quiet word before drawing conclusions — a notification pop-up can also trigger this.' },
      { hot: false, glyph: '◷', title: '1 long answer pasted in', sub: 'Flagged for style mismatch', sev: 'Review',
        meta: [['Who', 'L. Carter'], ['Question', 'Q4 · 6-marker'], ['Match', 'Style ≠ prior work']],
        detail: 'A 180-word answer was pasted rather than typed, and its phrasing differs from this student\'s previous submissions. Pasting alone is not proof — confirm whether notes were permitted.' },
      { hot: false, glyph: '✦', title: 'AI Tutor blocked 9 prompts', sub: 'All denied during exam window', sev: 'Info',
        meta: [['Attempts', '9'], ['Outcome', '100% denied'], ['Window', 'Exam open']],
        detail: 'Students tried to open the Study Companion 9 times; every request was refused automatically by the exam lock. No answers or hints were served. This is the system working as intended.' },
    ],
    incoming: { hot: true, glyph: '⚑', title: 'S. Kemi left the exam tab again', sub: 'Moments ago · 4th time', sev: 'High',
      meta: [['Who', 'S. Kemi'], ['Time', 'Just now'], ['Signal', 'Tab blur ×4']],
      detail: 'A fresh occurrence seconds ago — this student\'s count is climbing. An in-room check now is more useful than a review after the paper.' } },
  classteacher: { scope: '9B mock exam', live: 'Auto-monitoring 30 students',
    headline: 'Student Tutor locked for 30 students',
    flags: [
      { hot: true, glyph: '⚑', title: '1 student switched device', sub: 'Mid-exam · re-auth required', sev: 'High',
        meta: [['Who', 'K. Bello'], ['Event', 'New device'], ['Status', 'Re-auth sent']],
        detail: 'The student\'s session moved to a different device mid-exam. They were asked to re-authenticate. Common cause is a flat battery — check before escalating.' },
      { hot: false, glyph: '◷', title: '2 students idle 10+ min', sub: 'No answers entered', sev: 'Review',
        meta: [['Who', 'Femi B. · N. Obi'], ['Idle', '10–13 min'], ['Progress', '0 since']],
        detail: 'Two students have entered nothing for over ten minutes. Could be a stuck question or a wellbeing issue — a check-in is suggested rather than a flag.' },
      { hot: false, glyph: '✦', title: 'AI Tutor blocked 4 prompts', sub: 'Denied during exam window', sev: 'Info',
        meta: [['Attempts', '4'], ['Outcome', '100% denied'], ['Window', 'Exam open']],
        detail: 'Four attempts to open the Study Companion were refused automatically. No content was served during the protected window.' },
    ],
    incoming: { hot: true, glyph: '⚑', title: 'Femi B. just crossed idle threshold', sub: 'Moments ago · 12 min, no answers', sev: 'Review',
      meta: [['Who', 'Femi Bassey'], ['Idle', '12 min'], ['Progress', '0']],
      detail: 'Just tipped over the idle limit. Often a stuck question or a wellbeing issue rather than misconduct — a quiet check-in is suggested.' } },
  principal: { scope: 'School-wide · mock exams', live: 'Monitoring 14 exam rooms',
    headline: 'Student Tutor locked across 14 rooms',
    flags: [
      { hot: true, glyph: '⚑', title: '5 integrity flags raised', sub: 'Across 3 classes today', sev: 'High',
        meta: [['Classes', '11B · 9A · JSS 3'], ['Open', '5'], ['Reviewed', '0']],
        detail: 'Five flags are open across three classes, none yet reviewed by a teacher. You can leave these with class teachers or pull the full list to triage centrally.' },
      { hot: false, glyph: '◷', title: 'JSS 3 · 1 device anomaly', sub: 'Reported by invigilator', sev: 'Review',
        meta: [['Room', 'JSS 3'], ['Source', 'Invigilator'], ['System match', 'None']],
        detail: 'An invigilator manually reported a device concern the automated monitor did not catch. Human and system signals are kept separate so neither overrides the other.' },
      { hot: false, glyph: '✦', title: 'AI Tutor blocked 41 prompts', sub: 'Platform-enforced exam lock', sev: 'Info',
        meta: [['Attempts', '41'], ['Outcome', '100% denied'], ['Rooms', '14']],
        detail: 'Across all rooms, 41 attempts to use the student Tutor were refused automatically. The lock is enforced by the platform, not individual invigilators.' },
    ],
    incoming: { hot: true, glyph: '⚑', title: 'New flag raised in 9A', sub: 'Moments ago · device anomaly', sev: 'High',
      meta: [['Room', '9A'], ['Time', 'Just now'], ['Source', 'Auto-monitor']], 
      detail: 'A new device anomaly surfaced in 9A while you were away. It is unreviewed and has been routed to the class teacher; you can take it on if you prefer.' } },
  vpacademic: { scope: 'All exams in progress', live: 'Monitoring all live assessments',
    headline: 'Student Tutor locked for all assessments',
    flags: [
      { hot: true, glyph: '⚑', title: '3 classes with open flags', sub: 'Awaiting teacher review', sev: 'High',
        meta: [['Classes', '11B · 9A · Physics 11A'], ['Open', '3'], ['Owner', 'Class teachers']],
        detail: 'Three classes have unreviewed integrity flags. As VP Academic you can nudge the class teachers or take review ownership yourself.' },
      { hot: false, glyph: '◷', title: 'Physics 11A · pacing alert', sub: '6 students behind schedule', sev: 'Review',
        meta: [['Class', 'Physics 11A'], ['Behind', '6 students'], ['At', 'Q3 of 8']],
        detail: 'Six students are pacing well behind the cohort. This is an academic-support signal, not a misconduct one — useful for after-exam intervention planning.' },
      { hot: false, glyph: '✦', title: 'AI Tutor blocked 41 prompts', sub: 'During protected windows', sev: 'Info',
        meta: [['Attempts', '41'], ['Outcome', '100% denied'], ['Scope', 'All exams']],
        detail: 'The student-facing Tutor refused 41 prompts during protected windows. Staff AI (yours included) continued to operate normally.' },
    ],
    incoming: { hot: true, glyph: '⚑', title: 'New flag · Physics 11A', sub: 'Moments ago · awaiting review', sev: 'High',
      meta: [['Class', 'Physics 11A'], ['Time', 'Just now'], ['Owner', 'Class teacher']],
      detail: 'A new integrity flag was just raised in Physics 11A. Leave it with the class teacher or take review ownership from here.' } },
};
