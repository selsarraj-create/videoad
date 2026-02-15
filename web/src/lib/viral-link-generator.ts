/**
 * Viral Link Generator
 * 
 * Logic to construct composite affiliate IDs for 3-way commission splits.
 * Format: REMIXERID_ORIGINALID (e.g., user789_user123)
 */

export interface AffiliateParams {
    userId: string;
    originalCreatorId?: string | null;
}

export function generateCompositeId({ userId, originalCreatorId }: AffiliateParams): string {
    if (originalCreatorId && originalCreatorId !== userId) {
        return `${userId}_${originalCreatorId}`;
    }
    return userId;
}

export function appendTrackingToUrl(url: string, compositeId: string, source: 'skimlinks' | 'ebay'): string {
    const separator = url.includes('?') ? '&' : '?';
    const paramName = source === 'skimlinks' ? 'xcust' : 'customid';

    // Remove existing tracking if any (basic regex)
    let cleanUrl = url.replace(new RegExp(`[\\?&]${paramName}=[^&]*`, 'g'), '');

    // Ensure we don't end up with a stray & or ? at the end
    cleanUrl = cleanUrl.replace(/[&?]$/, '');

    const finalSeparator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${finalSeparator}${paramName}=${compositeId}`;
}

/**
 * Parses a composite ID back into its components.
 * Returns { remixerId: string, originalCreatorId?: string }
 */
export function parseCompositeId(id: string): { remixerId: string, originalCreatorId?: string } {
    if (id.includes('_')) {
        const [remixerId, originalCreatorId] = id.split('_');
        return { remixerId, originalCreatorId };
    }
    return { remixerId: id };
}
