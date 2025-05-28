// lib/prisma.js
import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient();
} else {
    if (!global.prisma) {
        global.prisma = new PrismaClient({
            // log: ['query', 'info', 'warn', 'error'], // Optional: for debugging
        });
    }
    prisma = global.prisma;
}

export default prisma;