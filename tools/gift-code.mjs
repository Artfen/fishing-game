// Make a friend code for Slow Tide: prints the line to add to GIFTS in src/giftcodes.js.
// Usage: node tools/gift-code.mjs YOUR-CODE [money] [name] [--boats-only | --money-only]
//   money: pounds into the purse (default 100; 0 with --boats-only)
//   --boats-only: every boat and no money; --money-only: the money and no boats.
import { giftHash, cleanGift } from '../src/giftcodes.js';

const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith('--')));
const [code, money = flags.has('--boats-only') ? '0' : '100', ...name] = args.filter((a) => !a.startsWith('--'));
if (!code || cleanGift(code).length < 4 || (flags.has('--boats-only') && flags.has('--money-only'))) {
  console.error('Usage: node tools/gift-code.mjs YOUR-CODE [money] [name] [--boats-only | --money-only]  (at least four letters or digits)');
  process.exit(1);
}
const hash = await giftHash(code);
const pounds = flags.has('--boats-only') ? 0 : Math.max(0, Math.round(Number(money) || 0));
const boats = !flags.has('--money-only');
console.log(`  { hash: '${hash}', money: ${pounds}, boats: ${boats}, name: '${(name.join(' ') || 'A friend’s gift').replace(/'/g, '’')}' },`);
