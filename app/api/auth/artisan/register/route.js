// app/api/auth/artisan/register/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Basic Ghana phone number validation (adjust regex as needed for more specific formats)
function isValidGhanaPhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;
    // Allows 02x, 05x, 03x starting numbers, followed by 8 digits.
    // Also allows +233 followed by 9 digits (excluding leading 0).
    const pattern = /^(0[235][0-9]{8}|(\+233)[235][0-9]{8})$/;
    return pattern.test(phoneNumber.replace(/\s+/g, '')); // Remove spaces before testing
}

// Basic Ghana Card ID validation (GHA-XXXXXXXXX-Y) - very basic format check
function isValidGhanaCardId(nationalId) {
    if (!nationalId) return false;
    // This is a superficial check. Real validation is more complex.
    const pattern = /^GHA-\d{9}-\d$/i; // Case insensitive for GHA part
    return pattern.test(nationalId.toUpperCase().trim());
}

export async function POST(request) {
    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text(); // Log raw body text for debugging
        const body = await request.json(); // Parse original request

        const { name, email, password, phoneNumber, nationalId } = body;

        // --- Input Validation ---
        if (!name || !email || !password || !phoneNumber || !nationalId) {
            return NextResponse.json({ error: 'Missing required fields: name, email, password, phone number, and national ID.' }, { status: 400 });
        }
        if (typeof name !== 'string' || name.trim().length < 2) {
            return NextResponse.json({ error: 'Full name must be at least 2 characters.' }, { status: 400 });
        }
        const trimmedEmail = email.toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { // Basic email regex
            return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
        }
        if (password.length < 6) { // Basic password length
            return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
        }
        // Phone and National ID validation (using helper functions)
        if (!isValidGhanaPhoneNumber(phoneNumber.trim())) {
            return NextResponse.json({ error: 'Invalid Ghanaian phone number format.' }, { status: 400 });
        }
        // Consider making National ID validation optional or more robust based on requirements
        // if (!isValidGhanaCardId(nationalId)) {
        //     return NextResponse.json({ error: 'Invalid National ID format. Expected format: GHA-XXXXXXXXX-X' }, { status: 400 });
        // }

        // --- Check for Existing User ---
        const existingUserByEmail = await prisma.user.findUnique({
            where: { email: trimmedEmail },
        });
        if (existingUserByEmail) {
            return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
        }
        // Optional: Add unique checks for phoneNumber or nationalId if required by your schema/logic
        // const existingUserByPhone = await prisma.user.findUnique({ where: { phoneNumber: phoneNumber.trim() }});
        // if (existingUserByPhone) return NextResponse.json({ error: 'This phone number is already registered.'}, { status: 409 });
        // const existingUserByNationalId = await prisma.user.findUnique({ where: { nationalId: nationalId.trim().toUpperCase() }});
        // if (existingUserByNationalId) return NextResponse.json({ error: 'This National ID is already registered.'}, { status: 409 });


        // --- Hash Password ---
        const hashedPassword = await bcrypt.hash(password, 10);

        // --- Create User in Database ---
        const newUser = await prisma.user.create({
            data: {
                name: name.trim(),
                email: trimmedEmail,
                password: hashedPassword,
                phoneNumber: phoneNumber.trim(),
                nationalId: nationalId.trim().toUpperCase(), // Store consistently
                role: 'ARTISAN', // Ensure ARTISAN role is set
                isActive: true, // Default to active, or false if admin approval is needed
            },
            select: { // Return only necessary fields (exclude password)
                id: true,
                name: true,
                email: true,
                role: true,
                phoneNumber: true,
                nationalId: true,
                isActive: true,
                createdAt: true,
            }
        });

        // --- Generate JWT Token ---
        const tokenPayload = {
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
            name: newUser.name,
        };
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET, // Ensure JWT_SECRET is in your .env.local
            { expiresIn: '7d' } // Token expiration
        );

        // --- Prepare Response ---
        // For mobile apps, returning the token in the JSON body is common.
        return NextResponse.json({
                message: 'Artisan registration successful!',
                user: newUser,
                token: token,
            }, { status: 201 } // 201 Created
        );

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in POST /api/auth/artisan/register:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Request Body Logged:', requestBodyText); // Log the raw text of the body
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        if (error.code === 'P2002') { // Prisma unique constraint violation
            let field = 'data'; // Default field name
            if (error.meta && error.meta.target && Array.isArray(error.meta.target)) {
                field = error.meta.target.join(', '); // e.g., "email" or "phoneNumber"
            } else if (error.meta && error.meta.target) {
                field = error.meta.target;
            }
            return NextResponse.json({ error: `This ${field} is already in use.` }, { status: 409 });
        }
        if (error instanceof SyntaxError && error.message.includes("JSON")) { // Error parsing request.json()
            return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        if (error.name === 'PrismaClientValidationError') {
            const validationErrorMessage = error.message.split('\n').find(line => line.startsWith('Unknown argument') || line.startsWith('Invalid value')) || error.message;
            return NextResponse.json({ error: `Validation error: ${validationErrorMessage}`, detail: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Registration failed. Check server logs.' }, { status: 500 });
    }
}