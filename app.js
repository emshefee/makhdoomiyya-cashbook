// Makhdoomiyya Academy Cashbook Application
// Main Application JavaScript

// Application State
const AppState = {
    currentUser: null,
    currentPage: 'dashboard',
    database: null,
    driveConnected: false,
    syncInProgress: false,
    offlineQueue: [],
    data: {
        institution: "Makhdoomiyya Academy",
        lastSynced: null,
        settings: {
            openingBalance: 0,
            baseCurrency: "INR",
            fiscalYearStart: "April",
            currencySymbol: "₹"
        },
        categories: [],
        users: [],
        transactions: [],
        auditLog: []
    }
};

// Database Configuration
const DB_NAME = 'MakhdoomiyyaCashbook';
const DB_VERSION = 1;

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeDatabase();
    setupEventListeners();
    checkAuthentication();
    setupDefaultCategories();
});

// IndexedDB Setup
function initializeDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = function() {
        console.error("Database failed to open");
        showToast("Failed to open local database", "error");
    };
    
    request.onsuccess = function() {
        AppState.database = request.result;
        loadDataFromLocal();
    };
    
    request.onupgradeneeded = function(e) {
        const db = e.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('data')) {
            db.createObjectStore('data', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
            userStore.createIndex('email', 'email', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('syncQueue')) {
            db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
    };
}

// Load data from IndexedDB
function loadDataFromLocal() {
    const transaction = AppState.database.transaction(['data'], 'readonly');
    const objectStore = transaction.objectStore('data');
    const request = objectStore.get('appData');
    
    request.onsuccess = function() {
        if (request.result) {
            AppState.data = request.result.data;
        } else {
            saveDataToLocal();
        }
    };
}

// Save data to IndexedDB
function saveDataToLocal() {
    const transaction = AppState.database.transaction(['data'], 'readwrite');
    const objectStore = transaction.objectStore('data');
    
    const request = objectStore.put({
        id: 'appData',
        data: AppState.data,
        timestamp: new Date().toISOString()
    });
    
    request.onsuccess = function() {
        console.log("Data saved locally");
        markSyncNeeded();
    };
    
    request.onerror = function() {
        console.error("Failed to save data locally");
        showToast("Failed to save data", "error");
    };
}

// Authentication Functions
function checkAuthentication() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        AppState.currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('mainApp').classList.remove('active');
}

function showMainApp() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    updateUserInterface();
    loadDashboard();
}

// Setup Event Listeners
function setupEventListeners() {
    // Login Form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            navigateToPage(page);
        });
    });
    
    // Menu Toggle (Mobile)
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    
    // User Menu Toggle
    document.getElementById('userMenuToggle').addEventListener('click', toggleUserMenu);
    
    // Quick Add Transaction
    document.getElementById('quickAddBtn').addEventListener('click', () => openTransactionModal());
    document.getElementById('addTransactionBtn').addEventListener('click', () => openTransactionModal());
    
    // Transaction Form
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    
    // Category Management
    document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
    
    // User Management
    document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());
    document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
    
    // Filter Controls
    document.getElementById('filterBtn').addEventListener('click', toggleFilterPanel);
    document.getElementById('applyFilter').addEventListener('click', applyTransactionFilter);
    document.getElementById('clearFilter').addEventListener('click', clearTransactionFilter);
    
    // Export
    document.getElementById('exportBtn').addEventListener('click', exportTransactions);
    
    // Google Drive Sync
    document.getElementById('syncButton').addEventListener('click', syncWithGoogleDrive);
    document.getElementById('connectDrive').addEventListener('click', connectGoogleDrive);
    
    // Settings
    document.getElementById('fiscalYear').addEventListener('change', updateSettings);
    document.getElementById('currency').addEventListener('change', updateSettings);
    
    // Data Management
    document.getElementById('backupData').addEventListener('click', backupData);
    document.getElementById('restoreData').addEventListener('click', restoreData);
    document.getElementById('clearData').addEventListener('click', clearAllData);
    
    // Reports
    document.getElementById('generateReport').addEventListener('click', generateReport);
    
    // Radio buttons for transaction type
    document.querySelectorAll('input[name="transactionType"]').forEach(radio => {
        radio.addEventListener('change', updateCategoryOptions);
    });
    
    // Close modals on click outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
}

