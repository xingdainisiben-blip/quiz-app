const crypto = require('crypto');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O, 1/I to avoid confusion

function generateRoomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

module.exports = { generateRoomCode };
