// generate-password-hash.js
// Run this once to turn your chosen password into a secure hash for
// the .env file. Usage: node generate-password-hash.js yourpassword

const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.log('Usage: node generate-password-hash.js yourpassword');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nAdd this line to your .env file:\n');
console.log(`OWNER_PASSWORD_HASH=${hash}\n`);
