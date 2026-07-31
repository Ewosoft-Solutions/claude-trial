# 01 · Screenshot register (C001–C135)

One audited entry per image, in canonical sort order (Screenshots by timestamp, then the two Touch Bar artifacts). `*` = required field. Grouped by the flow/domain each screen belongs to. Every entry is **S**-class evidence unless noted. Incumbent = **the legacy system** (the legacy vendor); tenant = _a sample school tenant — Campus A_.

## A. Identity, user provisioning & permission matrix (C001–C015)

- **C001** — _Create New User_ chooser: **Invite via Email** vs **Admin Direct Creation** cards + top-right **Multiple Users Registration** (bulk). Two provisioning philosophies + bulk on one screen.
- **C002** — _Invite via Email_ wizard **Step 1/4** (Basic Info → Privileges → Account & Access → Review). Fields: Title, First*, Last*, Email\*. Minimal PII for invite.
- **C003** — _Admin Direct Creation_ **Step 1/3**. Title, **Staff ID\***, First*, Last*, Email\*, **Mobile (+234, "without country code")**, **Gender\***, **DOB\***, Address (0/200). Direct-create collects far more PII.
- **C004** — Invite **Step 2 Privileges** + **Select All**. Module groups w/ counts: User Management (2), **Academics (23)**, Messaging (4), Human Resource (3), Configuration Hub (3), Payment Manager (5), Health (1).
- **C005** — Step 2 with **Select All checked** → everything granted in one click (no risk preview).
- **C006** — Expanded matrix: **VIEW / EDIT** columns per submodule. Academics → Statistics, Hostel, Assignment, Result, My Classroom, Lesson Note, CBT, BClass…
- **C007** — Academics (cont.): Curriculum, Point System, Feedback, PTC, ECA, FileShare, Transportation, Admission, Attendance — VIEW/EDIT.
- **C008** — Academics (cont.): Transportation, Admission, Attendance, Calendar, Timetable, Census, Report, Student Record, **Library** — VIEW/EDIT. **Taxonomy leak** (Library/Transport/Census nested under "Academics").
- **C009** — Messaging (SMS, Email, NewsFeed, Communication Book) + Human Resource (**Facility, Human Resources, Appointments**) — odd grouping.
- **C010** — Configuration Hub (Configuration, Backup & Restore, Settings) + **Payment Manager (Billing, Payroll, Inventory, Expenses, Payment Record)** + Health. Finance/HR/inventory in one bucket.
- **C011** — Invite **Step 3**: "Is user a staff?" · "Receive all Mails?" · **"Is this a multitenant user?"** toggle. Identity/employment/tenancy conflated.
- **C012** — Step 3 multitenant ON → **Select School Arms**: Campus A, Campus B – Nursery + Select All. Tenant = school; campuses = arms.
- **C013** — **Step 4 Review**: name, staff Yes, multitenant Yes, 2 arms, **41 privileges as chips**. "Invitation link will be sent… user completes profile after accepting." (No password transmitted — good.)
- **C014** — Direct-create Step 1 filled: **async validation** ("Staff ID available"✓, "Email available"✓); Mobile error "Do not include leading zero." NG phone friction.
- **C015** — _Staff Assignment Management_ chooser: **Assign Staff to Subject & Class** vs **View Assigned Staff Log** (the "do vs view" two-card split).

## B. Admissions — legacy shell + "Full Admission Pro." (C016–C024)

