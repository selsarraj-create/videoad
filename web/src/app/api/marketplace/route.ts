import { NextResponse } from 'next/server';
import { marketplaceBridge } from '@/lib/marketplace-bridge';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || ''; // Allow empty query if category is set
        const category = searchParams.get('category');
        const brand = searchParams.get('brand');

        if (!query && !category && !brand) {
            return NextResponse.json({ error: 'Search query, category, or brand is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const items = await marketplaceBridge.searchAll(query, user.id, category || undefined, brand || undefined);

        return NextResponse.json({ items });
    } catch (error: any) {
        console.error('Marketplace API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
