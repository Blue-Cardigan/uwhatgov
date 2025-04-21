import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server'; // Import App Router client

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil', // Match the version used in the old file
});

const proPriceId = process.env.STRIPE_PRO_PLAN_PRICE_ID!;
// Use the server-side environment variable without NEXT_PUBLIC_ prefix
const baseUrl = process.env.BASE_URL!;

export async function POST(_request: NextRequest) {
  // Create Supabase client for App Router Route Handler
  const supabase = createClient();

  // Get the user from Supabase
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    console.error('Error fetching user or user not logged in:', userError);
    return NextResponse.json({ error: 'Unauthorized: User not logged in or email missing.' }, { status: 401 });
  }

  const userId = user.id;
  const userEmail = user.email;

  // TODO: Add logic to check if the user (userId) is already subscribed in your DB
  // e.g., const { data: existingSubscription } = await supabase.from('subscriptions').select('status').eq('user_id', userId).single();
  // if (existingSubscription && existingSubscription.status === 'active') {
  //   return NextResponse.json({ error: 'User already subscribed.' }, { status: 400 });
  // }

  try {
    // TODO: Check if the user already exists as a Stripe Customer based on email or your DB
    // let customerId;
    // Find existing customer by email
    // const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    // if (customers.data.length > 0) {
    //   customerId = customers.data[0].id;
    // } else {
    //   // Create a new Stripe Customer
    //   const customer = await stripe.customers.create({ email: userEmail, metadata: { userId } });
    //   customerId = customer.id;
    //   // TODO: Save the customerId to your database associated with the userId
    //   // await supabase.from('your_user_profile_table').update({ stripe_customer_id: customerId }).eq('id', userId);
    // }

    // Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: proPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // customer: customerId, // Associate with existing or new Stripe customer
      customer_email: userEmail, // Prefill email, helps Stripe link payments
      metadata: {
        userId: userId, // Pass internal user ID for webhook fulfillment
      },
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancelled`,
      // Add automatic tax calculation if applicable
      // automatic_tax: { enabled: true },
    });

    if (!session.id) { // Check for session ID specifically
      console.error('Stripe session creation failed: No session ID returned.');
      return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 });
    }

    // Return the session ID
    return NextResponse.json({ sessionId: session.id });

  } catch (error) {
    console.error('Stripe API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: `Stripe error: ${errorMessage}` }, { status: 500 });
  }
} 