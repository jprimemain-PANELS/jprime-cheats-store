const { Client } = require('pg');
const fs = require('fs');

const client = new Client({ 
  connectionString: 'postgresql://postgres.rcjepkpmqedeuyfzdvnp:JPRIMEADMIN8881Y%40%23@aws-0-ap-south-1.pooler.supabase.com:5432/postgres' 
});

async function backup() {
  try {
    await client.connect();
    console.log('Connected to Supabase successfully...');
    
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    let sqlOutput = '-- Supabase Custom Backup\n\n';
    
    for (let row of tablesRes.rows) {
      const tableName = row.table_name;
      sqlOutput += `\n-- Data for table: ${tableName}\n`;
      
      const dataRes = await client.query(`SELECT * FROM "${tableName}"`);
      if (dataRes.rows.length > 0) {
        for (let dataRow of dataRes.rows) {
          const keys = Object.keys(dataRow).map(k => `"${k}"`).join(', ');
          const values = Object.values(dataRow).map(v => {
            if (v === null) return 'NULL';
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return v;
          }).join(', ');
          sqlOutput += `INSERT INTO "${tableName}" (${keys}) VALUES (${values});\n`;
        }
      }
    }
    
    fs.writeFileSync('my_supabase_backup.sql', sqlOutput);
    console.log('✅ Backup successful! Created my_supabase_backup.sql');
  } catch (err) {
    console.error('❌ Backup failed:', err);
  } finally {
    await client.end();
  }
}

backup();
