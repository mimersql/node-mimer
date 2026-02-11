const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('unicode', () => {
  let client;

  const unicodeStrings = [
    { id: 1, text: 'Ångström' },
    { id: 2, text: '日本語テスト' },
    { id: 3, text: '中文测试' },
    { id: 4, text: 'Тест Unicode' },
    { id: 5, text: 'مرحبا' },
    { id: 6, text: '🎉🚀💾' },
    { id: 7, text: 'café résumé naïve' },
    { id: 8, text: 'Ä Ö Ü ä ö ü ß' },
  ];

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_unicode');
    await client.query('CREATE TABLE test_unicode (id INTEGER, text NVARCHAR(200))');

    const stmt = await client.prepare('INSERT INTO test_unicode VALUES (?, ?)');
    for (const row of unicodeStrings) {
      await stmt.execute([row.id, row.text]);
    }
    await stmt.close();
  });

  after(async () => {
    await dropTable(client, 'test_unicode');
    await client.close();
  });

  it('all strings round-trip correctly', async () => {
    const result = await client.query('SELECT * FROM test_unicode ORDER BY id');
    assert.strictEqual(result.rowCount, unicodeStrings.length);

    for (let i = 0; i < unicodeStrings.length; i++) {
      const expected = unicodeStrings[i];
      const actual = result.rows[i];
      assert.strictEqual(actual.id, expected.id);
      assert.strictEqual(actual.text, expected.text,
        `Round-trip failed for id=${expected.id}: expected "${expected.text}", got "${actual.text}"`);
    }
  });

  it('Unicode in WHERE clause parameter works', async () => {
    const result = await client.query(
      'SELECT * FROM test_unicode WHERE text = ?', ['日本語テスト']
    );
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].text, '日本語テスト');
  });
});
