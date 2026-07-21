import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// GROW Webhook — processes subscription events from GROW via n8n
// POST /api/v1/webhooks/grow
// Validates a shared secret header, then flips subscription_status to 'inactive'
// on cancellation / billing-failure events.

const CANCEL_EVENTS = ['subscription_cancelled', 'cancellation', 'payment_failed', 'billing_failure', 'subscription_expired'];

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // --- Shared-secret validation ---
    const secret = Deno.env.get('GROW_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-grow-signature') || req.headers.get('x-webhook-secret');
    if (secret && providedSecret !== secret) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Normalize payload — support several field shapes from n8n/GROW
    const email = body.email || body.user_email || body.customer_email;
    const userId = body.user_id || body.id;
    const eventType = (body.event || body.event_type || body.type || '').toLowerCase();

    if (!email && !userId) {
      return Response.json({ error: 'Missing user identifier (email or user_id)' }, { status: 400 });
    }

    // Only act on cancellation / billing-failure events
    const isCancel = CANCEL_EVENTS.some((e) => eventType.includes(e)) || body.subscription_status === 'cancelled';

    if (!isCancel) {
      return Response.json({ status: 'ignored', reason: 'event_not_actionable', event: eventType });
    }

    // Locate the user by email (preferred) or id
    const query = email ? { email } : { id: userId };
    const result = await base44.asServiceRole.entities.User.updateMany(query, {
      $set: { subscription_status: 'inactive' },
    });

    return Response.json({
      status: 'success',
      event: eventType,
      matched: email || userId,
      updated: result,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});