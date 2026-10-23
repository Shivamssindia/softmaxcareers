# SoftMax Client & IT Careers Portal

> **Official Client, Consulting & IT Careers Portal for SoftMax** ([softmax.in](https://softmax.in))  
> Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Firebase Auth**.

---

## 🌟 Key Features

### 1. 🏠 Index (Home) Page (`/`)
- **Hero Banner**: *"Let's grow with Us — We Learn, Build & Scale Together"* with dynamic ambient lighting.
- **Core Specializations**:
  - Website Development (Next.js 14/15, Headless CMS, Core Web Vitals).
  - System Designing (Distributed architectures, Kafka, Redis caching, microservices).
  - Custom Software Development (Enterprise SaaS, Go/Node APIs, containerization).
- **Learning & Growth Culture**: Highlights SoftMax's hands-on learning environment, developer mentorship, and hackathons.
- **Featured Openings**: Dynamic preview cards for both Tech and Non-Tech IT jobs with 1-click apply.
- **Direct Bridge to Main Portal**: One-click external links to [softmax.in](https://softmax.in).

### 2. 🏢 About Page (`/about`)
- Company mission, vision, engineering pillars, and core values.
- **Prominent Main Portal Showcase**: Interactive banner directing enterprise clients to [softmax.in](https://softmax.in).

### 3. 🛠️ Our Technologies Page (`/technologies`)
- Detailed breakdown across:
  - **Web & Frontend**: Next.js, React 18, TypeScript, Tailwind CSS, Framer Motion.
  - **System Design & Architecture**: Distributed event streaming (Apache Kafka), in-memory clusters (Redis), gRPC, load balancing.
  - **Backend Engineering**: Go (Golang), Node.js, NestJS, Python & FastAPI.
  - **Cloud, DevOps & Containers**: AWS, GCP, Docker, Kubernetes (EKS/GKE), Terraform (IaC), CI/CD.
  - **Databases & Real-time**: PostgreSQL, MongoDB, Firebase Firestore & Auth.
- Interactive category filter tabs and system design benchmark metrics.

### 4. 💼 Openings & IT Careers Page (`/openings`)
- **Tech & Non-Tech IT Tracks**:
  - **Tech Roles**: Full Stack Engineers, Distributed Systems Architects, Backend Engineers, Cloud/DevOps, UI/UX Designers, AI Engineers.
  - **Non-Tech IT Roles**: Technical Project Managers, Scrum Masters, IT Business Analysts, Technical Recruiters, Enterprise IT Sales Executives.
- **Themed Job Cards**: Displays compensation, experience level, location format (Remote/Hybrid), tags, and detailed role modal.
- **Instant Redirection**: "Apply Now" button links directly to `/apply?jobId=...`.

### 5. 📝 Apply Form (`/apply`)
- Pre-selects role from Job Card or dropdown.
- Collects candidate details: Full Name, Email, Phone Number, Years of Experience, Portfolio/LinkedIn URL.
- **Role-Related Description**: Candidate statement describing background and fit for the role.
- **Resume Upload Component**: Drag-and-drop or click to upload PDF/DOC/DOCX up to 10MB with instant preview and base64 storage.
- Instant confirmation and direct redirect to the **Candidate Console**.

### 6. 🧑‍💻 Candidate Console (`/candidate`)
- Dedicated dashboard for registered candidates.
- Real-time application tracker with live status badges:
  - `Submitted` ➔ `Under Review` ➔ `Shortlisted` ➔ `Interview Scheduled` ➔ `Offer Extended` / `Rejected`.
- Visual 4-stage hiring pipeline progress bar.
- Resume viewer and download action.
- Recruiter feedback notes.

### 7. 🛡️ Admin Portal (`/admin`)
- **Job Openings CRUD**:
  - **Create**: Add new job openings with title, Tech/Non-Tech category, department, experience, salary, and requirements.
  - **Read**: List of active and archived jobs with applicant counts.
  - **Update**: Edit existing job opening details.
  - **Delete**: Archive/remove job postings.
- **Candidate Applications & Resume Management**:
  - View all candidate submissions across all jobs.
  - Filter by job opening or status.
  - Review candidate statements and download/view submitted resumes.
  - 1-click status transitions (`Submitted`, `Under Review`, `Shortlisted`, `Interview Scheduled`, `Offer Extended`, `Rejected`).

### 8. 📞 Contact Page (`/contact`)
- SoftMax Bengaluru HQ location, direct telephone lines, and specialized email inboxes (`contact@softmax.in`, `careers@softmax.in`, `solutions@softmax.in`).
- Interactive inquiry form for client project partnerships and career questions.
- Link to [softmax.in](https://softmax.in).

### 9. 🔐 Header & Firebase Authentication
- Sleek frosted-glass header with logo, navigation links, and profile badge.
- **Auth Modal**: Sign in / Sign up with Firebase Auth.
- **Instant Demo Switcher**: 1-click toggle between **Candidate View** and **Admin View** for rapid testing without manual registration.

---

## 🚀 SEO & Mobile Responsiveness

- **Google for Jobs Rich Snippets**: Native JSON-LD structured data (`JobPosting`, `Organization`, `WebSite`) adhering to Schema.org standards so jobs appear at the top of Google search.
- **Search Optimization for IT Searches**: Tailored keywords and headings targeting *"Jobs in IT field (Tech and Non-Tech)"*, *"IT consultant portal"*, *"SoftMax careers"*, *"website development"*, and *"system designing"*.
- **Crawlability**: Automated [`sitemap.xml`](file:///D:/Client%20Portal/app/sitemap.ts) and [`robots.txt`](file:///D:/Client%20Portal/app/robots.ts).
- **100% Mobile Responsive**: Tested across mobile (320px+), tablet, laptop, and ultra-wide desktop viewports.

---

## 💻 Getting Started

### 1. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Configure Firebase (Optional)
Create `.env.local` based on `.env.example`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```
*(Note: If Firebase credentials are not yet added, the portal runs in fully functional Local/Demo mode automatically).*



Api to send consultent 