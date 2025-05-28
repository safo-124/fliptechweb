// app/api/auth/artisan/login/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request) {
    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text(); // For logging in case of error
        const body = await request.json();
        const { email, password } = body;

        // 1. Validate input
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }
        const trimmedEmail = email.toLowerCase().trim();

        // 2. Find user by email
        if (!prisma || !prisma.user) {
            console.error("Prisma client or prisma.user is undefined in POST /api/auth/artisan/login");
            throw new Error("Database client is not available.");
        }
        const user = await prisma.user.findUnique({
            where: {
                email: trimmedEmail,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials or not an artisan account.' }, { status: 401 }); // User not found
        }

        // 3. Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return NextResponse.json({ error: 'Invalid credentials or not an artisan account.' }, { status: 401 }); // Password incorrect
        }

        // 4. Verify user role IS ARTISAN
        if (user.role !== 'ARTISAN') {
            return NextResponse.json({ error: 'Access denied. This login is for artisans only.' }, { status: 403 }); // Forbidden
        }

        // 5. Check if user is active
        if (!user.isActive) {
            return NextResponse.json({ error: 'Account is inactive. Please contact support.' }, { status: 403 });
        }

        // 6. Update lastLogin timestamp
        const updatedUserWithLastLogin = await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
            select: { // Select fields to return
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                phoneNumber: true,
                nationalId: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true,
            }
        });

        // 7. Generate a JWT
        const tokenPayload = {
            userId: updatedUserWithLastLogin.id,
            email: updatedUserWithLastLogin.email,
            role: updatedUserWithLastLogin.role,
            name: updatedUserWithLastLogin.name,
        };

        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET, // Ensure JWT_SECRET is in your .env.local
            { expiresIn: '7d' } // Adjust token expiration as needed
        );

        return NextResponse.json({
            message: 'Artisan login successful!',
            user: updatedUserWithLastLogin,
            token: token,
        });

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in POST /api/auth/artisan/login:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Request Body Logged:', requestBodyText);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        // Handle PrismaClientValidationError specifically if it's not caught by other checks
        if (error.name === 'PrismaClientValidationError') {
            return NextResponse.json({ error: `Validation error during login: ${error.message.split('\n').pop()}`, detail: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Login failed. Check server logs.' }, { status: 500 });
    }
}