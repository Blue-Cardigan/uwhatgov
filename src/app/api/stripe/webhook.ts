import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { buffer } from 'micro'; // Helper to read the raw request body
import { createServerClient, parseCookieHeader, serializeCookieHeader, CookieOptions } from '@supabase/ssr';
import { Database } from '@/lib/database.types'; // Correct relative path from src/pages/api/stripe to src/lib

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil', // Use the latest stable API version or your target version
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Disable Next.js body parsing for this route to access the raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to create Supabase client for Pages Router API Routes
const createSupabaseClient = (req: NextApiRequest, res: NextApiResponse) => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Or SERVICE_ROLE_KEY if preferred for backend operations
    {
      cookies: {
        get: (name: string): string | undefined => {
          const cookies = parseCookieHeader(req.headers.cookie ?? '');
          const cookie = cookies.find(c => c.name === name);
          return cookie?.value;
        },
        set: (name: string, value: string, options: CookieOptions) => {
          res.setHeader('Set-Cookie', serializeCookieHeader(name, value, options));
        },
        remove: (name: string, options: CookieOptions) => {
          res.setHeader('Set-Cookie', serializeCookieHeader(name, '', { ...options, maxAge: 0 }));
        },
      },
      // Consider auth flow type if using service role key
      // auth: { flowType: 'pkce' }, 
    }
  );
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('Webhook Error: Missing stripe-signature header');
    return res.status(400).send('Webhook Error: Missing signature');
  }

  let event: Stripe.Event;

  try {
    const buf = await buffer(req); // Read the raw request body
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${errorMessage}`, err);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }

  // Create Supabase client *after* verifying webhook signature
  const supabase = createSupabaseClient(req, res);

  console.log(`Received Stripe event: ${event.type}`);

  // Handle the specific event types
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        // Extract userId from metadata
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (session.mode === 'subscription' && session.payment_status === 'paid' && userId && subscriptionId && customerId) {
          console.log(`Fulfilling subscription ${subscriptionId} for user ${userId}`);

          // Retrieve the subscription details for accurate period end and price ID
          let subscriptionDetails: Stripe.Subscription | null = null;
          try {
            subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
          } catch (retrieveError) {
             console.error(`Error retrieving subscription ${subscriptionId} from Stripe:`, retrieveError);
             // Decide if you should still proceed or return an error
             // Maybe proceed with placeholder data if critical, or fail the webhook handling
          }
          
          if (!subscriptionDetails) {
              console.error(`Could not retrieve subscription details for ${subscriptionId}. Aborting fulfillment.`);
              // Potentially return 500, but Stripe will retry. Log is important.
              break; // Exit the case
          }

          const priceId = subscriptionDetails.items.data[0]?.price.id;
          // Use type assertion for current_period_end due to library/API version mismatch
          const currentPeriodEndTs = (subscriptionDetails as any).current_period_end;
          const currentPeriodEnd = typeof currentPeriodEndTs === 'number' 
                                    ? new Date(currentPeriodEndTs * 1000).toISOString()
                                    : null;

          // Upsert subscription into your database
          const { error: upsertError } = await supabase
            .from('subscriptions') // Use table name from your definition
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: subscriptionDetails.status,
              current_period_end: currentPeriodEnd,
              stripe_price_id: priceId, // Match column name
              cancel_at_period_end: subscriptionDetails.cancel_at_period_end,
              // current_period_start might also be useful: new Date((subscriptionDetails as any).current_period_start * 1000).toISOString()
            }, { 
              onConflict: 'stripe_subscription_id' // Ensure this matches a unique constraint
            });

          if (upsertError) {
            console.error(`Database error upserting subscription ${subscriptionId} for user ${userId}:`, upsertError);
            // Potentially return 500 to signal failure to Stripe
            return res.status(500).json({ error: 'Database error during subscription fulfillment.' });
          } else {
             console.log(`Subscription ${subscriptionId} upserted successfully for user ${userId}.`);
             // Optional: Update a user profile table field like `has_pro_access` = true
             // const { error: userUpdateError } = await supabase.from('profiles').update({ has_pro_access: true }).eq('user_id', userId);
             // if (userUpdateError) console.error('Error updating user profile access:', userUpdateError);
          }

        } else {
          console.warn(`Webhook checkout.session.completed: Missing required data or payment not successful. Mode: ${session.mode}, Status: ${session.payment_status}, UserID present: ${!!userId}, SubID present: ${!!subscriptionId}, CustID present: ${!!customerId}`);
        }
        break;

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        let subscriptionId: string | null = null;
        const parent = invoice.parent as any; // Use type assertion

        // --- Logic for 2025-03-31.basil ---
        // Check the parent object to find the subscription ID
        if (parent?.type === 'subscription') {
          subscriptionId = parent.id;
        } else if (parent?.type === 'subscription_details' && typeof parent.subscription_details?.subscription === 'string') {
          subscriptionId = parent.subscription_details.subscription;
        } 
        // Removing the fallback to invoice.subscription as types indicate it doesn't exist reliably.
        // else if (typeof (invoice as any).subscription === 'string') { 
        //   console.warn(`Attempting fallback to deprecated invoice.subscription field for invoice ${invoice.id}`);
        //   subscriptionId = (invoice as any).subscription;
        // }
        // --- End 2025-03-31.basil logic ---

        // This often happens for recurring subscription payments.
        console.log(`Invoice payment succeeded for invoice ${invoice.id}, associated subscription: ${subscriptionId ?? 'N/A'}`);

        if (subscriptionId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_update')) {
          console.log(`Processing successful recurring payment for Subscription ID: ${subscriptionId}`);

          // Retrieve the subscription details for accurate period end
          let subscriptionDetails: Stripe.Subscription | null = null;
          try {
            subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
          } catch (retrieveError) {
             console.error(`Error retrieving subscription ${subscriptionId} from Stripe:`, retrieveError);
          }

          if (!subscriptionDetails) {
              console.error(`Could not retrieve subscription details for ${subscriptionId}. Cannot update period end.`);
              break; 
          }

          // Use type assertion for current_period_end
          const currentPeriodEndTs = (subscriptionDetails as any).current_period_end;
          const currentPeriodEnd = typeof currentPeriodEndTs === 'number' 
                                    ? new Date(currentPeriodEndTs * 1000).toISOString()
                                    : null;
          const priceId = subscriptionDetails.items.data[0]?.price.id;

          // Update the subscription status and period end in your database
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: subscriptionDetails.status, 
              current_period_end: currentPeriodEnd,
              stripe_price_id: priceId, // Match column name
              cancel_at_period_end: subscriptionDetails.cancel_at_period_end,
              // updated_at is handled by trigger, status handled by event
            })
            .eq('stripe_subscription_id', subscriptionId);

          if (updateError) {
            console.error(`Database error updating subscription ${subscriptionId} after successful payment:`, updateError);
            // Consider implications - maybe user access isn't extended?
          } else {
            console.log(`Subscription ${subscriptionId} updated successfully after payment.`);
          }
        } else if (!subscriptionId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_update')){
           console.error(`Invoice payment succeeded, but could not determine subscription ID from invoice ${invoice.id}.`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        let subscriptionId: string | null = null;
        const parent = failedInvoice.parent as any; // Use type assertion

        // --- Logic for 2025-03-31.basil --- 
        if (parent?.type === 'subscription') {
          subscriptionId = parent.id;
        } else if (parent?.type === 'subscription_details' && typeof parent.subscription_details?.subscription === 'string') {
          subscriptionId = parent.subscription_details.subscription;
        } 
        // --- End 2025-03-31.basil logic ---

        console.log(`Invoice payment failed for invoice ${failedInvoice.id}, associated subscription: ${subscriptionId ?? 'N/A'}`);
        
        if (subscriptionId) {
          // TODO: Handle failed payments using subscriptionId
          // - Find user/subscription in your database via subscriptionId.
          // - Notify the user.
          // - Update subscription status in your database (e.g., 'past_due', 'unpaid').
          // Stripe automatically retries payments based on your settings.
          console.log(`Handling failed payment for Subscription ID: ${subscriptionId}`);
        } else {
           console.error(`Could not determine subscription ID from failed invoice ${failedInvoice.id} with parent type ${parent?.type}.`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        console.log(`Subscription ${subscriptionId} updated. Status: ${subscription.status}`);

        // Use type assertion for current_period_end
        const currentPeriodEndTs = (subscription as any).current_period_end;
        const currentPeriodEnd = typeof currentPeriodEndTs === 'number' 
                                  ? new Date(currentPeriodEndTs * 1000).toISOString()
                                  : null;
        const priceId = subscription.items.data[0]?.price.id;

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: currentPeriodEnd,
            stripe_price_id: priceId, // Match column name
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscriptionId);
        
        if (updateError) {
            console.error(`Database error updating subscription ${subscriptionId} on update event:`, updateError);
        } else {
           console.log(`Subscription ${subscriptionId} updated in DB.`);
           // Optional: Update user profile based on new status
           // const isActive = subscription.status === 'active' || subscription.status === 'trialing';
           // Find the user ID associated with this subscription in your DB first
           // const { data: subData, error: findError } = await supabase.from('subscriptions').select('user_id').eq('stripe_subscription_id', subscriptionId).single();
           // if (subData) {
           //   await supabase.from('profiles').update({ has_pro_access: isActive }).eq('user_id', subData.user_id);
           // }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        console.log(`Subscription ${subscriptionId} deleted (canceled). Final Status: ${subscription.status}`);

        // Update status in DB to canceled
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({ 
             status: subscription.status, // Should usually be 'canceled'
             cancel_at_period_end: subscription.cancel_at_period_end, // Should be false
             // Consider setting current_period_end to null or leaving as is for history
             // cancel_date: new Date().toISOString(), // If you want to record the exact cancellation time
          })
          .eq('stripe_subscription_id', subscriptionId);

        if (updateError) {
          console.error(`Database error marking subscription ${subscriptionId} as canceled:`, updateError);
        } else {
          console.log(`Subscription ${subscriptionId} marked as canceled in DB.`);
           // Optional: Update user profile to revoke access
           // Find the user ID associated with this subscription in your DB first
           // const { data: subData, error: findError } = await supabase.from('subscriptions').select('user_id').eq('stripe_subscription_id', subscriptionId).single();
           // if (subData) {
           //   await supabase.from('profiles').update({ has_pro_access: false }).eq('user_id', subData.user_id);
           //   console.log(`Pro access revoked for user ${subData.user_id}`);
           // }
        }
        break;
      }

      // ... handle other event types as needed

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error handling webhook event:', error);
    // Don't send 4xx/5xx response here typically, as Stripe might retry.
    // Log the error thoroughly for debugging.
    res.status(500).json({ error: 'Webhook handler failed' }); // Or just res.status(200) to prevent retries for non-critical errors
  }
} 