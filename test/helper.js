const { connect } = require('../index');

const DEFAULT_OPTIONS = {
  dsn: 'mimerdb',
  user: 'SYSADM',
  password: 'SYSADM',
};

async function createClient(options) {
  return connect({ ...DEFAULT_OPTIONS, ...options });
}

async function dropTable(client, tableName) {
  try {
    await client.query(`DROP TABLE ${tableName}`);
  } catch (e) {
    // Ignore — table may not exist
  }
}

module.exports = { createClient, dropTable };
