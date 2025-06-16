#!/usr/bin/env node

/**
 * BDPADrive User Registration Helper
 * 
 * This script helps create user accounts for testing purposes.
 * Make sure the server is running before executing this script.
 * 
 * Usage: node scripts/create-user.js <username> <email> <password>
 * Example: node scripts/create-user.js newuser user@example.com password123
 */

const axios = require('axios');
const path = require('path');

// Add the utils directory to the require path
const projectRoot = path.join(__dirname, '..');
const CryptoUtils = require(path.join(projectRoot, 'utils', 'cryptoUtils'));

const BASE_URL = 'http://localhost:3000';

async function createUser(username, email, password) {
    try {
        console.log(`🔄 Creating user: ${username}`);
        
        // Check if server is running
        try {
            await axios.get(`${BASE_URL}`);
        } catch (error) {
            throw new Error('Server is not running. Please start it with: npm start');
        }
        
        // Register via the web form
        const response = await axios.post(`${BASE_URL}/auth/register`, {
            username,
            email,
            password,
            confirmPassword: password
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        console.log(`✅ Successfully created user: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   Access: http://localhost:3000`);
        
        return true;
    } catch (error) {
        if (error.response && error.response.status === 302) {
            // Redirect means successful registration
            console.log(`✅ Successfully created user: ${username}`);
            console.log(`   Email: ${email}`);
            console.log(`   Access: http://localhost:3000`);
            return true;
        }
        
        console.error(`❌ Failed to create user ${username}:`, error.message);
        return false;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length !== 3) {
        console.log('Usage: node scripts/create-user.js <username> <email> <password>');
        console.log('Example: node scripts/create-user.js newuser user@example.com password123');
        process.exit(1);
    }
    
    const [username, email, password] = args;
    
    createUser(username, email, password).catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = { createUser };
