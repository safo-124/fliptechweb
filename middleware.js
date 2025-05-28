// middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is in your .env.local

async function verifyAdminToken(tokenValue) {
    if (!tokenValue) {
        console.log('Middleware: No token value provided');
        return null;
    }
    if (!JWT_SECRET) {
        console.error('Middleware: JWT_SECRET is not set in environment variables.');
        throw new Error('JWT_SECRET is not configured.'); // Fail fast if secret is missing
    }

    try {
        const { payload } = await jwtVerify(
            tokenValue,
            new TextEncoder().encode(JWT_SECRET)
        );
        // Check if the role is ADMIN
        if (payload && payload.role === 'ADMIN') {
            return payload; // Contains { userId, email, role, etc. }
        }
        console.log('Middleware: Token valid, but user is not ADMIN. Role:', payload.role);
        return null; // Valid token but not an admin
    } catch (err) {
        console.error('Middleware: JWT Verification Error -', err.message);
        return null; // Token is invalid (expired, malformed, signature mismatch)
    }
}

export async function middleware(request) {
    const { pathname } = request.nextUrl;
    const adminTokenCookie = request.cookies.get('adminToken');

    // Define paths that are part of the admin area and require authentication
    // The login page itself should not be in this list if it's matched by the middleware's config.
    // Or, ensure the login path check comes before redirecting.
    const adminProtectedPaths = ['/dashboard', '/users', '/settings']; // Add other admin paths as you create them

    const isAccessingAdminProtectedPath = adminProtectedPaths.some(path => pathname.startsWith(path));

    // If accessing the login page, let it through (unless already logged in, then maybe redirect to dashboard)
    // Assuming your admin login page is at `/login` or `/auth/login` etc.
    // Adjust this path if your admin login is different, e.g., /admin/login
    if (pathname.startsWith('/login')) { // Or your specific admin login path
        // Optional: If user has a valid admin token and tries to access login, redirect to dashboard
        if (adminTokenCookie && adminTokenCookie.value) {
            const decodedAdmin = await verifyAdminToken(adminTokenCookie.value);
            if (decodedAdmin) {
                console.log('Middleware: Admin already logged in, redirecting from login to dashboard');
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }
        return NextResponse.next(); // Allow access to login page
    }


    if (isAccessingAdminProtectedPath) {
        if (!adminTokenCookie || !adminTokenCookie.value) {
            console.log('Middleware: No adminToken cookie found for protected path. Redirecting to login.');
            const loginUrl = new URL('/login', request.url); // Adjust your admin login path
            loginUrl.searchParams.set('redirectedFrom', pathname); // Optional: inform login page
            return NextResponse.redirect(loginUrl);
        }

        // Verify the token
        const decodedAdminPayload = await verifyAdminToken(adminTokenCookie.value);

        if (!decodedAdminPayload) {
            console.log('Middleware: Invalid or non-admin token for protected path. Redirecting to login.');
            // Clear the invalid cookie to prevent redirect loops if token is malformed but present
            const loginUrl = new URL('/login', request.url); // Adjust your admin login path
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('adminToken', { path: '/' }); // Clear bad cookie
            return response;
        }

        // Token is valid and user is an admin, allow access
        // console.log('Middleware: Admin token verified. Allowing access to:', pathname);
        // Optionally, you can add headers to the request if needed by page components
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-admin-user-id', decodedAdminPayload.userId);
        requestHeaders.set('x-admin-user-email', decodedAdminPayload.email);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    }

    // For all other paths not covered, allow access
    return NextResponse.next();
}

// Configuration for the middleware
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - Any other public static assets (e.g., /images/*)
         *
         * This ensures the middleware runs on relevant page navigations.
         */
        '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
        // If your login page is at the root or a specific path that should be public,
        // ensure it's either excluded here or handled correctly within the middleware logic
        // to avoid redirect loops. The logic above for `/login` handles this.
    ],
};