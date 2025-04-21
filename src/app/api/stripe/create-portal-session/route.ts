import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

// Initialize Stripe within this route
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil', // Use consistent API version
});

export async function POST() {
  // Explicitly type the client with the imported Database definition
  const supabase = createClient();

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error('Error getting session or no user:', sessionError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Retrieve the Stripe Customer ID from your database
    // Ensure 'profiles' table and 'stripe_customer_id' column exist in your Database types
    const { data: profileData, error: profileError } = await supabase
      .from('subscriptions') // Now Supabase client should recognize 'profiles' via Database type
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (profileError) { // Check profileError first
      console.error('Error fetching profile:', profileError);
      // Handle specific Supabase errors like PGFAC001 for RLS or PGRST116 for no rows if needed
      return NextResponse.json({ error: 'Failed to retrieve customer information', details: profileError.message }, { status: 500 });
    }

    if (!profileData?.stripe_customer_id) { // Then check if customer ID is missing
       console.error('Missing Stripe customer ID for user:', userId);
       return NextResponse.json({ error: 'Customer ID not found for this user.' }, { status: 404 }); // Or 500 depending on expectation
    }

    const stripeCustomerId = profileData.stripe_customer_id;

    // 2. Create a Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.BASE_URL}/billing`, // Redirect back to the billing page
    });

    if (!portalSession.url) {
        throw new Error('Failed to create portal session.');
    }

    // 3. Return the portal session URL
    return NextResponse.json({ url: portalSession.url });

  } catch (err: any) {
    console.error('Error creating Stripe portal session:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
} 