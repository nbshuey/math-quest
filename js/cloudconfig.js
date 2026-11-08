// ☁️ Family accounts are off until this has a Firebase project's web settings, like:
//   export const CLOUD = { apiKey: 'AIza...', projectId: 'math-quest-12345' };
// These two values are safe to publish: the security rules in firestore.rules keep
// each family's data private to that family.
export const CLOUD = null;
