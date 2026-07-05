import webpush from 'web-push';

console.log('Generating VAPID keys for Web Push Notifications...');
const keys = webpush.generateVAPIDKeys();

console.log('\n================================================================');
console.log('                     MEMORIQ VAPID KEYS                         ');
console.log('================================================================');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('================================================================\n');
console.log('Copy the keys above and add them to your environment variables on Vercel.');
console.log('For local development, we have already auto-generated keys in "local-vapid-keys.json".\n');
