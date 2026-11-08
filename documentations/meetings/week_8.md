# Minutes of the Meeting - Week 8

**Project Title:** ClearCare

**Group Members:** Likun (Jake) Fang, Twila Habab, Aswin Remesh, Niwash Acharya, Waseel Chopra

---

## Meeting
**Meeting type:** Retrospective and Sprint Planning

**Date:** 6 November 2026

**Time:** 15:00 to 17:00

**Location:** In person TUD Grangegorman

### **1. Attendance**

- **Present:**
  - Jake
  - Twila
  - Aswin
  - Niwash
- **Absent:**
  - Waseel

### **2. Agenda of the Meeting**

- Discussing retrospective points from the previous sprint
- Mentor feedback
- Data quality and data cleaning
- Next Sprint tasks

### **3. Discussion and Key Points**

1. **Sprint Retrospective**
   - Discussed what went well
     - One of the most collaborative weeks for the team, with many features added to the site
     - Amenities can now be displayed on the website
     - The migration finished, removing the main blocker for other work
     - User accounts and preferences completed
   - Discussed what didn't go well
     - Amenities scheduling was not completed
     - The design of the new features was only looked over at the last minute
     - Last-minute changes were needed
     - The site is being developed from a developer's perspective rather than the target audience's
   - Discussed planned improvements
     - Focus on the user's perspective when designing the site
     - Reach out to relevant external groups and users for their opinions
     - Accelerate the research progress
     - Handle edge cases in our data

2. **Mentor Feedback**
   - The team discussed the feedback given by mentors. In particular, with the additions made to the centres' details page, there needs to be a lot of UX/UI changes. The team needs to see the site more on a target audience's perspective rather than a developers perspective: Focusing more on the *how* rather than the *what* should be displayed. 
     - Furthermore, there is no clarity on the regulations shown if they came from the same report or from different ones. It's not easily seen. 
    - Additional possible tickets noted for the centre details page:
      - Filter by dates and/ore group reports?
      - Accordion style drop-down for list of regulation breaches.
      - "What happened next" section needs to be overhauled in design.
   - The current search function of the site doesn't take in realistic parameters. A family may not search by county, and there might be a nearer home in a different county.
   - Searching by geographic location will be considered in the development using Eircodes.
   - The team recognizes the need of performing Data Cleaning, as issues are discovered in the repository (see issue [#160](https://github.com/niwash/ClearCare/issues/160)).


3. **Tasks for next Sprint**
   - Research
     - Read through all of HIQA's regulations
     - Find news sources stating which regulations are commonly mentioned
   - Centre details page UX/UI
     - Make sub pages for each care centre instead of one long page
     - Accordions
     - Traffic light
     - Create possible design for each page
   - Search
     - Geocoding
     - Radius slider
     - Remove "area" from the search filter
     - Optional preferences field
   - User Accounts
     - Favourite list of nursing homes
     - Proper deletion of accounts
     - Update/Add new ADRs
   - Data
     - Data cleaning
     - Complete amenities scheduling and data evaluation
   - Other features
     - AI chatbot
     - Pictures and alerts
   - Phase 2 User Evaluation
     - Investigate UX/UI design in preparation for phase 2

### **4. Next Steps**

- Tickets, tickets and tickets
- Redesign the centre details page from the audience's perspective
- Start data cleaning
- Complete the tasks allocated for next sprint
