# Quick Start Guide

## Installation (5 minutes)

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Version 16 or higher required

2. **Install Dependencies**
   ```bash
   cd timetracker
   npm install
   ```

3. **Run the App**
   ```bash
   npm start
   ```

## First Time Setup (2 minutes)

### Create Your First Task
1. Click **"+ New Task"**
2. Enter title: "My First Task"
3. Click **"Save Task"**

### Start Tracking
1. Click on the task in the sidebar
2. Click **"▶️ Start"** button
3. Watch the timer count up!

### Test the Hotkey
1. Press **Ctrl+Shift+T** (or **Cmd+Shift+T** on Mac)
2. The app will hide
3. Press again to show it

## Optional: Setup Jira (5 minutes)

### Get Your Jira API Token
1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name: "TimeTracker"
4. Copy the token

### Configure in TimeTracker
1. Click **⚙️** (settings icon)
2. Enter:
   - **Jira URL**: `https://yourcompany.atlassian.net`
   - **Email**: Your Atlassian email
   - **API Token**: Paste the token
3. Click **"Test Connection"**
4. Click **"Save Settings"**

### Use Jira Integration
1. Create a new task
2. Enter Jira ticket: `PROJ-123`
3. Save the task
4. Click **"Sync Jira"** to pull ticket details

## Daily Workflow

### Morning
1. Open app with **Ctrl/Cmd+Shift+T**
2. Review tasks in sidebar
3. Start your first task

### During the Day
- Switch tasks as needed (previous task auto-pauses)
- Add comments with notes
- Pause when taking breaks

### End of Day
- Mark completed tasks as **Done**
- Review total time in task details
- Plan tomorrow's tasks

## Tips

- **Recurring Tasks**: Check "Recurring Task" for daily standup, meetings, etc.
- **Tags**: Use tags like "urgent", "backend", "frontend" to organize
- **Comments**: Document important decisions and blockers
- **Time Sessions**: Review the detailed session history in task details

## Keyboard Shortcuts

- **Ctrl/Cmd+Shift+T**: Show/hide app (works anywhere!)

## Troubleshooting

**App won't start?**
```bash
rm -rf node_modules
npm install
npm start
```

**Hotkey not working?**
- Another app might be using it
- Check if it works after restarting TimeTracker

**Jira connection fails?**
- Verify the URL has `https://`
- Check your API token isn't expired
- Ensure you have internet connection

## Next Steps

- Read the full **README.md** for detailed features
- Customize colors in **styles.css**
- Change hotkey in **main.js**
- Build distributable: `npm run build`

---

That's it! You're ready to track your time efficiently! 🎉