- **C016** — **Admission ▸ Applicants** (legacy). Filters (Search, Class, Session 2025/26); enrolment 30-day chart; table w/ **Parent Info (phone+email exposed)**, status "No Payment Attempt". Persistent **"Expires 2026-08-31 · Pay Now"** nag + **Switch School**.
- **C017** — Same with full legacy sidebar: Administration ▸ {User, Admission[Set Admission Fee · Applicants · **Full Admission Pro.**], Staff, Calendar, Feedback} · Academics · Account · Health · Messages · Tools · **Change theme**.
- **C018** — **Set Admission Fee**: Amount*, Enable Online Payment?*, Session\* + **ADMISSION PAYMENT CODE**. Admissions payment silo #1.
- **C019** — **Full Admission Pro. ▸ Dashboard** (modern, embedded). Tabs: **Dashboard · Forms · Responses · Interviews · Payments · Quizzes · Notifications**. KPIs incl. Revenue Collected. Duplicates the legacy Applicants page.
- **C020** — **Responses**: stage pills **All · Pending · Shortlisted · Invited · Interviewed · Admitted · Rejected** + search + category + Export.
- **C021** — **Interviews & Examinations**: Invites/Attended/Pending/Absent; Applicant, Type, Date & Venue, Attendance, Outcome.
- **C022** — **Payment Collection**: Paid/Unpaid/Revenue; Applicant, Amount, Reference, Status. Admissions payment silo #2.
- **C023** — **Admission Quizzes**: "evaluate prospective students before admission" (separate assessment engine).
- **C024** — **Email Notifications**: Total sent/Delivered/Failed + Send Log (To, Subject, Type, Status, Sent At). Admissions-scoped delivery observability.

## C. Staff directory (C025–C027)

- **C025** — **Staff ▸ Search Staff**: single search box. Sidebar: **Search Staff · All Staff** (search as a separate page).
- **C026** — **Staff ▸ All Staff**: dense table — Staff ID, Full Name, **Email/Mobile (exposed)**, Gender, **Status (Enabled/Disabled)**, Assigned Subjects (chips "+51"), **per-row toggle**, **QR code**.
- **C027** — All Staff (scroll): "**Showing 1 to 10 of 106 entries**". Account-enable conflated with employment status.

## D. Calendar & feedback (C028–C031)

- **C028** — **Calendar ▸ Calendar** (create): Event*, Start/End*, Class, **Term\***, Session\*, **Send Notification (2 Days Before & Event Day)**. Tied to term/session.
- **C029** — **Calendar ▸ View Archive** (separate page): rows incl. Resumption Date, **Practical Life Exercises** (Montessori), Mid-Term Vacation. Notification "Both Parent & Staff".
- **C030** — **Feedback ▸ Feedback**: **Parent Cumulative Rating 5/5** ★; table w/ Mobile/Email (exposed), Service Rating, Message.
- **C031** — **Feedback ▸ Request Feedback** (separate): subject/class/term/session → invites w/ response counts (a campaign).

## E. Student management (C032–C043) — 11-page submenu

