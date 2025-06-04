// app/api/services/[serviceId]/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const { serviceId } = params;
    try {
        const service = await prisma.serviceListing.findUnique({
            where: { id: serviceId },
            include: {
                artisan: { select: { id: true, name: true } },
                category: { select: { id: true, name: true } }
            }
        });

        if (!service || service.status !== 'ACTIVE') {
            // TODO: Allow admin/owner to view non-active
            return NextResponse.json({ error: 'Service not found or not available.' }, { status: 404 });
        }
        return NextResponse.json(service);
    } catch (error) {
        console.error(`API ERROR in GET /api/services/${serviceId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
    }
}

// PUT and DELETE for owner/admin would go here too, similar to products/[productId]/route.js