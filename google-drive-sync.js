// Google Drive Integration Module for Makhdoomiyya Academy Cashbook
// This file handles all Google Drive synchronization

const GoogleDriveSync = {
    // Configuration
    CLIENT_ID: 408203003534-6le0drk511u41rho0ehsmne9scvtvqbt.apps.googleusercontent.com // Replace with your Client ID
    API_KEY: AIzaSyCJsCxpyCtrT8KjVAkAaD66QS2-tk4SJRg // Replace with your API Key
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    
    // State
    isAuthorized: false,
    syncInterval: null,
    lastSyncTime: null,
    
    // Initialize Google API
    async initialize() {
        return new Promise((resolve, reject) => {
            gapi.load('client:auth2', async () => {
                try {
                    await gapi.client.init({
                        apiKey: this.API_KEY,
                        clientId: this.CLIENT_ID,
                        discoveryDocs: this.DISCOVERY_DOCS,
                        scope: this.SCOPES
                    });
                    
                    // Listen for sign-in state changes
                    gapi.auth2.getAuthInstance().isSignedIn.listen(isSignedIn => {
                        this.handleAuthChange(isSignedIn);
                    });
                    
                    // Handle initial sign-in state
                    this.handleAuthChange(gapi.auth2.getAuthInstance().isSignedIn.get());
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    },
    
    // Handle authentication state changes
    handleAuthChange(isSignedIn) {
        this.isAuthorized = isSignedIn;
        
        if (isSignedIn) {
            this.startAutoSync();
            this.updateSyncStatus('connected');
        } else {
            this.stopAutoSync();
            this.updateSyncStatus('disconnected');
        }
    },
    
    // Sign in to Google
    async signIn() {
        try {
            await gapi.auth2.getAuthInstance().signIn();
            showToast('Connected to Google Drive', 'success');
        } catch (error) {
            console.error('Sign in error:', error);
            showToast('Failed to connect to Google Drive', 'error');
        }
    },
    
    // Sign out from Google
    async signOut() {
        try {
            await gapi.auth2.getAuthInstance().signOut();
            showToast('Disconnected from Google Drive', 'info');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    },
    
    // Find or create the app folder
    async getAppFolder() {
        try {
            // Search for existing folder
            const response = await gapi.client.drive.files.list({
                q: "name='MakhdoomiyyaCashbook' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            
            if (response.result.files.length > 0) {
                return response.result.files[0].id;
            }
            
            // Create new folder if not found
            const folderMetadata = {
                name: 'MakhdoomiyyaCashbook',
                mimeType: 'application/vnd.google-apps.folder'
            };
            
            const folder = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            
            return folder.result.id;
        } catch (error) {
            console.error('Error accessing folder:', error);
            throw error;
        }
    },
    
    // Save data to Google Drive
    async saveToGoogleDrive() {
        if (!this.isAuthorized) {
            console.log('Not authorized to save to Google Drive');
            return;
        }
        
        try {
            this.updateSyncStatus('syncing');
            
            const folderId = await this.getAppFolder();
            const fileName = 'cashbook_data.json';
            
            // Prepare data
            const dataToSave = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                deviceId: this.getDeviceId(),
                data: AppState.data
            };
            
            const fileContent = JSON.stringify(dataToSave, null, 2);
            
            // Check if file exists
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive'
            });
            
            let fileId = null;
            
            if (searchResponse.result.files.length > 0) {
                // Update existing file
                fileId = searchResponse.result.files[0].id;
                
                // Get existing file content to check for conflicts
                const existingFile = await gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                
                const existingData = JSON.parse(existingFile.body);
                
                // Simple conflict resolution - latest timestamp wins
                if (existingData.timestamp > dataToSave.timestamp) {
                    console.log('Remote data is newer, skipping upload');
                    await this.loadFromGoogleDrive();
                    return;
                }
                
                // Update file
                await gapi.client.request({
                    path: `/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH',
                    params: {
                        uploadType: 'media'
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: fileContent
                });
            } else {
                // Create new file
                const fileMetadata = {
                    name: fileName,
                    parents: [folderId],
                    mimeType: 'application/json'
                };
                
                await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: {
                        uploadType: 'multipart'
                    },
                    headers: {
                        'Content-Type': 'multipart/related'
                    },
                    body: this.createMultipartBody(fileMetadata, fileContent, 'application/json')
                });
            }
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus('synced');
            AppState.data.lastSynced = this.lastSyncTime.toISOString();
            
            console.log('Data saved to Google Drive successfully');
            
        } catch (error) {
            console.error('Error saving to Google Drive:', error);
            this.updateSyncStatus('error');
            showToast('Failed to sync with Google Drive', 'error');
        }
    },
    
    // Load data from Google Drive
    async loadFromGoogleDrive() {
        if (!this.isAuthorized) {
            console.log('Not authorized to load from Google Drive');
            return;
        }
        
        try {
            this.updateSyncStatus('syncing');
            
            const folderId = await this.getAppFolder();
            const fileName = 'cashbook_data.json';
            
            // Search for the data file
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive',
                orderBy: 'modifiedTime desc'
            });
            
            if (searchResponse.result.files.length === 0) {
                console.log('No data file found in Google Drive');
                this.updateSyncStatus('synced');
                return;
            }
            
            // Get file content
            const fileId = searchResponse.result.files[0].id;
            const file = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            const driveData = JSON.parse(file.body);
            
            // Merge data (simple strategy - take newer data)
            if (driveData.timestamp > (AppState.data.lastSynced || '')) {
                AppState.data = driveData.data;
                AppState.data.lastSynced = driveData.timestamp;
                saveDataToLocal();
                
                showToast('Data loaded from Google Drive', 'success');
                
                // Refresh current view
                if (AppState.currentPage === 'dashboard') {
                    loadDashboard();
                } else if (AppState.currentPage === 'transactions') {
                    loadTransactions();
                }
            }
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus('synced');
            
        } catch (error) {
            console.error('Error loading from Google Drive:', error);
            this.updateSyncStatus('error');
            showToast('Failed to load from Google Drive', 'error');
        }
    },
    
    // Create multipart body for file upload
    createMultipartBody(metadata, content, contentType) {
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const closeDelimiter = "\r\n--" + boundary + "--";
        
        const body = 
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n\r\n' +
            content +
            closeDelimiter;
        
        return body;
    },
    
    // Start automatic synchronization
    startAutoSync() {
        // Sync every 5 minutes
        this.syncInterval = setInterval(() => {
            this.syncData();
        }, 5 * 60 * 1000);
        
        // Initial sync
        this.syncData();
    },
    
    // Stop automatic synchronization
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    },
    
    // Perform two-way sync
    async syncData() {
        if (!this.isAuthorized) {
            return;
        }
        
        try {
            // First load from Drive to check for updates
            await this.loadFromGoogleDrive();
            
            // Then save our current data
            await this.saveToGoogleDrive();
            
        } catch (error) {
            console.error('Sync error:', error);
        }
    },
    
    // Update sync status in UI
    updateSyncStatus(status) {
        const syncStatus = document.getElementById('syncStatus');
        if (!syncStatus) return;
        
        switch(status) {
            case 'syncing':
                syncStatus.className = 'sync-status syncing';
                syncStatus.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.418A6 6 0 1 1 8 2v1z"/>
                        <path d="M8 1a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H7.5V1.5A.5.5 0 0 1 8 1z"/>
                    </svg>
                    <span class="sync-text">Syncing...</span>
                `;
                break;
                
            case 'synced':
                syncStatus.className = 'sync-status';
                syncStatus.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                    </svg>
                    <span class="sync-text">Synced</span>
                `;
                break;
                
            case 'error':
                syncStatus.className = 'sync-status error';
                syncStatus.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                    </svg>
                    <span class="sync-text">Sync Error</span>
                `;
                break;
                
            case 'disconnected':
                syncStatus.className = 'sync-status';
                syncStatus.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/>
                        <path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/>
                    </svg>
                    <span class="sync-text">Offline</span>
                `;
                break;
        }
        
        AppState.driveConnected = (status === 'synced' || status === 'syncing');
    },
    
    // Get or create device ID
    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    },
    
    // Export data as backup
    async createBackup() {
        try {
            if (!this.isAuthorized) {
                await this.signIn();
            }
            
            const folderId = await this.getAppFolder();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `backup_${timestamp}.json`;
            
            const backupData = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                type: 'backup',
                data: AppState.data
            };
            
            const fileMetadata = {
                name: fileName,
                parents: [folderId],
                mimeType: 'application/json'
            };
            
            const fileContent = JSON.stringify(backupData, null, 2);
            
            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: {
                    uploadType: 'multipart'
                },
                headers: {
                    'Content-Type': 'multipart/related'
                },
                body: this.createMultipartBody(fileMetadata, fileContent, 'application/json')
            });
            
            showToast('Backup created in Google Drive', 'success');
            
        } catch (error) {
            console.error('Backup error:', error);
            showToast('Failed to create backup', 'error');
        }
    },
    
    // List available backups
    async listBackups() {
        if (!this.isAuthorized) {
            await this.signIn();
        }
        
        try {
            const folderId = await this.getAppFolder();
            
            const response = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and name contains 'backup_' and trashed=false`,
                fields: 'files(id, name, createdTime, size)',
                orderBy: 'createdTime desc',
                pageSize: 20
            });
            
            return response.result.files;
            
        } catch (error) {
            console.error('Error listing backups:', error);
            return [];
        }
    },
    
    // Restore from backup
    async restoreFromBackup(fileId) {
        try {
            const file = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            const backupData = JSON.parse(file.body);
            
            if (backupData.type !== 'backup') {
                throw new Error('Invalid backup file');
            }
            
            AppState.data = backupData.data;
            saveDataToLocal();
            
            showToast('Data restored from backup', 'success');
            
            // Reload current page
            navigateToPage(AppState.currentPage);
            
        } catch (error) {
            console.error('Restore error:', error);
            showToast('Failed to restore from backup', 'error');
        }
    }
};

// Add Google Drive integration to existing sync button
document.addEventListener('DOMContentLoaded', function() {
    // Override existing sync button handler
    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
        syncButton.addEventListener('click', async function() {
            if (!GoogleDriveSync.isAuthorized) {
                await GoogleDriveSync.signIn();
            } else {
                await GoogleDriveSync.syncData();
            }
        });
    }
    
    // Override connect drive button
    const connectDriveButton = document.getElementById('connectDrive');
    if (connectDriveButton) {
        connectDriveButton.addEventListener('click', async function() {
            if (!GoogleDriveSync.isAuthorized) {
                await GoogleDriveSync.signIn();
                this.textContent = 'Disconnect Google Drive';
            } else {
                await GoogleDriveSync.signOut();
                this.textContent = 'Connect Google Drive';
            }
        });
    }
});

// Load Google API script
(function() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = function() {
        // Initialize Google Drive sync when API is loaded
        GoogleDriveSync.initialize().then(() => {
            console.log('Google Drive integration initialized');
        }).catch(error => {
            console.error('Failed to initialize Google Drive:', error);
        });
    };
    document.head.appendChild(script);
})();
