async function getMessage(messageId) {
    let fullMessage = await messenger.messages.getFull(messageId);
    return fullMessage;
}

(async function() {
    console.log("Initializing ThunderScamDetector");
    messenger.messageDisplayScripts.register({
        js: [{ file: "messageDisplay/message-content-script.js" }],
        css: [{ file: "messageDisplay/message-content-styles.css" }],
    });

    let openTabs = await messenger.tabs.query();
    let messageTabs = openTabs.filter(
        tab => ["mail", "messageDisplay"].includes(tab.type)
    );
    for (let messageTab of messageTabs) {
        browser.tabs.executeScript(messageTab.id, {
            file: "messageDisplay/message-content-script.js"
        })
        browser.tabs.insertCSS(messageTab.id, {
            file: "messageDisplay/message-content-styles.css"
        })
    }
    
    messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.hasOwnProperty("command")) {
            return commandHandler(message, sender);
        }
        return false;
    });

    async function commandHandler(message, sender) {
        const messageHeader = await messenger.messageDisplay.getDisplayedMessage(
            sender.tab.id
        );

        if (!messageHeader) {
            return;
        }

        switch (message.command) {
            case "checkIfIsScamOrVirus":
                const messageBody = await getMessage(messageHeader.id);
                result = await scamChecker(messageBody, sender);
                return result;
        }
    }
    console.log("ThunderScamDetector initialized");
})();