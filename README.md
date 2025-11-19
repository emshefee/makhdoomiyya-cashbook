# Makhdoomiyya Academy Cashbook Application

A Progressive Web App (PWA) for managing financial transactions at Makhdoomiyya Academy. Works offline-first with Google Drive synchronization capabilities.

## 🌟 Features

- ✅ **Complete Offline Functionality** - Works without internet connection
- ✅ **Multi-user Support** - Admin and Viewer roles with audit trails
- ✅ **Transaction Management** - Income/expense tracking with categories
- ✅ **Financial Reports** - Monthly, quarterly, and yearly summaries
- ✅ **Google Drive Sync** - Automatic backup and multi-device sync
- ✅ **PWA Installation** - Install on Android/PC like a native app
- ✅ **Data Export** - CSV and JSON export capabilities
- ✅ **Mobile Responsive** - Optimized for all screen sizes

## 📋 Prerequisites

- A web browser (Chrome, Firefox, Edge, or Safari)
- A web server (for local testing) or web hosting service
- Google Account (for Drive sync feature)

## 🚀 Installation Instructions

### Step 1: Download the Application

1. Create a folder called `makhdoomiyya-cashbook` on your computer
2. Copy all the provided files into this folder:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `manifest.json`
   - `service-worker.js`
   - `google-drive-integration.html` (see below)
   - Icons (create simple PNG icons or use the generator below)

### Step 2: Create App Icons

Create two icon files (or use any image editor):

1. **icon-192.png** (192x192 pixels)
2. **icon-512.png** (512x512 pixels)

You can create simple icons using this online tool: https://favicon.io/

