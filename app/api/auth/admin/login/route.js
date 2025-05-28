// app/api/auth/admin/login/route.js

import prisma from '@/lib/prisma'; // Adjust path if your prisma client is elsewhere
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // Import cookies from next/headers for App Router

export async function POST(request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // 1. Validate input
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // 2. Find user by email
        const adminUser = await prisma.user.findUnique({
            where: {
                email: email.toLowerCase(),
            },
        });

        // 3. Check if user exists and is an ADMIN
        if (!adminUser || adminUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Invalid credentials or not an admin account' }, { status: 401 } // Unauthorized
            );
        }

        // 4. Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, adminUser.password);

        if (!isPasswordValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // 5. Update lastLogin timestamp
        const updatedAdmin = await prisma.user.update({
            where: { id: adminUser.id },
            data: { lastLogin: new Date() },
            select: { // Select only the fields needed for the token and response
                id: true,
                email: true,
                name: true,
                role: true,
                lastLogin: true,
                isActive: true,
            }
        });

        // 6. Generate a JWT
        const tokenPayload = {
            userId: updatedAdmin.id,
            email: updatedAdmin.email,
            role: updatedAdmin.role,
            // Add any other claims you find necessary for quick access
        };

        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET, {
                expiresIn: '1d', // Token expiration time (e.g., 1 day, 7 days) - adjust as needed
            }
        );

        // 7. Set the token in an HttpOnly cookie
        //    'cookies()' function must be called in a server context that supports it,
        //    like Route Handlers, Server Actions, or Middleware.
        cookies().set('adminToken', token, {
            httpOnly: true, // Client-side JavaScript cannot access this cookie
            secure: process.env.NODE_ENV === 'production', // Send only over HTTPS in production
            sameSite: 'strict', // Mitigates CSRF attacks
            maxAge: 60 * 60 * 24, // 1 day in seconds (should match token expiresIn if possible)
            path: '/', // Cookie available across the entire site
        });

        // 8. Return user info (excluding password)
        //    The token is now in an HttpOnly cookie, so no need to send it in the body.
        return NextResponse.json({
            message: 'Login successful',
            user: {
                id: updatedAdmin.id,
                email: updatedAdmin.email,
                name: updatedAdmin.name,
                role: updatedAdmin.role,
                lastLogin: updatedAdmin.lastLogin,
                isActive: updatedAdmin.isActive,
            },
        });

    } catch (error) {
        console.error('Admin Login Error:', error);
        // Distinguish between known errors and unexpected errors if necessary
        if (error.code === 'P2023' && error.message.includes('Invalid `prisma.user.findUnique()` invocation')) {
            // This can happen if the email field is not indexed or other Prisma specific issues.
            // Though typically, findUnique on an @unique field is straightforward.
            return NextResponse.json({ error: 'Database configuration issue.' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}