// Login Handler
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    showLoading(true);
    
    // Check for default admin account (for initial setup)
    if (email === 'admin@makhdoomiyya.academy' && password === 'admin123') {
        // First time login - create admin account
        if (AppState.data.users.length === 0) {
            const adminUser = {
                id: generateId(),
                email: email,
                name: 'Administrator',
                password: hashPassword(password),
                role: 'admin',
                createdAt: new Date().toISOString()
            };
            
            AppState.data.users.push(adminUser);
            saveDataToLocal();
            
            AppState.currentUser = adminUser;
            localStorage.setItem('currentUser', JSON.stringify(adminUser));
            
            showToast('Welcome! Please change your password in settings.', 'warning');
            showMainApp();
        } else {
            showLoginError('Please use your updated credentials');
        }
    } else {
        // Check user credentials
        const user = AppState.data.users.find(u => u.email === email);
        
        if (user && verifyPassword(password, user.password)) {
            AppState.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            // Log the login
            addAuditLog('user_login', `User ${user.name} logged in`);
            
            showMainApp();
        } else {
            showLoginError('Invalid email or password');
        }
    }
    
    showLoading(false);
}

// Logout Handler
function handleLogout() {
    AppState.currentUser = null;
    localStorage.removeItem('currentUser');
    showLoginScreen();
    showToast('Logged out successfully');
}

// Navigation
function navigateToPage(pageName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Update pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageName}Page`).classList.add('active');
    
    AppState.currentPage = pageName;
    
    // Load page content
    switch(pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'reports':
            loadReports();
            break;
        case 'categories':
            loadCategories();
            break;
        case 'settings':
            loadSettings();
            break;
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

// Dashboard Functions
function loadDashboard() {
    updateSummaryCards();
    loadRecentTransactions();
    updateCharts();
}

function updateSummaryCards() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyTransactions = AppState.data.transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    const totalIncome = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = AppState.data.settings.openingBalance + 
        AppState.data.transactions.reduce((sum, t) => {
            return sum + (t.type === 'income' ? t.amount : -t.amount);
        }, 0);
    
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('currentBalance').textContent = formatCurrency(balance);
}

function loadRecentTransactions() {
    const recent = AppState.data.transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    const container = document.getElementById('recentTransactions');
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">No transactions yet</p>';
        return;
    }
    
    container.innerHTML = recent.map(transaction => {
        const category = AppState.data.categories.find(c => c.id === transaction.categoryId);
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <h5>${transaction.description}</h5>
                    <div class="transaction-meta">
                        <span>${formatDate(transaction.date)}</span>
                        <span>${category ? category.name : 'Uncategorized'}</span>
                    </div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
                </div>
            </div>
        `;
    }).join('');
}

