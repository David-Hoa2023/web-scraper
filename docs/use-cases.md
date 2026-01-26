# Web Scraper Pro - Use Cases

This document outlines user stories, pain points addressed, and step-by-step guides for each key feature.

---

## User Story 1: Data Analyst Extracting Product Listings

### Persona
**Sarah**, a data analyst who needs to collect product data from e-commerce websites for competitive analysis.

### Pain Points
- Manually copying data from websites is time-consuming and error-prone
- Infinite scroll pages make it impossible to "Select All" and copy
- Data comes in inconsistent formats requiring extensive cleanup
- No way to schedule regular data collection

### How Web Scraper Pro Helps
- **Pattern Detection** automatically identifies repeating product cards
- **Auto-Scroll** handles infinite scroll pages seamlessly
- **Structured Export** outputs clean JSON/CSV with consistent fields
- **Scheduled Tasks** automate recurring data collection

### Step-by-Step Guide

1. **Install & Open**
   - Load the extension in Chrome (`chrome://extensions` → Load unpacked → select `dist/`)
   - Navigate to the target e-commerce page
   - Click the Web Scraper Pro icon in the toolbar

2. **Configure Pattern Detection**
   - Go to **Match Strategy** tab
   - Enable matching options (Tag Name, Classes recommended)
   - Set auto-scroll throttle (1000ms default works for most sites)

3. **Start Scanning**
   - Return to **Dashboard** tab
   - Click **Start Scanning**
   - Hover over a product card — similar items will highlight automatically

4. **Let Auto-Scroll Collect Data**
   - The extension scrolls the page and collects items
   - Monitor progress in the stats panel (Items Collected)
   - Click **Pause** if needed, **Resume** to continue

5. **Export Your Data**
   - Go to **Extraction** tab
   - Click **Export Data**
   - Data downloads as JSON (configure CSV/Excel in Settings)

---

## User Story 2: Trainer Creating Software Tutorials

### Persona
**Mike**, a corporate trainer who creates onboarding tutorials for internal software tools.

### Pain Points
- Screen recording software doesn't capture click locations clearly
- Writing step-by-step instructions manually takes hours
- Keeping tutorials updated when UI changes is tedious
- No way to generate professional documentation automatically

### How Web Scraper Pro Helps
- **DOM Event Capture** records every click, input, and navigation
- **Video Recording** captures screen with smooth cursor overlay
- **LLM Content Generation** auto-generates written instructions
- **Multiple Export Formats** (Markdown, PDF, Video)

### Step-by-Step Guide

1. **Open Recording Panel**
   - Navigate to the application you want to document
   - Click the Web Scraper Pro icon
   - The Recording Panel appears in the top-right corner

2. **Configure Recording Settings**
   - Click the **Settings** (gear) icon
   - Enable **Capture Video** for screen recording
   - Enable **Capture DOM Events** for interaction logging
   - Enable **Cursor Smoothing** for professional-looking playback
   - Select **Video Quality** (Medium recommended)

3. **Configure LLM (for auto-generated guides)**
   - In Settings, select your **Provider** (OpenAI/Anthropic)
   - Enter your **API Key**
   - Choose a **Model** (GPT-4 or Claude 3 recommended)

4. **Start Recording**
   - Click **Start Recording**
   - Perform the workflow you want to document
   - Speak or act naturally — every interaction is captured

5. **Stop & Generate**
   - Click **Stop** when finished
   - The system processes your recording
   - LLM generates step-by-step instructions automatically

6. **Export Tutorial**
   - Click **Markdown** for documentation
   - Click **PDF** for printable guides
   - Click **Video** for video tutorial with cursor overlay

---

## User Story 3: Developer Documenting API Workflows

### Persona
**Alex**, a developer who needs to document how to use a web-based admin panel for the team wiki.

### Pain Points
- Screenshots become outdated quickly
- Hard to capture the exact sequence of clicks
- Writing docs takes time away from coding
- No automated way to keep documentation current

### How Web Scraper Pro Helps
- **Interaction Recording** captures exact click sequences
- **Automatic Screenshots** at key interaction points
- **LLM-Generated Docs** produce clear, technical documentation
- **Markdown Export** integrates directly with wikis/GitHub

### Step-by-Step Guide

1. **Prepare Your Workflow**
   - Open the admin panel or web app
   - Plan the workflow you want to document

2. **Start a New Recording**
   - Open Web Scraper Pro
   - Click **Start Recording** in the Recording Panel

3. **Perform the Workflow**
   - Click through each step deliberately
   - Fill in forms, click buttons, navigate pages
   - The extension captures:
     - Every click with element selector
     - Form inputs and values
     - Page navigations
     - Timestamps for each action

4. **Review Captured Events**
   - Stop the recording
   - View the event count in the Recording Panel
   - Events are logged with context (element type, text, URL)

