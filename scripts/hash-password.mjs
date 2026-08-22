import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });

const password = await rl.question("Password to hash (input is visible — run this in a private terminal): ");
rl.close();

if (!password) {
  console.error("No password entered.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

console.log("\nHash (copy this into the matching env var in Vercel — never the plain password):\n");
console.log(hash);
