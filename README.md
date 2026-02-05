# TimeTracker - Cross-Platform Time Tracking Application

A feature-rich time tracking application built with Electron that runs on macOS, Windows, and Linux. Track your time across multiple tasks with Jira Cloud integration, recurring tasks support, and comprehensive task management.

## Features

### Core Features
- ⏱️ **Real-time Time Tracking**: Track time on multiple tasks with start/pause/resume functionality
- 🔄 **Context Switching**: Easily switch between tasks - starting a new task automatically pauses the current one
- 📊 **Task States**: Manage tasks through their lifecycle (TODO → IN_PROGRESS → PAUSED → DONE)
- 💬 **Comments**: Add unlimited comments to any task for notes and updates
- 🏷️ **Tags**: Organize tasks with custom tags
- 🔁 **Recurring Tasks**: Mark tasks as recurring for easy re-selection

### Jira Integration
- 🎫 **Jira Cloud Support**: Link tasks to Jira tickets
- 🔄 **Sync with Jira**: Pull ticket details (title, description) from Jira
- 🔐 **Secure Authentication**: Uses Jira API tokens for secure access

### User Experience
- ⌨️ **Global Hotkey**: Access the app instantly with Ctrl/Cmd+Shift+T
- 🖥️ **System Tray**: Minimize to tray, app stays readily available
- 💾 **Persistent Storage**: All data saved locally using electron-store
- 🎨 **Modern UI**: Clean, intuitive interface with real-time updates
- 📱 **Responsive Design**: Works well at different window sizes

## Screenshots

The application features:
- **Sidebar**: Quick access to active and recent tasks
- **Task Detail Panel**: Comprehensive view of task information, timer, and actions
- **Time Sessions**: Historical view of all time tracking sessions
- **Comments Section**: Add and manage task comments

## Installation

### Prerequisites
- Node.js 16.x or higher
- npm or yarn

### Setup Instructions

1. **Clone or extract the application**
   ```bash
   cd timetracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

### Building for Distribution

Build for your current platform:
```bash
npm run build
```

Build for specific platforms:
```bash
npm run build:mac    # macOS (DMG and ZIP)
npm run build:win    # Windows (NSIS installer and portable)
npm run build:linux  # Linux (AppImage and DEB)
```

Built applications will be in the `dist` folder.

## Usage Guide

### Getting Started

1. **Create Your First Task**
   - Click the "+ New Task" button
   - Enter a title (required)
   - Optionally add description, Jira ticket, tags
   - Mark as recurring if needed
   - Click "Save Task"

2. **Start Tracking Time**
   - Click on a task in the sidebar to select it
   - Click the "▶️ Start" button to begin tracking
   - The timer will display elapsed time in real-time
   - Click "⏸️ Pause" to pause tracking
   - Click "✓ Complete" when done

3. **Context Switching**
   - Simply start a different task
   - The current task will automatically pause
   - Time is tracked separately for each session

### Task Management

#### Task States
- **TODO**: Task is planned but not started
- **IN_PROGRESS**: Currently tracking time on this task
- **PAUSED**: Task was active but is now paused
- **DONE**: Task is completed

#### Adding Comments
1. Select a task
2. Scroll to the Comments section
3. Type your comment in the textarea
4. Click "Add Comment"

#### Using Tags
- Add comma-separated tags when creating/editing tasks
- Examples: "development, frontend, urgent"
- Tags help organize and filter tasks

### Jira Integration Setup

1. **Open Settings**
   - Click the ⚙️ settings icon in the top-right

2. **Configure Jira Credentials**
   - **Jira URL**: Your Jira Cloud URL (e.g., https://yourcompany.atlassian.net)
   - **Email**: Your Atlassian account email
   - **API Token**: Generate at https://id.atlassian.com/manage-profile/security/api-tokens

3. **Test Connection**
   - Click "Test Connection" to verify credentials
   - Save settings when connection is successful

4. **Using Jira Integration**
   - When creating/editing a task, enter the Jira ticket ID (e.g., PROJ-123)
   - Click "Sync Jira" button to pull latest ticket details
   - Title and description will update from Jira

### Keyboard Shortcuts

- **Ctrl/Cmd + Shift + T**: Toggle application visibility (works globally)
- Works even when app is minimized to tray

### Data Storage

All data is stored locally in:
- **macOS**: `~/Library/Application Support/timetracker/`
- **Windows**: `%APPDATA%/timetracker/`
- **Linux**: `~/.config/timetracker/`

Data includes:
- All tasks and their time sessions
- Comments
- Jira settings (API token is stored securely)

## Architecture

### Technology Stack
- **Electron**: Cross-platform desktop framework
- **electron-store**: Persistent data storage
- **Native JavaScript**: No heavy frameworks for fast performance

### File Structure
```
timetracker/
├── main.js              # Electron main process
├── renderer.js          # Application logic
├── index.html           # UI structure
├── styles.css           # Styling
├── package.json         # Dependencies and build config
└── assets/              # Icons and images
    ├── icon.png         # Application icon
    └── tray-icon.png    # System tray icon