// Transactions Page
function loadTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    const transactions = AppState.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const category = AppState.data.categories.find(c => c.id === transaction.categoryId);
        return `
            <tr>
                <td>${formatDate(transaction.date)}</td>
                <td>${transaction.description}</td>
                <td>${category ? category.name : 'Uncategorized'}</td>
                <td><span class="badge ${transaction.type}">${transaction.type}</span></td>
                <td class="transaction-amount ${transaction.type}">
                    ${formatCurrency(transaction.amount)}
                </td>
                <td>
                    <button onclick="editTransaction('${transaction.id}')" class="btn btn-sm">Edit</button>
                    <button onclick="deleteTransaction('${transaction.id}')" class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Transaction Modal
function openTransactionModal(transactionId = null) {
    const modal = document.getElementById('transactionModal');
    const form = document.getElementById('transactionForm');
    const title = document.getElementById('modalTitle');
    
    // Reset form
    form.reset();
    
    // Set today's date as default
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
    
    if (transactionId) {
        const transaction = AppState.data.transactions.find(t => t.id === transactionId);
        if (transaction) {
            title.textContent = 'Edit Transaction';
            document.getElementById('transactionId').value = transaction.id;
            document.getElementById('transactionDate').value = transaction.date;
            document.querySelector(`input[name="transactionType"][value="${transaction.type}"]`).checked = true;
            document.getElementById('transactionAmount').value = transaction.amount;
            document.getElementById('transactionCategory').value = transaction.categoryId;
            document.getElementById('transactionDescription').value = transaction.description;
            document.getElementById('paymentMethod').value = transaction.paymentMethod || 'cash';
            document.getElementById('referenceNumber').value = transaction.reference || '';
            document.getElementById('transactionTags').value = transaction.tags ? transaction.tags.join(', ') : '';
        }
    } else {
        title.textContent = 'Add Transaction';
    }
    
    updateCategoryOptions();
    modal.classList.add('active');
}

function updateCategoryOptions() {
    const type = document.querySelector('input[name="transactionType"]:checked')?.value;
    const select = document.getElementById('transactionCategory');
    
    if (!type) return;
    
    const categories = AppState.data.categories.filter(c => c.type === type);
    
    select.innerHTML = '<option value="">Select Category</option>' +
        categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const transactionId = document.getElementById('transactionId').value;
    const transactionData = {
        id: transactionId || generateId(),
        date: document.getElementById('transactionDate').value,
        type: document.querySelector('input[name="transactionType"]:checked').value,
        amount: parseFloat(document.getElementById('transactionAmount').value),
        categoryId: document.getElementById('transactionCategory').value,
        description: document.getElementById('transactionDescription').value,
        paymentMethod: document.getElementById('paymentMethod').value,
        reference: document.getElementById('referenceNumber').value,
        tags: document.getElementById('transactionTags').value.split(',').map(t => t.trim()).filter(t => t),
        createdBy: AppState.currentUser.id,
        createdAt: transactionId ? undefined : new Date().toISOString(),
        lastModifiedBy: AppState.currentUser.id,
        lastModifiedAt: new Date().toISOString()
    };
    
    if (transactionId) {
        // Update existing transaction
        const index = AppState.data.transactions.findIndex(t => t.id === transactionId);
        if (index !== -1) {
            AppState.data.transactions[index] = { ...AppState.data.transactions[index], ...transactionData };
            addAuditLog('update_transaction', `Updated transaction ${transactionData.description}`);
        }
    } else {
        // Add new transaction
        AppState.data.transactions.push(transactionData);
        addAuditLog('create_transaction', `Created transaction ${transactionData.description}`);
    }
    
    saveDataToLocal();
    closeModal('transactionModal');
    showToast('Transaction saved successfully', 'success');
    
    // Refresh current page
    if (AppState.currentPage === 'dashboard') {
        loadDashboard();
    } else if (AppState.currentPage === 'transactions') {
        loadTransactions();
    }
}

// Categories Management
function loadCategories() {
    const incomeList = document.getElementById('incomeCategories');
    const expenseList = document.getElementById('expenseCategories');
    
    const incomeCategories = AppState.data.categories.filter(c => c.type === 'income');
    const expenseCategories = AppState.data.categories.filter(c => c.type === 'expense');
    
    incomeList.innerHTML = incomeCategories.map(cat => createCategoryItem(cat)).join('');
    expenseList.innerHTML = expenseCategories.map(cat => createCategoryItem(cat)).join('');
    
    if (incomeCategories.length === 0) {
        incomeList.innerHTML = '<li class="text-center text-secondary">No income categories</li>';
    }
    if (expenseCategories.length === 0) {
        expenseList.innerHTML = '<li class="text-center text-secondary">No expense categories</li>';
    }
}

function createCategoryItem(category) {
    return `
        <li>
            <div class="category-name">
                <div class="category-color" style="background-color: ${category.color}"></div>
                <span>${category.name}</span>
            </div>
            <div class="category-actions">
                <button onclick="editCategory('${category.id}')">Edit</button>
                <button onclick="deleteCategory('${category.id}')">Delete</button>
            </div>
        </li>
    `;
}

function openCategoryModal(categoryId = null) {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    
    form.reset();
    
    if (categoryId) {
        const category = AppState.data.categories.find(c => c.id === categoryId);
        if (category) {
            document.getElementById('categoryId').value = category.id;
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryType').value = category.type;
            document.getElementById('categoryColor').value = category.color;
        }
    }
    
    modal.classList.add('active');
}

function handleCategorySubmit(e) {
    e.preventDefault();
    
    const categoryId = document.getElementById('categoryId').value;
    const categoryData = {
        id: categoryId || generateId(),
        name: document.getElementById('categoryName').value,
        type: document.getElementById('categoryType').value,
        color: document.getElementById('categoryColor').value || '#059669'
    };
    
    if (categoryId) {
        const index = AppState.data.categories.findIndex(c => c.id === categoryId);
        if (index !== -1) {
            AppState.data.categories[index] = categoryData;
        }
    } else {
        AppState.data.categories.push(categoryData);
    }
    
    saveDataToLocal();
    closeModal('categoryModal');
    showToast('Category saved successfully', 'success');
    loadCategories();
}

// Settings Page
function loadSettings() {
    document.getElementById('fiscalYear').value = AppState.data.settings.fiscalYearStart;
    document.getElementById('currency').value = AppState.data.settings.baseCurrency;
    
    // Load users
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = AppState.data.users.map(user => `
        <div class="user-item">
            <div>
                <strong>${user.name}</strong>
                <span class="text-secondary">${user.email}</span>
                <span class="badge">${user.role}</span>
            </div>
            ${user.id !== AppState.currentUser.id ? 
                `<button onclick="removeUser('${user.id}')" class="btn btn-sm btn-danger">Remove</button>` : ''}
        </div>
    `).join('');
}

function updateSettings() {
    AppState.data.settings.fiscalYearStart = document.getElementById('fiscalYear').value;
    AppState.data.settings.baseCurrency = document.getElementById('currency').value;
    
    // Update currency symbol
    const currencySymbols = {
        'INR': '₹',
        'USD': '$',
        'EUR': '€',
        'GBP': '£'
    };
    AppState.data.settings.currencySymbol = currencySymbols[AppState.data.settings.baseCurrency] || '₹';
    
    saveDataToLocal();
    showToast('Settings updated', 'success');
}

// User Management
function openUserModal() {
    document.getElementById('userModal').classList.add('active');
}

function handleUserSubmit(e) {
    e.preventDefault();
    
    const userData = {
        id: generateId(),
        name: document.getElementById('userFullName').value,
        email: document.getElementById('userEmailAddress').value,
        password: hashPassword(document.getElementById('userPassword').value),
        role: document.getElementById('userRole').value,
        createdAt: new Date().toISOString()
    };
    
    // Check if email already exists
    if (AppState.data.users.some(u => u.email === userData.email)) {
        showToast('User with this email already exists', 'error');
        return;
    }
    
    AppState.data.users.push(userData);
    saveDataToLocal();
    closeModal('userModal');
    showToast('User added successfully', 'success');
    loadSettings();
}

function removeUser(userId) {
    if (confirm('Are you sure you want to remove this user?')) {
        AppState.data.users = AppState.data.users.filter(u => u.id !== userId);
        saveDataToLocal();
        showToast('User removed', 'success');
        loadSettings();
    }
}

// Reports
function generateReport() {
    const period = document.getElementById('reportPeriod').value;
    const content = document.getElementById('reportContent');
    
    let startDate, endDate;
    const now = new Date();
    
    switch(period) {
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
    }
    
    const transactions = AppState.data.transactions.filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
    });
    
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const net = income - expenses;
    
    // Group by category
    const categoryTotals = {};
    transactions.forEach(t => {
        const category = AppState.data.categories.find(c => c.id === t.categoryId);
        const catName = category ? category.name : 'Uncategorized';
        if (!categoryTotals[catName]) {
            categoryTotals[catName] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') {
            categoryTotals[catName].income += t.amount;
        } else {
            categoryTotals[catName].expense += t.amount;
        }
    });
    
    content.innerHTML = `
        <div class="card">
            <h4>Financial Summary</h4>
            <p>Period: ${formatDate(startDate)} to ${formatDate(endDate)}</p>
            <div class="report-summary">
                <div class="summary-item">
                    <span>Total Income:</span>
                    <span class="amount income">${formatCurrency(income)}</span>
                </div>
                <div class="summary-item">
                    <span>Total Expenses:</span>
                    <span class="amount expense">${formatCurrency(expenses)}</span>
                </div>
                <div class="summary-item">
                    <span>Net Balance:</span>
                    <span class="amount ${net >= 0 ? 'income' : 'expense'}">${formatCurrency(net)}</span>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h4>Category Breakdown</h4>
            <table class="transactions-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Income</th>
                        <th>Expense</th>
                        <th>Net</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(categoryTotals).map(([name, totals]) => `
                        <tr>
                            <td>${name}</td>
                            <td class="income">${formatCurrency(totals.income)}</td>
                            <td class="expense">${formatCurrency(totals.expense)}</td>
                            <td class="${totals.income - totals.expense >= 0 ? 'income' : 'expense'}">
                                ${formatCurrency(totals.income - totals.expense)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="card">
            <button onclick="printReport()" class="btn btn-primary">Print Report</button>
            <button onclick="exportReportPDF()" class="btn btn-secondary">Export as PDF</button>
        </div>
    `;
}

