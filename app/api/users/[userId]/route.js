// app/api/users/[userId]/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct for your Prisma client
import { NextResponse } from 'next/server';
// import bcrypt from 'bcryptjs'; // Only needed if you were to implement password changes here

export async function GET(request, { params }) {
    const { userId } = params;
    // TODO: Add robust admin authentication/authorization check here if not fully handled by middleware

    try {
        if (!prisma || !prisma.user) {
            console.error("Prisma client or prisma.user is undefined in GET /api/users/[userId]");
            // This implies a serious setup issue with Prisma client initialization.
            throw new Error("Database client is not available.");
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { // Explicitly select fields to return, EXCLUDE password
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                // Example for future:
                // artisanProfile: { select: { bio: true, skills: true } },
                // _count: { select: { orders: true } }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        return NextResponse.json(user);

    } catch (error) {
        console.error('**********************************************');
        console.error(`API ERROR in GET /api/users/${userId}:`);
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');
        // Handle specific Prisma errors or malformed ID if necessary
        if (error.code === 'P2023' && error.message.includes('Malformed ObjectID')) { // Example for MongoDB
            return NextResponse.json({ error: 'Invalid User ID format.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch user details. Check server logs.' }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    const { userId } = params;
    // TODO: Add robust admin authentication/authorization check

    let requestBodyText = 'Could not parse or clone request body.'; // For logging
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();

        const { name, email, role, isActive } = body; // Fields admin can update

        if (!prisma || !prisma.user) {
            console.error("Prisma client or prisma.user is undefined in PUT /api/users/[userId]");
            throw new Error("Database client is not available.");
        }

        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) {
            return NextResponse.json({ error: 'User not found to update.' }, { status: 404 });
        }

        const updateData = {};

        if (name !== undefined && name !== existingUser.name) {
            updateData.name = name === "" ? null : name; // Allow unsetting name if your schema allows null
        }

        if (email !== undefined && email.toLowerCase() !== existingUser.email) {
            const trimmedEmail = email.trim().toLowerCase();
            if (!trimmedEmail) return NextResponse.json({ error: 'Email cannot be empty.' }, { status: 400 });

            const emailOwner = await prisma.user.findUnique({ where: { email: trimmedEmail } });
            if (emailOwner && emailOwner.id !== userId) {
                return NextResponse.json({ error: 'Email is already in use by another account.' }, { status: 409 }); // 409 Conflict
            }
            updateData.email = trimmedEmail;
        }

        if (role !== undefined && role !== existingUser.role) {
            const upperCaseRole = role.toUpperCase();
            if (!['ADMIN', 'ARTISAN', 'CUSTOMER'].includes(upperCaseRole)) {
                return NextResponse.json({ error: 'Invalid role specified.' }, { status: 400 });
            }
            // Add any specific logic/warnings for role changes here
            // e.g., prevent changing own admin role, or ensure an ArtisanProfile exists if changing to ARTISAN
            updateData.role = upperCaseRole;
        }

        if (isActive !== undefined && isActive !== existingUser.isActive) {
            if (typeof isActive !== 'boolean') {
                return NextResponse.json({ error: 'isActive must be a boolean value (true or false).' }, { status: 400 });
            }
            // Add logic to prevent self-deactivation if needed (requires knowing current admin's ID)
            updateData.isActive = isActive;
        }

        if (Object.keys(updateData).length === 0) {
            const { password, ...userWithoutPassword } = existingUser;
            return NextResponse.json({ message: 'No changes provided.', user: userWithoutPassword }, { status: 200 });
        }

        const updatedUserPrisma = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        // Exclude password from the response
        const { password, ...updatedUserWithoutPassword } = updatedUserPrisma;

        return NextResponse.json(updatedUserWithoutPassword);

    } catch (error) {
        console.error('**********************************************');
        console.error(`API ERROR in PUT /api/users/${userId}:`);
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Request Body Logged:', requestBodyText);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        if (error.code === 'P2002' && error.message.toLowerCase().includes('email')) {
            return NextResponse.json({ error: 'This email address is already in use.' }, { status: 409 });
        }
        if (error.code === 'P2025') { // Record to update not found (should be caught by `existingUser` check)
            return NextResponse.json({ error: 'User not found to update.' }, { status: 404 });
        }
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        if (error.name === 'PrismaClientValidationError') {
            // Provide a more user-friendly part of the validation error if possible
            const validationErrorMessage = error.message.split('\n').find(line => line.startsWith('Unknown argument') || line.startsWith('Invalid value')) || error.message;
            return NextResponse.json({ error: `Validation error updating user: ${validationErrorMessage}`, detail: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to update user. Check server logs.' }, { status: 500 });
    }
}

// DELETE handler could also be in this file if you want to allow admins to delete users
// export async function DELETE(request, { params }) { ... }