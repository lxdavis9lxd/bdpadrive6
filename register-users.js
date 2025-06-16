const axios = require('axios');
const CryptoUtils = require('./utils/cryptoUtils');

const BASE_URL = 'http://localhost:3000';

async function registerUser(username, email, password) {
    try {
        console.log(`\n🔄 Registering user: ${username}`);
        
        // Generate salt and derive key (same as the app does)
        const salt = CryptoUtils.generateSalt();
        const key = await CryptoUtils.deriveKey(password, salt);
        
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
                return status >= 200 && status < 400; // Accept redirects
            }
        });
        
        console.log(`✅ Successfully registered: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   Status: ${response.status}`);
        
        return true;
    } catch (error) {
        if (error.response && error.response.status === 302) {
            // Redirect means successful registration
            console.log(`✅ Successfully registered: ${username} (redirected)`);
            return true;
        }
        
        console.error(`❌ Failed to register ${username}:`, error.response?.data || error.message);
        return false;
    }
}

async function testLogin(username, password) {
    try {
        console.log(`\n🔄 Testing login for: ${username}`);
        
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            username,
            password
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        console.log(`✅ Login successful for: ${username}`);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 302) {
            // Redirect means successful login
            console.log(`✅ Login successful for: ${username} (redirected to explorer)`);
            return true;
        }
        
        console.error(`❌ Login failed for ${username}:`, error.response?.data || error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 BDPADrive User Registration Script');
    console.log('=====================================');
    
    // Wait for server to be ready
    console.log('\n⏳ Checking if server is running...');
    try {
        await axios.get(`${BASE_URL}`);
        console.log('✅ Server is running');
    } catch (error) {
        console.error('❌ Server is not running. Please start it with: npm start');
        process.exit(1);
    }
    
    // Register admin account
    const adminSuccess = await registerUser(
        'admin',
        'admin@bdpadrive.com',
        'admin123'
    );
    
    // Register test user account
    const testSuccess = await registerUser(
        'testuser',
        'test@bdpadrive.com',
        'testpass123'
    );
    
    // Test logins
    if (adminSuccess) {
        await testLogin('admin', 'admin123');
    }
    
    if (testSuccess) {
        await testLogin('testuser', 'testpass123');
    }
    
    console.log('\n📊 Registration Summary:');
    console.log('========================');
    console.log(`Admin Account (admin): ${adminSuccess ? '✅ Success' : '❌ Failed'}`);
    console.log(`Test Account (testuser): ${testSuccess ? '✅ Success' : '❌ Failed'}`);
    
    if (adminSuccess || testSuccess) {
        console.log('\n🎉 Account(s) registered successfully!');
        console.log('\n📋 Login Credentials:');
        
        if (adminSuccess) {
            console.log('\n👑 Admin Account:');
            console.log('   Username: admin');
            console.log('   Email: admin@bdpadrive.com');
            console.log('   Password: admin123');
        }
        
        if (testSuccess) {
            console.log('\n👤 Test User Account:');
            console.log('   Username: testuser');
            console.log('   Email: test@bdpadrive.com');
            console.log('   Password: testpass123');
        }
        
        console.log('\n🌐 Access the application at: http://localhost:3000');
    }
}

// Run the script
main().catch(console.error);
