#!/usr/bin/env node

/**
 * Script to create test users with proper password hashes
 */

import bcrypt from 'bcrypt';
import db from '../src/db.js';

async function createTestUsers() {
  try {
    const password = 'punky1';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    console.log('Creating test users with password hash...');
    console.log('Password hash for "punky1":', hashedPassword);

    const testUsers = [
      { name: 'Lulu Fernandez', email: 'lulufdez84@gmail.com' },
      { name: 'Robert Allen', email: 'robert@test.com' },
      { name: 'Robbie', email: 'robbienosebest@gmail.com' },
      { name: 'Rob', email: 'robert@rob.com' },
    ];

    for (const user of testUsers) {
      try {
        const result = await db.query(
          `
          INSERT INTO users (name, email, password_hash, created_at, updated_at) 
          VALUES ($1, $2, $3, NOW(), NOW()) 
          ON CONFLICT (email) 
          DO UPDATE SET password_hash = $3, updated_at = NOW()
          RETURNING id, name, email
        `,
          [user.name, user.email, hashedPassword]
        );

        console.log(
          `✅ User created/updated: ${result.rows[0].name} (${result.rows[0].email})`
        );
      } catch (error) {
        console.error(`❌ Failed to create user ${user.email}:`, error.message);
      }
    }

    console.log('\n🎉 Test users setup complete!');
    console.log(
      'You can now login with any of these emails using password: punky1'
    );
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    process.exit(0);
  }
}

createTestUsers();