- **C032** — **Register Students [Online]**: one monolithic form — Admission No*, names, Class/Term/Session of Entry, DOB*, Gender*, **Sport House**, **State/Region/Province** (FCT), **LGA**, Nationality, Last School, **Health Info**, **Religion**, Guardian*, Address\*, Primary/Alt Phone. Identity+admission+enrollment+guardian+health+house in one form.
- **C033** — **Register Students [Excel]**: CSV + **Invite Parents** + template. "**>250 students → batch of 200 (internet speed)**"; **siblings share Primary Phone**; RED=compulsory, ORANGE=necessary. Entry-method fragmentation.
- **C034** — **Generate Password**: term/class/session/admission-no + **☐ SEND VIA SMS / ☐ SEND VIA EMAIL** → Generate. **⚠ REJECT: generates & transmits passwords.**
- **C035** — **Return Students to Class**: rollover/promotion + "ADD SUBJECTS FOR STUDENTS".
- **C036** — **Add Optional Subject**: term/class/session/subjects/admission-no. Elective election.
- **C037** — **Change Student Status**: term/class/session/admission-no + **Status Type**.
- **C038** — **Upload a Photograph** (single) by admission number, 150×150.
- **C039** — **Upload Multiple Photograph** (Zip); "**Total Missing Passport Photographs: 776**"; per-student **Passport + Scanned Admission Docs** upload.
- **C040** — **Search Student**: status dropdown = **Transferred · Deceased · Current · No Class · Graduated · Absconded · ill-Health · Left · Withdrawn · Travelled · Defaulting · Archive**. "**Registered Students: 1115**". ⚠ status enum conflates lifecycle+reason+finance+archival.
- **C041** — **Advance Search**: class dropdown = full taxonomy (Basic 7–9 {Diamond/Emerald/Jasmine}, Kindergarten, Nursery 1–2, Primary 1–6, Reception, **SS1–3 {ARTS/COMMERCIAL/SCIENCE}**, Year 1/6). Stage+arm naming.
- **C042** — **Advance Search** form: class/term/session + ☐ Display Attendance Download (different filters → 2 search pages).
- **C043** — **View all Students** (3rd search page): "1 to 50 of **1115**"; ADM.NO, Name, **Current Class (many blank)**, Gender, **Parent Info (exposed)**, Edit/View/**Transcript(Download)**.

## F. Results — 13-page submenu (C044–C055)

- **C044** — **Load Score [Online]**. Results submenu (13): Load Score Online/Excel · Subject Spreadsheet · Load Remark · Send Result via SMS · Send Result Link via SMS/Mail · End-of-Term Report · Class Report in Batch · Comment Bank · Search Mid-Term Result · Class Term SpreadSheet · Session SpreadSheet.
- **C045** — **Load Score [Excel]**. Footer: **"© the legacy system · the legacy vendor"**
- **C046** — **Subject Spreadsheet** (Class/Term/Session shell).
- **C047** — **Load Remark**: **Remark Type** + subject/class/term/session.
- **C048** — **Send Result via SMS**: **"SMS Balance: 0 Units"**; Result Division; subject checkbox grid incl. **Basic Digital Learning, Citizenship & Heritage** + duplicate cultural subjects.
- **C049** — Recipient dropdown = **Father · Father & Mother · Mother**. ⚠ patriarchal targeting.
- **C050** — **Send Result Link via SMS/Mail**: Recipient Mode ☑ Email ☑ SMS.
- **C051** — **Student End-of-Term Report** (single).
- **C052** — **Class Report in Batch**: "**batch of 20 reports per page**" → Download.
- **C053** — **Search Mid-Term Result**: Result Division = **CA1 · CA2 · CA3 · CA4 · EXAM · CA**. ⚠ NG continuous-assessment scheme.
- **C054** — **Class Term SpreadSheet** + "Subject(s) To Skip"/"Add On Fields" + **skill-area analytics** ("7 students need interventions in English"). Grade scale incl. **A+**.
- **C055** — **Session SpreadSheet**: Class ("**40 ALL SELECTED**" → ~40 classes).

## G. Attendance, teacher dashboard & CBT (C056–C063)

- **C056** — **Attendance ▸ Attendance** (mark). Submenu: Attendance · View Attendance · Subject Attendance · Subject Att. Report. Uses Class/Session/Term shell (no date picker).
- **C057** — **View Attendance** (same shell; mark vs view split).
- **C058** — **Teacher "My Class Dashboard"**. ⚠ **Classes/Form Tutor 0 but Assigned Subjects/Classes 706**; Total Students 422; Attendance 91.05%. Grade donut A/A+/B/B+/C/C+/D/**Exc**/F; empty at-risk/formative charts; **red "My Attendance" donut**; **"Get Insight From AI"**.
- **C059** — **Cbt ▸ Create Exam/Test**: Subject, Result Division, **Max Question (Max 60, network strength)**, Duration, For Online?, Exam Type, Marking Type, **Reshuffle?**, **Multiple Attempt?**, **Show Score After?**.
- **C060** — **Add Question**: Upload **Excel**, Upload **Aiken** ("scored 1 mark/q") + cards **Download Template · Reuse Questions · Generate with AI · Add Online** (5 authoring paths).
- **C061** — Select Exam(s): multi-exam attach; exam key = Subject+Division+Class+Term+Session+timestamp.
- **C062** — **View Created Exam/Test**: **18-column** table (Error?, Creator, Online/Offline, Reshuffle, Exam Type…). Note "author ≥4h / add questions ≥24h before".
- **C063** — **Collate Script**: ⚠ **manual CBT→gradebook handoff** ("collate then re-save under LoadScore").

