/**
 * Parses DATABASE_URL into a MariaDB connection config.
 */
export const createMariaDbConfig = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const sslRequired =
    url.searchParams.has('sslaccept') ||
    url.searchParams.get('ssl') === 'true' ||
    url.hostname.endsWith('.mysql.database.azure.com');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ...(sslRequired ? { ssl: true } : {}),
  };
};
