import { base44 } from '@/api/base44Client';

// =============================================================================
// Data Layer — Single Abstraction Point for All Backend Dependencies
// =============================================================================
// This file is the ONLY place that imports @base44/sdk directly.
// All new components should import from here (@/api/dataLayer), not base44Client.
//
// MIGRATION GUIDE (export off Base44):
// Replace the implementation below with your own API client.
// Interface contract to implement:
//   auth.me() · auth.logout(url?) · auth.updateMe(data) · auth.isAuthenticated()
//   entities.<Name>.list/sort/filter/get/create/update/delete/bulkCreate/bulkUpdate/updateMany/deleteMany
//   integrations.Core.InvokeLLM/UploadFile/GenerateImage/SendEmail/...
//   functions.invoke(name, payload)
//   users.inviteUser(email, role)
//   analytics.track({ eventName, properties })
// =============================================================================

export const api = {
  auth: base44.auth,
  entities: base44.entities,
  integrations: base44.integrations,
  functions: base44.functions,
  users: base44.users,
  analytics: base44.analytics,
  agents: base44.agents,
};

export default api;