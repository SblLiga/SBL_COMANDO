import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Monthly Reset — runs on the 25th via the MonthlyReset workflow.
// Globally switches onboarding_completed to false for all standard users (role=user),
// forcing them to walk through the new month's onboarding before dashboard access.
// Invoked by the scheduler (no user context) — uses service role.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const result = await base44.asServiceRole.entities.User.updateMany(
      { role: 'user', onboarding_completed: true },
      { $set: { onboarding_completed: false } }
    );
    return Response.json({ status: 'success', reset_users: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});