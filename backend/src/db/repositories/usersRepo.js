const db = require('../connection');
const SQL = require('../sqlQueries');

async function createUser(email, passwordHash) {
  const result = await db.query(SQL.users.create, [email, passwordHash]);
  return result.rows[0];
}

async function getUserByEmail(email) {
  return db.queryOne(SQL.users.byEmail, [email]);
}

module.exports = {
  createUser,
  getUserByEmail,
};