```

### Key Features Implementation

#### Time Tracking
- Tracks seconds-level precision
- Stores individual time sessions with start/end timestamps
- Calculates total time across all sessions
- Persists timer state across app restarts

#### Context Switching
- Automatically pauses current task when starting another
- Saves session data before switching
- Supports running only one task at a time

#### Data Model
Each task contains:
```javascript
{
  id: string,
  title: string,
  description: string,
  jiraTicket: string,
  isRecurring: boolean,
  tags: string[],
  status: 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE',
  createdAt: ISO8601,
  updatedAt: ISO8601,
  currentSessionStart: ISO8601 | null,
  timeSessions: [{
    start: ISO8601,
    end: ISO8601,
    duration: number (seconds)
  }],
  comments: [{
    id: string,
    text: string,
    createdAt: ISO8601
  }],
  totalTime: number (seconds)
}
```

## Customization

### Changing the Global Hotkey
Edit `main.js`, line with `globalShortcut.register`:
```javascript
globalShortcut.register('CommandOrControl+Shift+T', () => {
  // Change 'CommandOrControl+Shift+T' to your preferred combination
});
```

### Customizing Colors
Edit `styles.css` CSS variables at the top:
```css
:root {
  --primary-color: #4f46e5;  /* Change to your brand color */
  --success-color: #10b981;
  /* ... other colors */
}
```

### Adding Custom Icons
Replace files in `assets/` folder:
- `icon.png` - 256x256 or larger
- `tray-icon.png` - 32x32 for system tray

## Troubleshooting

### App Won't Start
- Ensure Node.js 16+ is installed: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check console for errors: The app logs to both terminal and DevTools

### Hotkey Not Working
- Check if another app is using Ctrl/Cmd+Shift+T
- Try changing the hotkey in `main.js`
- Restart the application after changes

### Jira Connection Fails
- Verify your Jira URL (must include https://)
- Regenerate your API token if expired
- Ensure your Jira account has API access
- Check network/firewall settings

### Data Not Persisting
- Check file permissions in config directory
- Verify disk space is available
- Check console for electron-store errors

### Timer Not Accurate
- Timer may pause when system sleeps
- This is expected behavior to prevent inflated times
- Consider adding notes about breaks in comments

## Development

### Running in Development Mode
```bash
npm start
```

### Debugging
- Open DevTools: Add to `main.js` after `mainWindow.loadFile('index.html')`:
  ```javascript
  mainWindow.webContents.openDevTools();
  ```

### Adding Features
The codebase is well-structured:
- UI changes: Edit `index.html` and `styles.css`
- Application logic: Edit `renderer.js`
- System integration: Edit `main.js`

## Future Enhancements

Potential features to add:
- [ ] Export time logs to CSV/Excel
- [ ] Generate time reports with charts
- [ ] Multiple timer support (parallel tasks)
- [ ] Pomodoro timer integration
- [ ] Team collaboration features
- [ ] Calendar integration
- [ ] Custom task fields
- [ ] Dark/light theme toggle
- [ ] Backup/restore functionality
- [ ] Automatic Jira time logging

## License

MIT License - Feel free to modify and distribute

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the console logs for errors
3. Ensure you're using the latest version
4. Check that all dependencies are properly installed

## Contributing

Contributions are welcome! The codebase is designed to be:
- Easy to understand and modify
- Well-commented where needed
- Modular and extensible

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on your platform
5. Submit a pull request

---

Built with ❤️ using Electron