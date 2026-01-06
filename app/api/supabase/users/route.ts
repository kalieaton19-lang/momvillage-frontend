
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

// GET /api/supabase/users?city=...&kidsAgeGroups=...&numberOfKids=...&language=...&parentingStyle=...&servicesOffered=...&servicesNeeded=...
export async function GET(req: NextRequest) {
	const admin = getSupabaseAdmin();
	const url = new URL(req.url);
	const params = url.searchParams;

	// Build filters from query params
	const city = params.get('city');
	const kidsAgeGroups = params.getAll('kidsAgeGroups'); // can be multiple
	const numberOfKids = params.get('numberOfKids');
	const language = params.get('language');
	const parentingStyle = params.get('parentingStyle');
	const servicesOffered = params.getAll('servicesOffered');
	const servicesNeeded = params.getAll('servicesNeeded');

	// Query public.profiles (or users) table
	let query = admin.from('profiles').select('*');
	if (city) query = query.eq('city', city);
	if (language) query = query.eq('preferred_language', language);
	if (parentingStyle) query = query.eq('parenting_style', parentingStyle);
	if (numberOfKids) query = query.gte('number_of_kids', Number(numberOfKids) - 1).lte('number_of_kids', Number(numberOfKids) + 1);
	// Array overlaps for age groups, services
	if (kidsAgeGroups.length > 0) query = query.overlaps('kids_age_groups', kidsAgeGroups);
	if (servicesOffered.length > 0) query = query.overlaps('services_offered', servicesOffered);
	if (servicesNeeded.length > 0) query = query.overlaps('services_needed', servicesNeeded);

	const { data, error } = await query;
	if (error) {
		return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
	// Return as { users: [...] }
	return new Response(JSON.stringify({ users: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
