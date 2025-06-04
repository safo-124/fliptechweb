// app/api/admin/products/[productId]/status/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// import { verifyIsAdmin } from '@/lib/auth'; // Your actual admin auth verification utility

export async function PUT(request, { params }) {
    // --- Admin Authentication & Authorization ---
    // const adminUser = await verifyIsAdmin(request);
    // if (!adminUser) {
    //   return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    // }

    const { productId } = params;
    let requestBodyText = 'Could not parse or clone request body.';

    try {
        const requestClone = request.clone(); // For logging
        requestBodyText = await requestClone.text();
        const body = await request.json();

        const { status, rejectionReason } = body;

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
        }

        const upperCaseStatus = status ? status.toUpperCase() : '';
        if (!upperCaseStatus || !['ACTIVE', 'REJECTED', 'INACTIVE'].includes(upperCaseStatus)) {
            return NextResponse.json({ error: 'Invalid status. Must be ACTIVE, REJECTED, or INACTIVE.' }, { status: 400 });
        }

        if (upperCaseStatus === 'REJECTED' && (!rejectionReason || rejectionReason.trim() === '')) {
            // Consider making rejectionReason mandatory if status is REJECTED
            // return NextResponse.json({ error: 'Rejection reason is required when rejecting a product.' }, { status: 400 });
        }

        const productToUpdate = await prisma.productListing.findUnique({
            where: { id: productId }
        });

        if (!productToUpdate) {
            return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
        }

        const updateData = {
            status: upperCaseStatus,
            rejectionReason: upperCaseStatus === 'REJECTED' ? (rejectionReason || null) : null,
        };

        // If approving a previously rejected item, clear the rejection reason
        if (upperCaseStatus === 'ACTIVE') {
            updateData.rejectionReason = null;
        }

        const updatedProduct = await prisma.productListing.update({
            where: { id: productId },
            data: updateData,
            include: { // Return useful data for the admin panel
                artisan: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true } }
            }
        });

        return NextResponse.json(updatedProduct);

    } catch (error) {
        console.error(`API ERROR in PUT /api/admin/products/${productId}/status:`, error);
        console.error('Request Body Logged:', requestBodyText);
        // Add more detailed error logging if needed
        if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found to update.' }, { status: 404 });
        return NextResponse.json({ error: 'Internal Server Error. Failed to update product status.' }, { status: 500 });
    }
}