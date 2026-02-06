
import { tools } from './src/lib/assistant-tools';

async function runBudgetTests() {
    console.log("Starting Budget Tests...");

    // Test 1: Get Budget Status
    try {
        console.log("\n--- Testing getBudgetStatus ---");
        const status = await tools.getBudgetStatus({});
        console.log("Success:", JSON.stringify(status, null, 2));
    } catch (e) {
        console.error("Failed getBudgetStatus:", e);
    }

    // Test 2: Dry Run Set Budget
    try {
        console.log("\n--- Testing setBudgetLimit (Dry Run) ---");
        const result = await tools.setBudgetLimit({
            category: 'Test Category',
            amount: 5000,
            dryRun: true
        });
        console.log("Success:", result);
    } catch (e) {
        console.error("Failed setBudgetLimit:", e);
    }
}

runBudgetTests();
