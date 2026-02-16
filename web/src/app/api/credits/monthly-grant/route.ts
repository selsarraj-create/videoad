import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { grantMonthlyCredits } from '@/lib/credit-router'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/credits/monthly-grant
 * 
 * Cron endpoint — grants monthly credits to High-Octane users.
 * Protected by CRON_SECRET. Run on 1st of each month.
 */
export async function POST(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Find all High-Octane users with monthly_credit_grant > 0
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, monthly_credit_grant')
            .eq('subscription_status', 'high_octane')
            .gt('monthly_credit_grant', 0)

        if (error) {
            console.error('Failed to fetch high-octane users:', error)
            return NextResponse.json({ error: 'Query failed' }, { status: 500 })
        }

        let granted = 0
        for (const user of users || []) {
            await grantMonthlyCredits(user.id, user.monthly_credit_grant)
            granted++
        }

        return NextResponse.json({
            success: true,
            granted,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        console.error('Monthly grant error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