## H. Homework & lesson-plan (C064–C074)

- **C064** — **Homework ▸ Create Assignment**: Work Type, class/term/session/subject, **target Admission Numbers**, **rich body (TinyMCE)**, attach (**<2MB**), **Due Date/Time**, Send Immediately?.
- **C065** — Target-student picker (SELECT ALL + student list). Individual targeting.
- **C066** — **View Assignment**: DETAIL, CREATOR, **OWNER** (all/specific), **Submission count**, Due Date, "5 months ago". No rich submission workflow.
- **C067** — **Lesson-plan ▸ Create Lesson Plan**: Topic\*, Sub-Topic, **Curriculum\***, **Priority**, pre-filled template (PERIOD/DURATION/OBJECTIVES/PREVIOUS KNOWLEDGE…), Attach Teacher's Copy, **Select Supervisor\***, **Copy Colleagues**. ⚠ "Mobile editor under construction".
- **C068** — **Lesson Plan Template**: Name\*, **Make Default?**, reusable templates.
- **C069** — **Student Notes** (modern): upload + Awaiting/Needs Revision/Approved/Total; status filters. Materials with approval workflow.
- **C070** — **lesson Plan(s)** (modern): "**156 total**"; **Awaiting 58 / Approved 98**; Supervisor + Teacher's Copy columns. New NERDC subjects present.
- **C071** — **Admin Review** (Lesson Plans tab): Review Priority/Content Type filters; Preview / Quick Note; **overdue tracking**.
- **C072** — **Admin Review** (Student Notes tab): 4 materials incl. a **French** note (bilingual). One review engine over plans+notes.
- **C073** — Admin Review at scale: **Awaiting 2286 / Approved 352 / Withdrawn 7 / Total 2647**. "**Nigeria-British**" (blended curriculum).
- **C074** — Review modal: structured Lesson Content + **Supervisor Comments** thread.

## I. BClass & curriculum (C075–C081)

- **C075** — **BClass** = "Classroom Beyond Walls": Video Conferencing · **Online Homework · CBT · E-Note · Comm Book** (duplicates existing modules) + video.
- **C076** — **My Class Archive**: engagement analytics + **Export as Spreadsheet**.
- **C077** — **Curriculum ▸ Curriculum**: **National Curriculum Content 9,427**, AI Trained 0, Teachers Edited Copy 0. Submenu incl. **Pedagogy with AI**.
- **C078** — **Create Curriculum**: Name\*, **Content Source\*** → fork ("a sample school tenant Sample").
- **C079** — **Create Topics**: Curriculum/Class/**Copy Other Class**/Subject/Topic + Scheme of Work. Class→Subject→Topic hierarchy.
- **C080** — Subjects in a class: topic counts; ⚠ **duplicate "Cultural & Creative Arts" vs "Cultural And Creative Arts"**; NG subjects (Igbo, PHE, RNV); **Edit Subject Name** inline.
- **C081** — **Pedagogy with AI**: **Teachers Copy From AI** per topic. ⚠ no provenance/approval.

## J. Legacy Payment module — 12 pages (C082–C094)

