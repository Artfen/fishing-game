// Make a friend code for Slow Tide: prints the line to add to GIFTS in src/giftcodes.js.
// Usage: node tools/gift-code.mjs YOUR-CODE [money] [name]
import { giftHash, cleanGift } from '../src/giftcodes.js';

const [code, money = '100', ...name] = process.argv.slice(2);
if (!code || cleanGift(code).length < 4) {
  console.error('Usage: node tools/gift-code.mjs YOUR-CODE [money] [name]  (at least four letters or digits)');
  process.exit(1);
}
const hash = await giftHash(code);
console.log(`  { hash: '${hash}', money: ${Number(money) || 0}, boats: true, name: '${(name.join(' ') || 'A friend’s gift').replace(/'/g, '’')}' },`);
