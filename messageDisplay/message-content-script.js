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

    const bannerText = document.createElement("div");
    bannerText.className = "thunderbirdDangerMessage_Text";
    if (isScamOrVirus == null) {
        banner.className = "thunderbirdWarningMessage";
        bannerText.innerText = "Skonsultuj tego maila z administratorami. Ta wiadomość może być próbą ataku socjotechnicznego. Wskazują na to następujące rzeczy: " + indicators.join("; ") + ".";
    }
    else {
        bannerText.innerText = "Skonsultuj tego maila z administratorami. Ta wiadomość prawdopodobnie jest próbą ataku. Wskazują na to następujące rzeczy: " + indicators.join("; ") + ".";
    }

    banner.appendChild(bannerText);

    document.body.insertBefore(banner, document.body.firstChild);
};

showBanner();