// app/api/admin/services/[serviceId]/status/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// import { verifyIsAdmin } from '@/lib/auth';

export async function PUT(request, { params }) {
    // --- Admin Authentication & Authorization ---
    // const adminUser = await verifyIsAdmin(request);
    // if (!adminUser) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const { serviceId } = params;
    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();
        const { status, rejectionReason } = body;

        if (!serviceId) return NextResponse.json({ error: 'Service ID is required.' }, { status: 400 });

        const upperCaseStatus = status ? .toUpperCase();
        if (!upperCaseStatus || !['ACTIVE', 'REJECTED', 'INACTIVE'].includes(upperCaseStatus)) {
            return NextResponse.json({ error: 'Invalid status. Must be ACTIVE, REJECTED, or INACTIVE.' }, { status: 400 });
        }

        const updateData = {
            status: upperCaseStatus,
            rejectionReason: upperCaseStatus === 'REJECTED' ? (rejectionReason || null) : null,
        };
        if (upperCaseStatus === 'ACTIVE') updateData.rejectionReason = null;

        const updatedService = await prisma.serviceListing.update({
            where: { id: serviceId },
            data: updateData,
            include: { // Return useful data
                artisan: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true } }
            }
        });
        return NextResponse.json(updatedService);
    } catch (error) {
        console.error(`API ERROR in PUT /api/admin/services/${serviceId}/status:`, error);
        console.error('Request Body Logged:', requestBodyText);
        if (error.code === 'P2025') return NextResponse.json({ error: 'Service not found to update.' }, { status: 404 });
        return NextResponse.json({ error: 'Internal Server Error. Failed to update service status.' }, { status: 500 });
    }
}