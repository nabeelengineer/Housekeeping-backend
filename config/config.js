require('dotenv').config();

const common = {
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: false,
  migrationStorageTableName: 'sequelize_meta',
};

module.exports = {
  development: { ...common },
  test: { ...common, database: process.env.DB_NAME_TEST || process.env.DB_NAME },
  production: { ...common },
};