- **C082** — **Fund Parent Wallet**: "**same phone for children of same parent**"; Amount*, Method*, **Teller/Transaction ID**, Bank, confirm, Notify. Family wallet keyed by phone; manual reconciliation.
- **C083** — **Pay For Students**: admission-no/term/class/session.
- **C084** — **Parent Wallet History**: Transaction ID, Amount (**0**), Student Detail, Mode, **RETRY (Incomplete Transaction)**. Gateway failures visible; data to 2021/22.
- **C085** — **Student Payment Record** (by receipt number).
- **C086** — **Search Defaulters** + **INTER-SCHOOL DEFAULTERS**. ⚠ stigma term.
- **C087** — **Set Payment Charges/Bills** (fee catalog): Name*, Amount*, Term, **Type (Compulsory/Not)**, Category, **Student(s) To Charge**; rows "**TUITION (Owned by 2250) – not for everyone**" ₦214k, Registration, Waist Coat, Development Levy, Textbooks, Uniform, Feeding, Transport… **(ALREADY IN USE)** lock.
- **C088** — Charges scroll (rows 19–50): per-arm duplication; Tuition SS3 Science ₦217k.
- **C089** — **Send and Print Bill**: attach note, Send To Parent, Display Optional Payment?.
- **C090** — **Post Discounts**: Amount\*, **Remark/Reason\*** ("FROM MANAGEMENT (on TUITION)", "EARLY PAYMENT"), **Edit + Delete**. ⚠ discounts mutable/deletable, applied per-charge.
- **C091** — **Brought-Forward Debt** (CSV) + ADD DEBTORS ONLINE: ANGEL NDUKA ₦200k, … CHIDIOGO NWAOHA ₦4k (**2021/2022**). ⚠ **opening-balance migration**.
- **C092** — **Payment Periodic Report**: date range (labels "MM/DD" vs "DD/MM" inconsistent) → Generate/Print.
- **C093** — **Payment Broadsheet** (class/term/session).
- **C094** — **Sage One Setup**: "Link Your Sage" — **Sage Username + Password**. ⚠ **REJECT credential capture.**

## K. Full Account — newer accounting suite (C095–C102)