5. **Generate Documentation**
   - Click **Markdown** export
   - LLM generates documentation like:
     ```markdown
     ## Step 1: Navigate to Users
     Click the **Users** link in the sidebar.

     ## Step 2: Create New User
     Click the **Add User** button in the top-right corner.

     ## Step 3: Fill User Details
     Enter the username in the **Username** field...
     ```

6. **Copy to Wiki**
   - Open the downloaded Markdown file
   - Paste into your wiki, README, or documentation site

---

## User Story 4: Business User Automating Price Monitoring

### Persona
**Lisa**, a procurement manager who needs to monitor competitor prices weekly.

### Pain Points
- Checking multiple websites manually every week is inefficient
- Price changes are missed between checks
- No alerts when significant changes occur
- Data is scattered across browser tabs and spreadsheets

### How Web Scraper Pro Helps
- **Scheduled Tasks** run automatically at set intervals
- **Webhook Integration** sends data to external systems
- **Task Dashboard** shows all monitoring jobs at a glance
- **History Tracking** compares data across runs

### Step-by-Step Guide

1. **Create a New Task**
   - Open Web Scraper Pro
   - Click **New Task** button on Dashboard

2. **Configure General Settings (Step 1 of Wizard)**
   - Enter **Task Name**: "Competitor Price Check"
   - Enter **Target URL**: the competitor's product page
   - Add optional **Description**
   - Click **Next**

3. **Set Schedule (Step 2 of Wizard)**
   - Select **Frequency**: Weekly
   - Set **Max Items**: 100 (or as needed)
   - Set **Timeout**: 300 seconds
   - Click **Next**

4. **Configure Export (Step 3 of Wizard)**
   - Select **Export Format**: JSON or CSV
   - Enter **Webhook URL** (optional): your endpoint for receiving data
   - Enable **Auto-export on completion**
   - Click **Create Task**

5. **Configure Webhook Notifications**
   - Go to **Settings** tab
   - Scroll to **Webhooks & Integrations**
   - Enter your webhook URL
   - Enable **Send on task completion**
   - Enable **Include extracted data**
   - Click **Test Webhook** to verify

6. **Monitor Your Tasks**
   - View all tasks in the **Scheduled Tasks** table on Dashboard
   - Check **History** tab for past runs
   - Review success rate in the stats panel

---

## User Story 5: QA Engineer Capturing Bug Reproduction Steps

### Persona
**Jordan**, a QA engineer who needs to document exact steps to reproduce bugs.

### Pain Points
- Developers can't reproduce bugs from vague descriptions
- Screenshots don't show the sequence of actions
- Writing detailed repro steps is time-consuming
- Steps get lost in chat messages and tickets

### How Web Scraper Pro Helps
- **Precise Event Logging** captures exact selectors and actions
- **Video Evidence** shows the bug occurring
- **Auto-Generated Steps** create clear reproduction instructions
- **Export to Markdown** for easy ticket attachment

### Step-by-Step Guide

1. **Prepare to Capture the Bug**
   - Navigate to where the bug occurs
   - Open Web Scraper Pro Recording Panel

2. **Record the Bug Reproduction**
   - Click **Start Recording**
   - Perform the exact steps that trigger the bug
   - Let the bug occur on screen

3. **Stop and Review**
   - Click **Stop** after the bug appears
   - Note the event count (each action captured)

4. **Export for Bug Report**
   - Click **Markdown** for text steps
   - Click **Video** if visual proof needed
   - Generated output includes:
     - Numbered steps with exact actions
     - Element selectors (useful for developers)
     - Timestamps
     - URL at each step

5. **Attach to Bug Ticket**
   - Copy Markdown into JIRA/GitHub issue
   - Attach video file if exported
   - Developers can follow exact steps to reproduce

---

## User Story 6: Social Media Researcher Collecting Feed Data

### Persona
**Carlos**, a social media researcher who needs to collect posts from Twitter/X and Reddit for sentiment analysis.

### Pain Points
- Social media feeds use "virtualized lists" — old posts disappear from DOM as you scroll
- Copy-paste loses formatting and metadata (likes, timestamps, usernames)
- Rate limits and infinite scroll make manual collection impossible
- Posts are ephemeral and may be deleted before analysis

