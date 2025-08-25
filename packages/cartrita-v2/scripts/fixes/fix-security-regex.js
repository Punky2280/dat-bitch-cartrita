const fs = require('fs');

const filePath = 'packages/backend/src/agi/security/SecurityAuditAgent.js';
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the malformed regex on line 69
  content = content.replace(
    /\/\(\\b\(union\|select\|insert\|update\|delete\|drop\|exec\|script\)\\b\.\*\\b\(from\|where\|order\|group\)\\b\)\/i/,
    '/\\\\b(union|select|insert|update|delete|drop|exec|script)\\\\b.*\\\\b(from|where|order|group)\\\\b/i'
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed SecurityAuditAgent.js regex pattern');
}
