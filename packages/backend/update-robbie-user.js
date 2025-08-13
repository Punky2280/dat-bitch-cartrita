import bcrypt from 'bcrypt';
import db from './src/db.js';

async function updateRobbieUser() {
  try {
    console.log('🔧 Updating robbienosebest@gmail.com user...');
    
    // Hash the password "punky1"
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('punky1', saltRounds);
    console.log('✅ Password hashed');
    
    // Update user with new password and admin permissions
    const result = await db.query(
      `UPDATE users 
       SET password_hash = $1, 
           role = 'admin', 
           is_admin = true,
           updated_at = NOW()
       WHERE email = 'robbienosebest@gmail.com'
       RETURNING id, name, email, role, is_admin`,
      [hashedPassword]
    );
    
    if (result.rows.length === 0) {
      console.error('❌ User not found');
      return;
    }
    
    const user = result.rows[0];
    console.log('✅ User updated successfully:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Admin: ${user.is_admin}`);
    
    console.log('\n🔑 User can now login with:');
    console.log('   Email: robbienosebest@gmail.com');
    console.log('   Password: punky1');
    console.log('   API Key: cartrita_dev_3_robbienosebest@gmail.com');
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
  } finally {
    process.exit();
  }
}

updateRobbieUser();