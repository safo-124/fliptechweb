// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'paddy@gmail.com'; // Change this to your desired admin email
    const adminPassword = 'adminpassword123'; // Change this to a strong password

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (existingAdmin) {
        console.log('Admin user already exists.');
        // Optionally update the admin user here if needed
        // For example, ensure their role is ADMIN and password is up to date
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await prisma.user.update({
            where: { email: adminEmail },
            data: {
                role: 'ADMIN',
                password: hashedPassword, // Update password if you change it
                name: 'Super Admin',
            }
        });
        console.log('Admin user checked/updated.');

    } else {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: 'Super Admin',
                role: 'ADMIN',
                isActive: true,
                lastLogin: null, // Or new Date() if you want to set it
            },
        });
        console.log('Admin user created successfully.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async() => {
        await prisma.$disconnect();
    });