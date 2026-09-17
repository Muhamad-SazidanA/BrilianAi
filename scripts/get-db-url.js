/**
 * Shared database connection string resolver for scripts/ CLI tools.
 * Automatically adapts docker-compose hostname to localhost when running on the host machine.
 */
function getConnectionString() {
  let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/brilian_db';
  if (connectionString.includes('@postgres:') && !process.env.DOCKER_CONTAINER) {
    connectionString = connectionString.replace('@postgres:', '@localhost:');
  }
  return connectionString;
}

module.exports = { getConnectionString };
