
import { tools } from './src/lib/assistant-tools';

async function runTests() {
    console.log("Starting Tests...");

    // Test 1: Get Debt Summary
    try {
        console.log("\n--- Testing getDebtSummary ---");
        const debts = await tools.getDebtSummary();
        console.log("Success:", JSON.stringify(debts, null, 2));
    } catch (e) {
        console.error("Failed getDebtSummary:", e);
    }

    // Test 2: Dry Run Mark Paid
    try {
        console.log("\n--- Testing markDebtPaid (Dry Run) ---");
        const result = await tools.markDebtPaid({
            debtId: '00000000-0000-0000-0000-000000000000', // Fake ID
            paidAt: '2024-02-06',
            amount: 500,
            dryRun: true
        });
        console.log("Success:", result);
    } catch (e) {
        console.error("Failed markDebtPaid:", e);
    }

    // Test 3: Dry Run Create Expense
    try {
        console.log("\n--- Testing createExpense (Dry Run) ---");
        const result = await tools.createExpense({
            amount: 100,
            category: 'Test',
            recipient: 'Tester',
            note: 'Test Note',
            date: '2024-02-06',
            dryRun: true
        });
        console.log("Success:", result);
    } catch (e) {
        console.error("Failed createExpense:", e);
    }
}

runTests();
