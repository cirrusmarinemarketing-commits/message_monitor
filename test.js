const fs = require("fs");

const API_URL = "https://message-monitor.onrender.com/webhook/whatsapp/test";

const testData = JSON.parse(
    fs.readFileSync("./test-cases.json", "utf8")
);

async function sendMessage(testCase, message, waitForCompletion = false) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            wa_id: testCase.wa_id,
            name: testCase.name,
            message,
            waitForCompletion
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

async function runTestCase(testCase) {
    console.log("\n========================================");
    console.log(`TEST ${testCase.id}: ${testCase.name}`);
    console.log(`Messages: ${testCase.messages.length}`);
    console.log("========================================");

    for (let i = 0; i < testCase.messages.length; i++) {
        const message = testCase.messages[i];
        const isLastMessage = i === testCase.messages.length - 1;

        const result = await sendMessage(
            testCase,
            message,
            isLastMessage
        );

        console.log(`SENT: ${message}`);

        if (isLastMessage) {
            console.log("WAITING FOR AI COMPLETION...");

            if (result.status !== "completed") {
                throw new Error(
                    `Test ${testCase.id} did not complete: ${JSON.stringify(result)}`
                );
            }

            console.log("AI COMPLETED");
            console.log(
                "ANALYSIS:",
                JSON.stringify(result.analysis, null, 2)
            );
        }
    }

    console.log(`TEST ${testCase.id} COMPLETED`);
}

async function main() {
    console.log("========== START ALL TESTS ==========");

    for (const testCase of testData.cases) {
        await runTestCase(testCase);
    }

    console.log("\n========== ALL TESTS COMPLETED ==========");
}

main().catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
});