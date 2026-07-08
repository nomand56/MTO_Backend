import { Client } from 'pg';
import { config } from 'dotenv';

config();

async function setupDatabase() {
  const dbName = process.env.DATABASE_NAME ?? 'movethisout';
  const dbUser = process.env.DATABASE_USER ?? 'movethisout';
  const dbPassword = process.env.DATABASE_PASSWORD ?? 'movethisout';
  const adminUser = process.env.POSTGRES_ADMIN_USER ?? 'postgres';
  const adminPassword = process.env.POSTGRES_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      'POSTGRES_ADMIN_PASSWORD is required to create the movethisout user and database.',
    );
  }

  const client = new Client({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: adminUser,
    password: adminPassword,
    database: 'postgres',
  });

  await client.connect();

  const userExists = await client.query(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [dbUser],
  );

  if (userExists.rowCount === 0) {
    await client.query(
      `CREATE ROLE "${dbUser}" WITH LOGIN PASSWORD '${dbPassword.replace(/'/g, "''")}'`,
    );
    console.log(`Created user: ${dbUser}`);
  } else {
    await client.query(
      `ALTER ROLE "${dbUser}" WITH PASSWORD '${dbPassword.replace(/'/g, "''")}'`,
    );
    console.log(`Updated password for user: ${dbUser}`);
  }

  const dbExists = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName],
  );

  if (dbExists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}" OWNER "${dbUser}"`);
    console.log(`Created database: ${dbName}`);
  } else {
    await client.query(`ALTER DATABASE "${dbName}" OWNER TO "${dbUser}"`);
    console.log(`Database already exists: ${dbName}`);
  }

  await client.end();

  const dbClient = new Client({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: adminUser,
    password: adminPassword,
    database: dbName,
  });

  await dbClient.connect();
  await dbClient.query(`GRANT ALL ON SCHEMA public TO "${dbUser}"`);
  await dbClient.query(`ALTER SCHEMA public OWNER TO "${dbUser}"`);
  await dbClient.end();
}

setupDatabase().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