### How Web Scraper Pro Helps
- **Immediate Extraction** captures data as soon as posts enter viewport (before they're removed)
- **MutationObserver Integration** detects new posts being added dynamically
- **In-Memory Storage** preserves data even after DOM nodes are recycled
- **Auto-Scroll** handles infinite feeds automatically

### Step-by-Step Guide

1. **Navigate to the Feed**
   - Open Twitter/X, Reddit, or similar infinite-scroll site
   - Apply any filters or search terms you need

2. **Configure for Social Media**
   - Open Web Scraper Pro → **Match Strategy** tab
   - Enable **Match Tag Name** and **Match Classes**
   - Set throttle to **1500-2000ms** (social sites load slower)
   - Set **Max Items** to your target (e.g., 500 posts)

3. **Start Scanning**
   - Click **Start Scanning** on Dashboard
   - Hover over a post card to detect the pattern
   - The tool highlights all similar posts

4. **Let It Run**
   - Auto-scroll collects posts continuously
   - Data is extracted immediately and stored in memory
   - Even if posts disappear from DOM, data is preserved

5. **Export for Analysis**
   - Stop when you reach your target
   - Export as JSON for data analysis tools
   - Each record includes: text, images, links, metadata

---

## User Story 7: Developer Scraping Modern SPA Sites

### Persona
**Priya**, a developer who needs to scrape data from a React/Vue site with dynamically generated class names.

### Pain Points
- Class names like `css-175oi2r` change on every build
- Traditional CSS selectors break constantly
- Sites use complex nested components
- Shadow DOM encapsulates content

### How Web Scraper Pro Helps
- **Structure-Based Matching** uses DOM tree depth and tag hierarchy, not just classes
- **Multiple Match Strategies** (tag, class, ID, data attributes)
- **Shadow DOM Handler** traverses shadow boundaries
- **Pattern Refinement** lets you adjust detection manually

### Step-by-Step Guide

1. **Analyze the Site Structure**
   - Open browser DevTools (F12)
   - Identify the repeating pattern (look for consistent tag structure)
   - Note if Shadow DOM is used (look for `#shadow-root`)

2. **Configure Match Strategy**
   - Open Web Scraper Pro → **Match Strategy** tab
   - For dynamic classes: Enable **Match Tag Name**, disable **Match Classes**
   - For data-driven sites: Enable **Match Data Attributes** (e.g., `data-testid`)
   - For Shadow DOM: The extension automatically traverses shadow boundaries

3. **Test Pattern Detection**
   - Click **Start Scanning**
   - Hover over different elements to find the best match
   - Look for the pattern that highlights all target items

4. **Refine If Needed**
   - If too many items match: Enable more match criteria
   - If too few match: Disable restrictive criteria
   - Use **Match ID** sparingly (IDs are often unique)

5. **Handle Edge Cases**
   - For lazy-loaded images: Increase throttle delay
   - For virtualized lists: Data is captured before removal
   - For auth-required content: Log in first, then scrape

---

## User Story 8: Content Moderator Auditing User-Generated Content

### Persona
**Maria**, a content moderator who needs to audit user-generated content across multiple pages.

### Pain Points
- Manually reviewing hundreds of posts is exhausting
- Need to capture both text and images for review
- Content changes or gets deleted before review
- No audit trail of what was reviewed

### How Web Scraper Pro Helps
- **Batch Collection** gathers all content in one run
- **Image Extraction** captures image URLs automatically
- **Timestamped Data** creates an audit record
- **Export to Spreadsheet** for team review workflow

### Step-by-Step Guide

1. **Set Up Audit Task**
   - Navigate to the content feed or page
   - Open Web Scraper Pro

2. **Configure for Content Capture**
   - Go to **Extraction** tab
   - Enable **Preserve Hierarchy** to maintain context
   - Enable **Normalize Text** for consistent formatting

3. **Run the Audit**
   - Start scanning and let auto-scroll collect all content
   - Monitor progress in Dashboard stats

4. **Export Audit Record**
   - Export as JSON or CSV
   - Data includes:
     - Text content
     - Image URLs
     - Link destinations
     - Extraction timestamp

5. **Set Up Recurring Audit**
   - Create a scheduled task for daily/weekly audits
   - Configure webhook to send data to your moderation queue
   - Track history to compare content over time

---

## Quick Reference: Feature → Pain Point Mapping

| Feature | Pain Points Addressed |
|---------|----------------------|
| Pattern Detection | Manual selection, inconsistent data structure |
| Auto-Scroll | Infinite scroll pages, incomplete data capture |
| DOM Event Capture | Missing interaction details, unclear sequences |
| Video Recording | No visual proof, poor cursor visibility |
| Cursor Smoothing | Unprofessional recordings, jerky mouse movement |
| LLM Content Generation | Time-consuming documentation, writer's block |
| Scheduled Tasks | Manual repetitive work, missed updates |
| Webhook Integration | Data silos, no automation pipeline |
| Multi-format Export | Format incompatibility, manual conversion |
| MutationObserver | Virtualized lists, disappearing DOM nodes |
| Structure-Based Matching | Dynamic class names, CSS module hashes |
| Shadow DOM Handler | Encapsulated web components, inaccessible content |
| In-Memory Storage | Data loss from DOM recycling, ephemeral content |

---

## Getting Started Checklist

- [ ] Install extension (`bun run build` → load `dist/` folder)
- [ ] Configure match strategy for your target site
- [ ] Set up LLM API key (Settings → LLM Configuration)
- [ ] Create your first scheduled task
- [ ] Configure webhook for automated workflows
- [ ] Export your first tutorial or dataset
