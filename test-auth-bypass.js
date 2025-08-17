#!/usr/bin/env node

/**
 * Test script to verify the frontend auth bypass implementation
 * This simulates the frontend auth bypass logic outside of the browser
 */

// Mock the functions from authUtils.ts
function decodeMockToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Verify it's a mock token (has the bypass issuer)
    if (decoded.iss === "cartrita-frontend-bypass") {
      return decoded;
    }
    
    console.warn("⚠️ Received non-mock token, cannot decode with mock utilities");
    return null;
  } catch (error) {
    console.error("Failed to decode mock token:", error);
    return null;
  }
}

function isAuthenticated(token) {
  if (!token) return false;
  
  const user = decodeMockToken(token);
  if (!user) return false;
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  return user.exp > now;
}

// Simulate the LoginPage.tsx auth bypass logic
function createMockAuthToken(email, password) {
  // Basic validation (same as frontend)
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  if (password.length < 3) {
    throw new Error("Password must be at least 3 characters");
  }

  // Create mock user data and token (same as frontend)
  const mockUser = {
    id: 1,
    name: email.split('@')[0] || "User",
    email: email,
    role: "user",
    is_admin: false,
    iss: "cartrita-frontend-bypass",
    aud: "cartrita-clients",
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24h expiry
    iat: Math.floor(Date.now() / 1000)
  };

  // Create a JWT-like token (base64 encoded user data)
  const mockToken = Buffer.from(JSON.stringify(mockUser)).toString('base64');
  
  return { mockUser, mockToken };
}

// Test the auth bypass functionality
console.log("🧪 Testing Frontend Auth Bypass Implementation\n");

// Test Case 1: Valid credentials
try {
  console.log("Test 1: Valid email and password");
  const { mockUser, mockToken } = createMockAuthToken("test@example.com", "password123");
  console.log("✅ Mock token created successfully");
  console.log("📧 User email:", mockUser.email);
  console.log("👤 User name:", mockUser.name);
  console.log("🔑 Token length:", mockToken.length);
  
  // Test token validation
  const isValid = isAuthenticated(mockToken);
  console.log("✅ Token validation:", isValid ? "PASSED" : "FAILED");
  
  // Test token decoding
  const decoded = decodeMockToken(mockToken);
  console.log("✅ Token decoding:", decoded ? "PASSED" : "FAILED");
  console.log("📋 Decoded user:", JSON.stringify(decoded, null, 2));
  
} catch (error) {
  console.log("❌ Test 1 failed:", error.message);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test Case 2: Invalid credentials (short password)
try {
  console.log("Test 2: Invalid password (too short)");
  createMockAuthToken("test@example.com", "12");
  console.log("❌ Test 2 should have failed but didn't");
} catch (error) {
  console.log("✅ Test 2 correctly rejected:", error.message);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test Case 3: Missing email
try {
  console.log("Test 3: Missing email");
  createMockAuthToken("", "password123");
  console.log("❌ Test 3 should have failed but didn't");
} catch (error) {
  console.log("✅ Test 3 correctly rejected:", error.message);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test Case 4: Different email formats
const testEmails = [
  "lulufdez84@gmail.com",
  "robert@test.com", 
  "robbienosebest@gmail.com",
  "admin@cartrita.com"
];

console.log("Test 4: Multiple email formats");
testEmails.forEach((email, index) => {
  try {
    const { mockUser, mockToken } = createMockAuthToken(email, "testpass");
    const decoded = decodeMockToken(mockToken);
    console.log(`✅ Email ${index + 1} (${email}): Generated user "${decoded.name}"`);
  } catch (error) {
    console.log(`❌ Email ${index + 1} (${email}): Failed - ${error.message}`);
  }
});

console.log("\n🎉 Frontend Auth Bypass Test Complete!");
console.log("\n💡 To test in browser:");
console.log("   1. Open http://localhost:3003");
console.log("   2. Use any email + password (3+ characters)");
console.log("   3. Should see development mode warning");
console.log("   4. Login should succeed and redirect to dashboard");