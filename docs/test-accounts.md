# BDPADrive Test Accounts

This document contains the test accounts created for the BDPADrive application.

## Available Test Accounts

### 👑 Admin Account
- **Username:** `admin`
- **Email:** `admin@bdpadrive.com`
- **Password:** `admin123`
- **Purpose:** Administrative testing and full feature access

### 👤 Test User Account
- **Username:** `testuser`
- **Email:** `test@bdpadrive.com` 
- **Password:** `testpass123`
- **Purpose:** General user testing and feature validation

## How to Login

1. Navigate to: http://localhost:3000
2. Click "Login" or go directly to: http://localhost:3000/auth/login
3. Enter the username and password from above
4. Click "Login" to access the application

## Creating Additional Users

To create additional test users, use the helper script:

```bash
node scripts/create-user.js <username> <email> <password>
```

Example:
```bash
node scripts/create-user.js newuser user@example.com mypassword123
```

## Features to Test

### Authentication
- ✅ User registration
- ✅ User login/logout
- ✅ Session management
- ✅ Password validation

### File Management
- ✅ Create text files with Markdown content
- ✅ Create folders for organization
- ✅ Create symbolic links
- ✅ File preview generation
- ✅ File editing with auto-save
- ✅ File deletion and management

### Advanced Features
- ✅ Tag-based file organization
- ✅ File sorting (name, date, size)
- ✅ Markdown editor with live preview
- ✅ File locking system
- ✅ Broken symlink detection
- ✅ Storage usage tracking

### User Interface
- ✅ Responsive design
- ✅ File explorer interface
- ✅ Dashboard with account management
- ✅ Error handling and user feedback

## Security Notes

- All passwords are hashed using PBKDF2 with random salts
- Sessions are secured with secret keys
- File ownership is enforced at the API level
- Input validation prevents malformed data

## Test Data

Each user account starts with an empty file system. You can create test files and folders to explore the application's features.

**Happy Testing! 🎉**
