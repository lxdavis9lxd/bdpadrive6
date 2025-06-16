# BDPADrive

A modern web-based file storage and synchronization service built with Node.js, Express, and EJS.

## Features

### User Authentication
- User registration with secure password hashing using PBKDF2
- Login/logout functionality
- Session management

### File Management
- **Explorer View**: Browse, create, and manage files and folders
- **Editor View**: Rich markdown editor with live preview
- **File Types**: Support for text files, directories, and symbolic links
- **File Operations**: Create, read, update, delete files and folders
- **File Previews**: Automatic thumbnail generation for text files
- **Tags**: Organize files with up to 5 alphanumeric tags
- **Sorting**: Sort files by name, creation date, modification date, or size

### Advanced Features
- **Symlinks**: Create symbolic links that point to other files/folders
- **Auto-save**: Automatic saving every 30 seconds in the editor
- **File Locking**: Prevent concurrent edits with user-client locking
- **Markdown Support**: Full markdown rendering with live preview
- **Responsive Design**: Mobile-friendly interface

### Dashboard
- Account overview and statistics
- Update email address
- Change password
- Account deletion with data cleanup
- Storage usage tracking

## Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: EJS templating, Bootstrap 5, Font Awesome
- **Markdown**: markdown-it library
- **Image Generation**: html2canvas for file previews
- **Crypto**: Built-in Node.js crypto for PBKDF2 password hashing
- **Session Management**: express-session

## API Integration

The application integrates with the BDPADrive API (https://drive.api.hscc.bdpa.org/v1) for:
- User management (CRUD operations)
- File system operations
- Authentication
- Data persistence

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`:
   ```
   API_BASE_URL=https://drive.api.hscc.bdpa.org/v1
   API_KEY=your-api-key-here
   SESSION_SECRET=your-session-secret-here
   PORT=3000
   ```
4. Start the server:
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Usage

### Getting Started
1. Visit the application in your browser
2. Register a new account or login with existing credentials
3. Start creating files and folders in the Explorer
4. Use the Editor to write and edit markdown files
5. Organize files with tags and folders
6. Create symlinks for quick access to important files

### User Types

#### Guest Users
- Can only access the authentication pages
- Must register or login to access file features

#### Authenticated Users
- Full access to all features
- Can create, edit, and delete their own files
- Can organize files in folders
- Can create symlinks
- Access to personal dashboard

### File Management

#### Creating Files
1. Navigate to Explorer
2. Click "New File"
3. Enter file name and optional tags
4. Add markdown content
5. Save the file

#### Creating Folders
1. Navigate to Explorer
2. Click "New Folder"
3. Enter folder name
4. Folder is created and ready to contain files

#### Creating Symlinks
1. Navigate to Explorer
2. Click "New Symlink"
3. Enter symlink name
4. Select target file/folder
5. Symlink is created pointing to the target

### Editor Features
- **Markdown Support**: Write in markdown with live preview
- **Auto-save**: Changes saved automatically every 30 seconds
- **File Locking**: Prevents concurrent edits
- **Tag Management**: Add/remove tags while editing
- **File Operations**: Rename or delete files from editor

## Security Features

- Password hashing using PBKDF2 with random salts
- Session-based authentication
- API key protection for backend calls
- Input validation and sanitization
- CSRF protection through session validation
- File ownership verification

## File Size Limits

- Text files: Maximum 10KB per file
- Tags: Maximum 5 tags per file
- Tag format: Alphanumeric characters only

## Browser Compatibility

- Modern browsers supporting ES6+
- Bootstrap 5 compatible browsers
- HTML5 Canvas support for file previews

## Development

### Project Structure
```
bdpadrive6/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── routes/                # Express route handlers
│   ├── auth.js           # Authentication routes
│   ├── explorer.js       # File explorer routes
│   ├── editor.js         # File editor routes
│   └── dashboard.js      # Dashboard routes
├── utils/                 # Utility modules
│   ├── apiClient.js      # API client for backend
│   ├── cryptoUtils.js    # Crypto utilities
│   └── helpers.js        # Helper functions
├── views/                 # EJS templates
│   ├── layout.ejs        # Main layout
│   ├── error.ejs         # Error page
│   ├── auth/             # Authentication views
│   ├── explorer/         # File explorer views
│   ├── editor/           # File editor views
│   └── dashboard/        # Dashboard views
└── public/               # Static assets
    ├── css/style.css     # Custom styles
    └── js/app.js         # Client-side JavaScript
```

### Available Scripts
- `npm start`: Start production server
- `npm run dev`: Start development server with auto-reload
- `npm test`: Run tests (placeholder)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please refer to the project documentation or create an issue in the repository.