// Export Functions
function exportTransactions() {
    const transactions = AppState.data.transactions.map(t => {
        const category = AppState.data.categories.find(c => c.id === t.categoryId);
        return {
            Date: t.date,
            Description: t.description,
            Category: category ? category.name : 'Uncategorized',
            Type: t.type,
            Amount: t.amount,
            'Payment Method': t.paymentMethod,
            Reference: t.reference,
            Tags: t.tags.join(', ')
        };
    });
    
    const csv = convertToCSV(transactions);
    downloadFile(csv, 'transactions.csv', 'text/csv');
    showToast('Transactions exported successfully', 'success');
}

function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? 
                `"${value}"` : value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

// Data Management
function backupData() {
    const backup = {
        version: DB_VERSION,
        timestamp: new Date().toISOString(),
        data: AppState.data
    };
    
    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, `cashbook-backup-${Date.now()}.json`, 'application/json');
    showToast('Backup created successfully', 'success');
}

function restoreData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const backup = JSON.parse(event.target.result);
                
                if (!backup.data || !backup.version) {
                    throw new Error('Invalid backup file');
                }
                
                AppState.data = backup.data;
                saveDataToLocal();
                showToast('Data restored successfully', 'success');
                
                // Reload current page
                navigateToPage(AppState.currentPage);
            } catch (error) {
                showToast('Failed to restore data: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function clearAllData() {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will delete ALL transactions, categories, and users. Are you absolutely sure?')) {
        return;
    }
    
    // Reset to default state
    AppState.data = {
        institution: "Makhdoomiyya Academy",
        lastSynced: null,
        settings: {
            openingBalance: 0,
            baseCurrency: "INR",
            fiscalYearStart: "April",
            currencySymbol: "₹"
        },
        categories: [],
        users: [],
        transactions: [],
        auditLog: []
    };
    
    setupDefaultCategories();
    saveDataToLocal();
    
    // Log out user
    handleLogout();
    
    showToast('All data cleared', 'success');
}

