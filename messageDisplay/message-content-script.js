async function showBanner() {
    console.log("Show banner")
    let scanStatus = await browser.runtime.sendMessage({
        command: "checkIfIsScamOrVirus",
    });

    const { isScamOrVirus, indicators } = scanStatus;

    if (isScamOrVirus == false) {
        return;
    }
    const banner = document.createElement("div");
    banner.className = "thunderbirdDangerMessage";
    if (isScamOrVirus == null) {
        banner.className = "thunderbirdWarningMessage";
    }

    const bannerText = document.createElement("div");
    bannerText.className = "thunderbirdDangerMessage_Text";
    bannerText.innerText = "Ta wiadomość prawdopodobnie jest próbą ataku. Wskazują na to następujące rzeczy: " + indicators.join("; ") + ". Skonsultuj tego maila z administratorami.";

    banner.appendChild(bannerText);

    document.body.insertBefore(banner, document.body.firstChild);
};

showBanner();