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
                return { isScamOrVirus: true, indicators: ["test"] };
        }
    }
    console.log("ThunderScamDetector initialized");
})();