// Utility Functions
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function hashPassword(password) {
    // Simple hash for demonstration - in production, use proper hashing
    return btoa(password);
}

function verifyPassword(password, hash) {
    return btoa(password) === hash;
}

function formatCurrency(amount) {
    const symbol = AppState.data.settings.currencySymbol || '₹';
    return symbol + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('active');
    } else {
        spinner.classList.remove('active');
    }
}

function showLoginError(message) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    
    setTimeout(() => {
        errorElement.classList.remove('show');
    }, 5000);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
}

function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('active');
}

function toggleFilterPanel() {
    document.getElementById('filterPanel').classList.toggle('active');
}

function updateUserInterface() {
    if (AppState.currentUser) {
        document.getElementById('userInitials').textContent = 
            AppState.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('userName').textContent = AppState.currentUser.name;
        document.getElementById('userEmail').textContent = AppState.currentUser.email;
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function addAuditLog(action, details) {
    AppState.data.auditLog.push({
        userId: AppState.currentUser.id,
        action: action,
        timestamp: new Date().toISOString(),
        details: details
    });
    
    // Keep only last 1000 audit entries
    if (AppState.data.auditLog.length > 1000) {
        AppState.data.auditLog = AppState.data.auditLog.slice(-1000);
    }
}

function markSyncNeeded() {
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
        </svg>
        <span class="sync-text">Sync Needed</span>
    `;
}

// Setup default categories
function setupDefaultCategories() {
    if (AppState.data.categories.length === 0) {
        const defaultCategories = [
            // Income Categories
            { id: generateId(), name: 'Tuition Fees', type: 'income', color: '#059669' },
            { id: generateId(), name: 'Donations', type: 'income', color: '#10b981' },
            { id: generateId(), name: 'Grant Funding', type: 'income', color: '#34d399' },
            { id: generateId(), name: 'Event Registration', type: 'income', color: '#6ee7b7' },
            { id: generateId(), name: 'Book Sales', type: 'income', color: '#a7f3d0' },
            
            // Expense Categories
            { id: generateId(), name: 'Teacher Salaries', type: 'expense', color: '#dc2626' },
            { id: generateId(), name: 'Classroom Supplies', type: 'expense', color: '#ef4444' },
            { id: generateId(), name: 'Utilities', type: 'expense', color: '#f87171' },
            { id: generateId(), name: 'Rent', type: 'expense', color: '#fca5a5' },
            { id: generateId(), name: 'Maintenance', type: 'expense', color: '#fbbf24' },
            { id: generateId(), name: 'Student Activities', type: 'expense', color: '#fb923c' },
            { id: generateId(), name: 'Exam Fees', type: 'expense', color: '#fdba74' }
        ];
        
        AppState.data.categories = defaultCategories;
    }
}

// Edit and Delete functions for transactions
window.editTransaction = function(id) {
    openTransactionModal(id);
};

window.deleteTransaction = function(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        AppState.data.transactions = AppState.data.transactions.filter(t => t.id !== id);
        saveDataToLocal();
        showToast('Transaction deleted', 'success');
        loadTransactions();
    }
};

// Edit and Delete functions for categories
window.editCategory = function(id) {
    openCategoryModal(id);
};

window.deleteCategory = function(id) {
    // Check if category is in use
    const inUse = AppState.data.transactions.some(t => t.categoryId === id);
    
    if (inUse) {
        showToast('Cannot delete category that is in use', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this category?')) {
        AppState.data.categories = AppState.data.categories.filter(c => c.id !== id);
        saveDataToLocal();
        showToast('Category deleted', 'success');
        loadCategories();
    }
};

// Remove user function
window.removeUser = function(id) {
    removeUser(id);
};

// Close modal function
window.closeModal = function(modalId) {
    closeModal(modalId);
};

// Print report function
window.printReport = function() {
    window.print();
};

// Export report as PDF (placeholder)
window.exportReportPDF = function() {
    showToast('PDF export will be available after Google Drive integration', 'info');
};

// Filter functions
function applyTransactionFilter() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const type = document.getElementById('filterType').value;
    const category = document.getElementById('filterCategory').value;
    
    let filtered = AppState.data.transactions;
    
    if (startDate) {
        filtered = filtered.filter(t => t.date >= startDate);
    }
    
    if (endDate) {
        filtered = filtered.filter(t => t.date <= endDate);
    }
    
    if (type) {
        filtered = filtered.filter(t => t.type === type);
    }
    
    if (category) {
        filtered = filtered.filter(t => t.categoryId === category);
    }
    
    // Display filtered results
    const tbody = document.getElementById('transactionsTableBody');
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No transactions match the filter</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(transaction => {
        const cat = AppState.data.categories.find(c => c.id === transaction.categoryId);
        return `
            <tr>
                <td>${formatDate(transaction.date)}</td>
                <td>${transaction.description}</td>
                <td>${cat ? cat.name : 'Uncategorized'}</td>
                <td><span class="badge ${transaction.type}">${transaction.type}</span></td>
                <td class="transaction-amount ${transaction.type}">
                    ${formatCurrency(transaction.amount)}
                </td>
                <td>
                    <button onclick="editTransaction('${transaction.id}')" class="btn btn-sm">Edit</button>
                    <button onclick="deleteTransaction('${transaction.id}')" class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    
    showToast('Filter applied', 'success');
}

function clearTransactionFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    
    loadTransactions();
    showToast('Filter cleared', 'success');
}

// Chart functions (placeholder - will need Chart.js for full implementation)
function updateCharts() {
    // Placeholder for chart updates
    // In production, you would use Chart.js or similar library
    console.log('Charts would be updated here');
}

// Google Drive Integration (placeholder functions)
function connectGoogleDrive() {
    showToast('Google Drive integration requires API setup. See instructions in README.', 'info');
}

function syncWithGoogleDrive() {
    if (!AppState.driveConnected) {
        showToast('Please connect Google Drive first', 'warning');
        return;
    }
    
    showToast('Syncing with Google Drive...', 'info');
    // Implement actual Google Drive sync here
}

// Initialize the application
console.log('Makhdoomiyya Academy Cashbook Application Loaded');
