import { createWaypoint, createCase } from "@waypoint/core";

// Run with: ANTHROPIC_API_KEY=sk-... npx tsx index.ts

const waypoint = createWaypoint();

const hint = await waypoint.hint(
  createCase({
    task: {
      content:
        "Write a function that finds all prime numbers up to n using the Sieve of Eratosthenes",
      type: "code",
      successCriteria: "Must use the sieve algorithm, not trial division",
    },
    attempt: {
      content:
        "function primes(n) { const result = []; for(let i=2; i<=n; i++) { let isPrime = true; for(let j=2; j<i; j++) { if(i%j===0) isPrime=false; } if(isPrime) result.push(i); } return result; }",
      failureSignal:
        "Implementation uses trial division O(n²) instead of Sieve of Eratosthenes O(n log log n)",
      attemptNumber: 1,
    },
  })
);

console.log("\n=== Hint ===");
console.log(hint.content);
console.log("\nTarget concept:", hint.targetConcept);
console.log("Signal creation:", hint.quality.signalCreation.toFixed(2));
console.log("Signal transfer:", hint.quality.signalTransfer.toFixed(2));
console.log("Recommendation: ", hint.recommendation);
