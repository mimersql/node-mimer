/**
 * Test file for node-mimer
 * This demonstrates basic usage of the Mimer SQL Node.js bindings
 */

const { connect } = require('../index');
const assert = require('assert');

async function runTests() {
  let client;

  try {
    console.log('Connecting to Mimer SQL...');

    // Connect to database
    client = await connect({
      dsn: 'mimerdb',
      user: 'SYSADM',
      password: 'SYSADM'
    });

    console.log('Connected successfully!');
    console.log('Is connected:', client.isConnected());

    // Drop table if it exists from a previous run
    try { await client.query('DROP TABLE test_table'); } catch (e) { /* ignore */ }

    // Create a test table (DDL auto-commits, no explicit commit needed)
    console.log('\nCreating test table...');
    await client.query('CREATE TABLE test_table (id INTEGER, name NVARCHAR(100))');

    // Insert some data (auto-commits each statement by default)
    console.log('Inserting test data...');
    await client.query("INSERT INTO test_table VALUES (1, 'Anna')");
    await client.query("INSERT INTO test_table VALUES (2, 'Fredrik')");
    await client.query("INSERT INTO test_table VALUES (3, 'Charlie')");

    // Query data
    console.log('\nQuerying data...');
    const result = await client.query('SELECT * FROM test_table ORDER BY id');

    console.log('Result:', JSON.stringify(result, null, 2));
    console.log(`Found ${result.rowCount} rows`);

    // Display rows
    if (result.rows) {
      console.log('\nRows:');
      result.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Name: ${row.name}`);
      });
    }

    // Test transaction
    console.log('\nTesting transaction with rollback...');
    await client.beginTransaction();
    await client.query("INSERT INTO test_table VALUES (4, 'David')");
    await client.rollback();
    console.log('Rolled back successfully');

    // Verify rollback worked
    const result2 = await client.query('SELECT COUNT(*) as cnt FROM test_table');
    console.log('Count after rollback:', result2.rows[0].cnt, '(should be 3)');

    // ========================================
    // Test result metadata (fields)
    // ========================================
    console.log('\n--- Result Metadata Tests ---');

    // fields array on a normal SELECT
    console.log('Checking fields on SELECT...');
    const metaResult = await client.query('SELECT * FROM test_table ORDER BY id');
    assert.ok(Array.isArray(metaResult.fields), 'fields should be an array');
    assert.strictEqual(metaResult.fields.length, 2, 'should have 2 fields');
    assert.strictEqual(metaResult.fields[0].name, 'id');
    assert.strictEqual(metaResult.fields[1].name, 'name');
    assert.strictEqual(typeof metaResult.fields[0].dataTypeCode, 'number');
    assert.strictEqual(typeof metaResult.fields[0].dataTypeName, 'string');
    assert.strictEqual(typeof metaResult.fields[0].nullable, 'boolean');
    console.log('  OK: fields array correct on SELECT');

    // fields available even with zero rows
    console.log('Checking fields with zero rows...');
    const emptyResult = await client.query(
      'SELECT * FROM test_table WHERE id = -999'
    );
    assert.strictEqual(emptyResult.rowCount, 0, 'should have 0 rows');
    assert.ok(Array.isArray(emptyResult.fields), 'fields should exist on empty result');
    assert.strictEqual(emptyResult.fields.length, 2, 'should still have 2 fields');
    assert.strictEqual(emptyResult.fields[0].name, 'id');
    assert.strictEqual(emptyResult.fields[1].name, 'name');
    console.log('  OK: fields available on zero-row result');

    // fields on a multi-type table
    console.log('Checking fields on multi-type table...');
    try { await client.query('DROP TABLE test_meta'); } catch (e) { /* ignore */ }
    await client.query(
      'CREATE TABLE test_meta (a INTEGER NOT NULL, b NVARCHAR(50), c DOUBLE PRECISION, d BOOLEAN, e DATE)'
    );
    const metaResult2 = await client.query('SELECT * FROM test_meta');
    assert.strictEqual(metaResult2.fields.length, 5, 'should have 5 fields');

    // Check column names
    const expectedNames = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < expectedNames.length; i++) {
      assert.strictEqual(metaResult2.fields[i].name, expectedNames[i],
        `field ${i} name should be '${expectedNames[i]}'`);
    }

    // Check data type names
    assert.strictEqual(metaResult2.fields[0].dataTypeName, 'INTEGER');
    assert.strictEqual(metaResult2.fields[2].dataTypeName, 'DOUBLE PRECISION');
    assert.strictEqual(metaResult2.fields[3].dataTypeName, 'BOOLEAN');
    assert.strictEqual(metaResult2.fields[4].dataTypeName, 'DATE');

    // All fields should have a boolean nullable property
    for (const f of metaResult2.fields) {
      assert.strictEqual(typeof f.nullable, 'boolean',
        `${f.name}.nullable should be boolean`);
    }

    console.log('  OK: multi-type fields correct (names, types, nullability)');
    await client.query('DROP TABLE test_meta');

    // DML results should not have fields
    console.log('Checking DML has no fields...');
    const dmlResult = await client.query("INSERT INTO test_table VALUES (99, 'temp')");
    assert.strictEqual(dmlResult.fields, undefined, 'DML result should not have fields');
    assert.strictEqual(dmlResult.rowCount, 1, 'DML should report 1 affected row');
    console.log('  OK: DML result has no fields');
    await client.query('DELETE FROM test_table WHERE id = 99');

    // fields from prepared statement
    console.log('Checking fields on prepared statement...');
    const metaStmt = await client.prepare('SELECT * FROM test_table WHERE id = ?');
    const metaStmtResult = await metaStmt.execute([1]);
    assert.ok(Array.isArray(metaStmtResult.fields), 'prepared stmt should have fields');
    assert.strictEqual(metaStmtResult.fields.length, 2, 'prepared stmt should have 2 fields');
    assert.strictEqual(metaStmtResult.fields[0].name, 'id');
    assert.strictEqual(metaStmtResult.fields[1].name, 'name');
    console.log('  OK: prepared statement returns fields');
    await metaStmt.close();

    // ========================================
    // Test Unicode strings
    // ========================================
    console.log('\n--- Unicode Tests ---');

    try { await client.query('DROP TABLE test_unicode'); } catch (e) { /* ignore */ }
    await client.query('CREATE TABLE test_unicode (id INTEGER, text NVARCHAR(200))');

    // Various Unicode scripts and symbols
    const unicodeStrings = [
      { id: 1, text: 'Ångström' },              // Latin extended (Swedish)
      { id: 2, text: '日本語テスト' },            // Japanese
      { id: 3, text: '中文测试' },                // Chinese
      { id: 4, text: 'Тест Unicode' },           // Cyrillic
      { id: 5, text: 'مرحبا' },                  // Arabic
      { id: 6, text: '🎉🚀💾' },                 // Emoji (surrogate pairs in UTF-16)
      { id: 7, text: 'café résumé naïve' },      // French accents
      { id: 8, text: 'Ä Ö Ü ä ö ü ß' },         // German
    ];

    // Insert using parameterized queries
    console.log('Inserting Unicode strings...');
    const insertUnicode = await client.prepare('INSERT INTO test_unicode VALUES (?, ?)');
    for (const row of unicodeStrings) {
      await insertUnicode.execute([row.id, row.text]);
    }
    await insertUnicode.close();

    // Read back and verify round-trip
    console.log('Verifying Unicode round-trip...');
    const unicodeResult = await client.query(
      'SELECT * FROM test_unicode ORDER BY id'
    );
    assert.strictEqual(unicodeResult.rowCount, unicodeStrings.length,
      `should have ${unicodeStrings.length} rows`);

    for (let i = 0; i < unicodeStrings.length; i++) {
      const expected = unicodeStrings[i];
      const actual = unicodeResult.rows[i];
      assert.strictEqual(actual.id, expected.id);
      assert.strictEqual(actual.text, expected.text,
        `Unicode round-trip failed for id=${expected.id}: ` +
        `expected "${expected.text}", got "${actual.text}"`);
    }
    console.log('  OK: all Unicode strings round-trip correctly');

    // Verify parameterized SELECT with Unicode in WHERE
    console.log('Verifying Unicode in WHERE clause...');
    const jpResult = await client.query(
      'SELECT * FROM test_unicode WHERE text = ?', ['日本語テスト']
    );
    assert.strictEqual(jpResult.rowCount, 1);
    assert.strictEqual(jpResult.rows[0].text, '日本語テスト');
    console.log('  OK: Unicode WHERE clause works');

    await client.query('DROP TABLE test_unicode');

    // ========================================
    // Test parameterized queries
    // ========================================
    console.log('\n--- Parameterized Query Tests ---');

    // INSERT with ? parameters
    console.log('\nInserting with parameterized query...');
    await client.query('INSERT INTO test_table VALUES (?, ?)', [4, 'David']);
    await client.query('INSERT INTO test_table VALUES (?, ?)', [5, 'Eva']);

    // SELECT with ? in WHERE clause
    console.log('Selecting with parameterized WHERE...');
    const paramResult = await client.query(
      'SELECT * FROM test_table WHERE id = ?', [4]
    );
    console.log('Parameterized SELECT result:', JSON.stringify(paramResult, null, 2));
    console.log('  Expected: id=4, name=David');

    // Multiple parameter types
    console.log('Testing multiple parameter types...');
    try { await client.query('DROP TABLE test_types'); } catch (e) { /* ignore */ }
    await client.query(
      'CREATE TABLE test_types (id INTEGER, name NVARCHAR(100), amount DOUBLE PRECISION, active BOOLEAN)'
    );
    await client.query(
      'INSERT INTO test_types VALUES (?, ?, ?, ?)',
      [42, 'test string', 3.14, true]
    );
    const typeResult = await client.query('SELECT * FROM test_types');
    console.log('Type test result:', JSON.stringify(typeResult, null, 2));

    // NULL parameter
    console.log('Testing NULL parameter...');
    await client.query('INSERT INTO test_types VALUES (?, ?, ?, ?)', [99, null, null, false]);
    const nullResult = await client.query('SELECT * FROM test_types WHERE id = ?', [99]);
    console.log('NULL test result:', JSON.stringify(nullResult, null, 2));
    console.log('  name is null:', nullResult.rows[0].name === null);

    // Parameter count mismatch error — verify structured error properties
    console.log('Testing parameter count mismatch (structured error)...');
    try {
      await client.query('INSERT INTO test_types VALUES (?, ?, ?, ?)', [1, 'only two']);
      console.log('  ERROR: Should have thrown!');
    } catch (e) {
      console.log('  message:', e.message);
      console.log('  mimerCode:', e.mimerCode);
      console.log('  operation:', e.operation);
      console.log('  Has mimerCode:', e.mimerCode !== undefined);
      console.log('  Has operation:', e.operation !== undefined);
    }

    await client.query('DROP TABLE test_types');

    // ========================================
    // Test prepared statements
    // ========================================
    console.log('\n--- Prepared Statement Tests ---');

    // Prepare INSERT and execute multiple times
    console.log('\nPrepare + execute INSERT multiple times...');
    const insertStmt = await client.prepare('INSERT INTO test_table VALUES (?, ?)');
    await insertStmt.execute([10, 'Prepared1']);
    await insertStmt.execute([11, 'Prepared2']);
    await insertStmt.execute([12, 'Prepared3']);
    await insertStmt.close();

    // Verify the inserts worked
    const afterPrepared = await client.query(
      'SELECT * FROM test_table WHERE id >= 10 ORDER BY id'
    );
    console.log('Prepared inserts result:', JSON.stringify(afterPrepared, null, 2));
    console.log(`  Expected 3 rows, got ${afterPrepared.rowCount}`);

    // Prepare SELECT and execute with different params
    console.log('\nPrepare + execute SELECT with different params...');
    const selectStmt = await client.prepare(
      'SELECT * FROM test_table WHERE id = ?'
    );
    const r1 = await selectStmt.execute([10]);
    console.log('  id=10:', JSON.stringify(r1.rows));
    const r2 = await selectStmt.execute([11]);
    console.log('  id=11:', JSON.stringify(r2.rows));
    const r3 = await selectStmt.execute([12]);
    console.log('  id=12:', JSON.stringify(r3.rows));
    await selectStmt.close();

    // Error on execute after close
    console.log('\nTesting execute after close...');
    try {
      await selectStmt.execute([10]);
      console.log('  ERROR: Should have thrown!');
    } catch (e) {
      console.log('  Caught expected error:', e.message);
    }

    // Test: closing connection invalidates open statements
    console.log('\nTesting connection close invalidates statements...');
    const client2 = await connect({
      dsn: 'mimerdb',
      user: 'SYSADM',
      password: 'SYSADM'
    });
    const orphanStmt = await client2.prepare(
      'SELECT * FROM test_table WHERE id = ?'
    );
    // Close connection while statement is still open
    await client2.close();
    try {
      await orphanStmt.execute([1]);
      console.log('  ERROR: Should have thrown!');
    } catch (e) {
      console.log('  Caught expected error:', e.message);
    }
    // close() on an already-invalidated statement should be safe
    await orphanStmt.close();
    console.log('  Double close OK');

    // Clean up
    console.log('\nCleaning up...');
    await client.query('DROP TABLE test_table');

    console.log('\nAll tests passed!');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    if (client) {
      console.log('\nClosing connection...');
      await client.close();
      console.log('Connection closed');
    }
  }
}

// Run tests
runTests().catch(console.error);