Or use this simple HTML to generate icons:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Icon Generator</title>
</head>
<body>
    <canvas id="canvas192" width="192" height="192"></canvas>
    <canvas id="canvas512" width="512" height="512"></canvas>
    
    <script>
        function createIcon(canvasId, size) {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');
            
            // Background
            ctx.fillStyle = '#059669';
            ctx.fillRect(0, 0, size, size);
            
            // Text
            ctx.fillStyle = 'white';
            ctx.font = `bold ${size/3}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('MA', size/2, size/2);
            
            // Download link
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `icon-${size}.png`;
                a.click();
            });
        }
        
        createIcon('canvas192', 192);
        createIcon('canvas512', 512);
    </script>
</body>
</html>
```

### Step 3: Set Up Local Testing

#### Option A: Using Python (Recommended)

If you have Python installed:

```bash
# Python 3
cd makhdoomiyya-cashbook
python -m http.server 8000

# Python 2
cd makhdoomiyya-cashbook
python -m SimpleHTTPServer 8000
```

Then open: http://localhost:8000

#### Option B: Using Node.js

If you have Node.js installed:

```bash
npm install -g http-server
cd makhdoomiyya-cashbook
http-server -p 8000
```

Then open: http://localhost:8000

#### Option C: Using Live Server (VS Code)

If you use VS Code:
1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Step 4: Initial Setup

1. Open the application in your browser
2. **First Login:**
   - Email: `admin@makhdoomiyya.academy`
   - Password: `admin123`
3. **Important:** Change your password immediately after first login
4. Add categories and users as needed

## 📱 Installing as a Mobile App

### On Android:

1. Open the app in Chrome browser
2. Tap the three dots menu (⋮)
3. Select "Add to Home screen"
4. Give it a name and tap "Add"
5. The app icon will appear on your home screen

### On PC (Windows/Mac):

1. Open the app in Chrome/Edge
2. Click the install icon in the address bar (⊕)
3. Click "Install"
4. The app will open in its own window

## 🔄 Google Drive Integration

To enable Google Drive sync, you need to set up Google API credentials:

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure consent screen if prompted
4. Select "Web application"
5. Add authorized JavaScript origins:
   - `http://localhost:8000` (for testing)
   - Your actual domain (for production)
6. Add authorized redirect URIs:
   - `http://localhost:8000/google-drive-integration.html`
   - `https://yourdomain.com/google-drive-integration.html`
7. Save and copy the Client ID

### Step 3: Add Google Drive Integration

Create a new file `google-drive-integration.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Google Drive Integration</title>
    <script src="https://apis.google.com/js/api.js"></script>
</head>
<body>
    <h2>Connect Google Drive</h2>
    <button id="authorizeButton">Authorize</button>
    <button id="signoutButton" style="display:none;">Sign Out</button>
    <div id="content"></div>

    <script>
        // Replace with your Client ID
        const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
        const API_KEY = 'YOUR_API_KEY';
        const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        const SCOPES = 'https://www.googleapis.com/auth/drive.file';

        let authorizeButton = document.getElementById('authorizeButton');
        let signoutButton = document.getElementById('signoutButton');

        function handleClientLoad() {
            gapi.load('client:auth2', initClient);
        }

        function initClient() {
            gapi.client.init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES
            }).then(function () {
                gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
                updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
                authorizeButton.onclick = handleAuthClick;
                signoutButton.onclick = handleSignoutClick;
            });
        }

        function updateSigninStatus(isSignedIn) {
            if (isSignedIn) {
                authorizeButton.style.display = 'none';
                signoutButton.style.display = 'block';
                saveDataToDrive();
            } else {
                authorizeButton.style.display = 'block';
                signoutButton.style.display = 'none';
            }
        }

        function handleAuthClick(event) {
            gapi.auth2.getAuthInstance().signIn();
        }

        function handleSignoutClick(event) {
            gapi.auth2.getAuthInstance().signOut();
        }

        function saveDataToDrive() {
            // Get data from IndexedDB and save to Drive
            const fileMetadata = {
                'name': 'makhdoomiyya_cashbook.json',
                'mimeType': 'application/json'
            };

            const fileContent = JSON.stringify({
                // Your app data here
                timestamp: new Date().toISOString(),
                data: 'Your cashbook data'
            });

            const file = new Blob([fileContent], {type: 'application/json'});

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
            form.append('file', file);

            fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + gapi.auth.getToken().access_token}),
                body: form
            }).then(response => response.json())
            .then(data => {
                document.getElementById('content').innerHTML = 'File saved to Google Drive!';
            });
        }
    </script>
    <script async defer src="https://apis.google.com/js/api.js" onload="handleClientLoad()"></script>
</body>
</html>
```

## 🗂️ Folder Structure

```
makhdoomiyya-cashbook/
├── index.html              # Main application file
├── app.js                  # Application logic
├── styles.css              # Styling
├── manifest.json           # PWA configuration
├── service-worker.js       # Offline functionality
├── google-drive-integration.html  # Google Drive setup
├── icon-192.png           # App icon (192x192)
├── icon-512.png           # App icon (512x512)
└── README.md              # Documentation
```

## 💼 Usage Guide

### Daily Operations

1. **Adding Transactions:**
   - Click "Add Transaction" button
   - Fill in required fields (Date, Type, Amount, Category, Description)
   - Optional: Add payment method, reference number, and tags
   - Click "Save Transaction"

2. **Viewing Reports:**
   - Navigate to Reports section
   - Select period (Month/Quarter/Year)
   - Click "Generate Report"
   - Export as CSV or print

3. **Managing Categories:**
   - Go to Categories section
   - Add custom categories for income/expenses
   - Assign colors for visual identification

### Data Backup

1. **Manual Backup:**
   - Go to Settings → Data Management
   - Click "Backup Data"
   - Save the JSON file to a safe location

2. **Restore from Backup:**
   - Go to Settings → Data Management
   - Click "Restore Data"
   - Select your backup JSON file

### Multi-Device Setup

1. Install the app on all devices
2. Use the same Google account for Drive sync
3. Data will automatically sync between devices

## 🔒 Security Notes

- Change the default admin password immediately
- Use strong passwords for all user accounts
- Regular backups are recommended
- Keep your Google Drive secure
- The app uses browser's local storage - clear with caution

## 🆘 Troubleshooting

### App not loading?
- Check if all files are in the same folder
- Ensure you're using a modern browser
- Clear browser cache and reload

### Can't install as PWA?
- Must be served over HTTPS (or localhost for testing)
- Check if service worker is registered
- Try in Chrome/Edge browsers

### Google Drive sync not working?
- Verify API credentials are correct
- Check if Drive API is enabled
- Ensure proper redirect URIs are configured

## 📝 Default Credentials

**First-time login:**
- Email: `admin@makhdoomiyya.academy`
- Password: `admin123`

⚠️ **Important:** Change these credentials immediately after first login!

## 🚀 Deployment Options

### Option 1: GitHub Pages (Free)

1. Create a GitHub repository
2. Upload all files
3. Enable GitHub Pages in repository settings
4. Access via: `https://yourusername.github.io/repository-name`

### Option 2: Netlify (Free)

1. Create account at netlify.com
2. Drag and drop your folder
3. Get instant URL
4. Custom domain available

### Option 3: Shared Hosting

1. Upload files via FTP/cPanel
2. Ensure HTTPS is enabled
3. Update Google API redirect URIs

## 📞 Support

For issues or questions about this cashbook application:
1. Check the troubleshooting section
2. Review the usage guide
3. Ensure all files are properly configured

## 📄 License

This application is created specifically for Makhdoomiyya Academy's internal use.

## 🎯 Future Enhancements

Planned features for future versions:
- Email notifications for transactions
- Advanced budgeting module
- Multi-currency support
- Receipt scanning with OCR
- Automated report generation
- Integration with accounting software

---

**Version:** 1.0.0  
**Last Updated:** November 2024  
**Developed for:** Makhdoomiyya Academy