- **C095** — **Full Account ▸ Dashboard**. Nav: **Dashboard · Income · Expenses · Budget · Payroll · Inventory · Report · Finance**. KPIs Income/Payroll/Expenses/Net P&L; **Break-Even Required**; **Financial Health "Moderate"**; Recent Transactions (Student Payment ₦226k/₦591k…, Posted By). Student payments auto-flow to income.
- **C096** — **Income**: Source ("Grant/Donation"; **"Student fees auto-imported"**), Link to Budget, **Amount ("negative for adjustments/reversals")**, Method. ⚠ negative-reversal anti-pattern.
- **C097** — **Expenses**: Category (+add), **negative for refunds** anti-pattern.
- **C098** — **Budget**: Type*, Allocated (NGN)*, **Fiscal Year\***, planned-vs-actual.
- **C099** — **Payroll Management**: tabs Staff Salary · Allowances · Deductions · **Staff Packages** · Process Payroll · History · Reports. **Active Staff 75, Allowance Types 6**. No NG statutory/approval visible.
- **C100** — **Inventory Management**: tabs Items · Stock In · Sales · Issue · **Assets** · Approvals · Alerts · Reports. Categories Uniform/Stationery/Cleaning/Foodstuff/Furniture/Equipment; consumables + fixed assets.
- **C101** — **Report**: Report Type + dates → Generate/Print/**Export Excel** (contrast our stubbed export).
- **C102** — **Finance ▸ Financial Dashboard** (per campus): Inflow/Outflow/**Net Cash Flow**; **Accumulated Depreciation**; **6-Month Financial Trend**.

## L. Engagement — Communication / SMS / Email (C103–C111)

- **C103** — **Communication ▸ Send Message**: term/class/session + **Type Of Report** (report-linked send). 3 messaging entry points.
- **C104** — **Communication ▸ Sent Message**: "**0 to 100 of 589 Email(s)**"; Message Type **Result Publication**; Total Receiver (View). Results delivered as report emails.
- **C105** — **Sms ▸ SMS Balance**: "**0 Units**"; top-up ledger (Units 5310/4000… 2021→2025). Prepaid/metered.
- **C106** — **Sms ▸ Create SMS**: Sender*, Receivers, **Send To All Parent/Staff**, Message*.
- **C107** — **Sms ▸ Sent Messages**: "**1 to 50 of 19539**"; **Unit Used 2.5/3**, **Number Type NEW DND / NORMAL** (NG regulatory), Sent By SYSTEM/user.
- **C108** — SMS message preview: result-link SMS `https://api.the legacy system.net/url/?url=…`. ⚠ tokenized-but-public result link.
- **C109** — **Email ▸ Compose Email**: **To Parents · To Educators · By Class · To All**.
- **C110** — **Email ▸ Sent Mails**: same **589-email** dataset as Communication (duplicate view).
- **C111** — Email Details modal: per-email **recipient emails exposed**.

## M. Tools ▸ Configuration — 15 result/academic pages (C112–C130)

- **C112** — **Publish and Lock Result**: Result Division, Class, **Admission Number To Lock From The Result**, notify; table **Result Type (CA/CA1–4/EXAM/FULL RESULT)**, **Blocked Admission No.**, **Publisher**, **Unpublish**. ⚠ per-student result blocking (finance↔academics coupling).
- **C113** — **Set Subject**: catalog w/ **No. Students Historically** + Milestones + Compulsory. New NERDC subjects + duplicate/garbage ("Cultural" 0, "Diction" 500).
- **C114** — **Set Grading System**: **WAEC (A1 75–100 … F9 0–39)** + Common Standards; per-class custom scales. ⚠ **corrupted migrated grades** ("Exce" 75, "A ve" 70).
- **C115** — **Enable/Disable Position**: ranking toggle **For Subjects** + **For Overall** (both Enabled). Should be policy, default-off.
- **C116** — **Set Classes**: **free-text** creation + sample-class grid (Basic/Kindergarten/Nursery/Primary/**JSS/SSS/High School/Grade/Year/WAEC/NECO**) + historical counts.
- **C117** — **Set Next Term Day**: **Resumption/vacation dates** per term/session (to 2016/17) + **SET SPECIAL TERMS**.
- **C118** — **Set Promotion Cutoff**: single **min %** per class ("OTHERS – 45"). Crude.
- **C119** — **Set Subjects for Classes**: per-class compulsory subjects; **Montessori** (Practical Life Exercises, Sensorial Ed, Handwriting) + **French/Yoruba** + NERDC. Curriculum offering.
- **C120–C125** — **Set Remark**: **724+ rules** (Stating Value × **Type Subject/Principal** × Class); descending-order rule; ⚠ **promotion decisions embedded in prose** ("Promoted to SS 3. Congratulations."). Repeated per arm.
- **C126** — **Upload Sch Logo**: logo + **Principal/Headmaster/Proprietor/Proprietress/Administration/Director signatures as images** in one row. ⚠ unguarded.
- **C127** — **Upload Signatures**: officer signatures (same exposure).
- **C128** — **Upload Staff Signature**: "**1 to 100 of 104**"; every staff signature image next to Email/Mobile. ⚠ mass exposure.
- **C129** — **Add Email**: "Add School Email Address" (sender identity).
- **C130** — **Select Result Template** → **"OOPS! YOU'RE NOT AUTHORIZED"** (crest). Authz exists; opaque denial UX.

## N. Dashboards, user directory & AI (C131–C133)

- **C131** — **School Main Dashboard**: Active Students **1,115**, Educators **73**, Attendance 0%, Income ₦0; Students Population (First 622 / Second 628 +1% / Third 547 −13%); **Overall Learning Progress (Summative vs Formative per subject)**; **Foundational Subject Growth** (Maths/Literacy × Male/Female, 2018–2026); Gender (Male/Female/**Not Specified**); Payment/Behaviour (0); Birthdays. ⚠ chart-museum, many zeros, no definitions/freshness.
- **C132** — **Administration ▸ User ▸ All Users** (modern indigo): submenu Create User · **Reset Password** · **Assign Subject & Class** · All Users. Email/Mobile exposed; Enabled/Disabled toggle. ⚠ **duplicates All Staff** across two UI generations.
- **C133** — School Dashboard (lower): Educator Birthdays; **AI Assistance (Beta)** chat ("Remember AI can make mistakes"); **Academic Performance Trends** = **40+ subject donut gauges** (Insurance 26% … Global Perspective 88%). AI embedded; gauge overload.

## O. Non-product artifacts (C134–C135)

- **C134 / C135** — **MacBook Touch Bar** captures (browser controls). **Not product screens** — excluded from feature analysis; confirm Chrome-on-Mac capture.
