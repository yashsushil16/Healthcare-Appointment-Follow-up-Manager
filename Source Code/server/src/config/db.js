const { PrismaClient } = require('@prisma/client');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:./dev.db')
        ? process.env.DATABASE_URL
        : `file:${dbPath}`,
    },
  },
});

module.exports = prisma;
