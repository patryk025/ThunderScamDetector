async function getMessage(messageId) {
    let fullMessage = await messenger.messages.getFull(messageId);
    return fullMessage;
}

async function getAttachments(messageId) {
    let attachments = await browser.messages.listAttachments(messageId);
    return attachments;
}

function checkHyperlinksForDeception(messageBody) {
    let isDeceptive = false;
    let deceptiveLinks = [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(messageBody, "text/html");
    const links = doc.querySelectorAll("a");

    links.forEach(link => {
        const text = link.textContent.trim();
        const href = link.getAttribute("href").trim();

        try {
            const linkTextURL = new URL(text);
            const hrefURL = new URL(href);

            if (linkTextURL.hostname !== hrefURL.hostname) {
                isDeceptive = true;
                deceptiveLinks.push({ text: text, href: href });
            }
        } catch (error) {
            
        }
    });

    return { isDeceptive, deceptiveLinks };
}

function getMessageText(messagePart, html = false) {
    if(messagePart.body && messagePart.contentType == (html ? "text/html" : "text/plain")) {
        return messagePart.body;
    }
    if(messagePart.parts) {
        for (let i = 0; i < messagePart.parts.length; i++) {
            let body = getMessageText(messagePart.parts[i], html);
            if(body) {
                return body;
            }
        }
    }
}

function parseAddressField(addressField) {
    console.log(addressField);
    const regex = /"?([^"]+)"?\s<([^>]+)>/;
    const match = addressField.match(regex);
    if (match) {
        const senderName = match[1];
        const email = match[2];
        return { senderName, email };
    } else {
        return { senderName: "", email: addressField };
    }
}

async function scamChecker(messageId, sender) {
    let result = { isScamOrVirus: false, indicators: [] };

    let detectionThreshold = 3;
    let score = 0;
    let dangerousExtensions = {
        "autorun": ["exe", "msi"],
        "automount": ["iso", "img"],
        "compressed": ["zip", "rar", "7z", "tar", "tar.gz", "gz", "r09", "arc"],
        "scripts": ["vbs", "js", "bat", "cmd", "sh"],
        "office_macro": ["docm", "dotm", "xlm", "xltm", "xlsm", "xla", "xlam", "pptm", "potm", "ppsm", "sldm", "ppam", "accde"]
    };
    let descriptionMessages = {
        "autorun": "wykryto w załącznikach plik wykonywalny",
        "automount": "wykryto w załącznikach plik obrazu płyty, który może zawierać niebezpieczne pliki wykonywalne",
        "compressed": "wykryto skompresowane archiwum, zalecana ostrożność",
        "office_makro": "wykryto dokumenty stworzone w pakiecie biurowym z włączoną obsługą makr",
        "extension_mangling": "wykryto próbę ukrycia prawdziwego rozszerzenia pliku (plik zakończony na {extension})",
        "deceptive_links": "wykryto linki wprowadzające w błąd, kierujące w inne miejsce, niż opisane",
        "reply_domain_difference": "wykryto użycie \"Odpowiedź do\" kierującą odpowiedzi na skrzynkę pocztową znajdującą się w innej domenie",
        "sender_name_difference": "wykryto różnicę w nazwie nadawcy oraz osoby do odpowiedzi",
        "suspicious_tld": "wykryto wykorzystanie maila z serwera pocztowego z podejrzanej domeny najwyższego poziomu (końcówka adresu {tld})"
    };
    // list from https://trends.netcraft.com/cybercrime/tlds
    let suspiciousTopLevelDomains = [
        ".shop", ".top", ".cfd", ".ltd", ".autos", ".monster", ".club", ".trade", ".to", ".xyz", ".lol", ".bd", ".live", ".beauty", 
        ".ng", ".id", ".th", ".pk", ".life", ".su", ".pics", ".pro", ".network", ".sk", ".sa", ".best", ".cloud", ".asia", ".cc", 
        ".lk", ".ink", ".icu", ".pe", ".mx", ".digital", ".com", ".tw", ".in", ".link", ".ae", ".br", ".vn", ".ru", ".ke", ".rs", 
        ".tr", ".cl", ".lat", ".ar", ".vip"
    ];

    const messageBody = await getMessage(messageId);
    const attachments = await getAttachments(messageId);

    const from = messageBody.headers.from;
    const replyTo = messageBody.headers["reply-to"];

    var messageTextHTML = getMessageText(messageBody, true);
    var messagePlainText = getMessageText(messageBody);

    attachments.forEach(attachment => {
        let name = attachment.name;

        // check if name ends with dangerous extensions
        Object.entries(dangerousExtensions).forEach(([category, extensions]) => {
            extensions.forEach(extension => {
                if (name.endsWith("." + extension)) {
                    score += 2;
                    result.indicators.push(descriptionMessages[category]);
                }
            });
        });

        // check if file name doesn't looks like file_name,extension.dangerous_extension
        if (/,\w+\.\w+$/.test(name)) {
            let splitName = name.split(',');
            let supposedExtension = splitName[splitName.length - 1].split('.')[1];
            if (Object.values(dangerousExtensions).flat().includes(supposedExtension)) {
                score += 2;
                result.indicators.push(descriptionMessages["extension_mangling"].replace("{extension}", splitName[splitName.length - 1]));
            }
        }
    });

    // analyze message if HTML
    if(messageTextHTML) {
        let deceptiveLinks = checkHyperlinksForDeception(messageTextHTML);
        if(deceptiveLinks.length > 0) {
            score += 2;
            result.indicators.push(descriptionMessages["deceptive_links"]);
        }
    }

    
    const parsedFromAddress = parseAddressField(from[0]);
    const fromAddressDomain = parsedFromAddress.email.split("@")[1];
    const fromTLD = fromAddressDomain.split(".");

    // analyze sender and reply to
    if(replyTo) {
        const parsedReplyToAddress = parseAddressField(replyTo[0]);
        const replyToAddressDomain = parsedReplyToAddress.email.split("@")[1];

        if(fromAddressDomain != replyToAddressDomain) {
            score += 2;
            result.indicators.push(descriptionMessages["reply_domain_difference"]);
        }

        if(parsedFromAddress.senderName != parsedReplyToAddress.senderName) {
            score += 1;
            result.indicators.push(descriptionMessages["sender_name_difference"]);
        }
    }

    var scorePerElem = 1.5/suspiciousTopLevelDomains.length;

    for(var i = 0; i < suspiciousTopLevelDomains.length; i++) {
        if(fromTLD[fromTLD.length - 1] == suspiciousTopLevelDomains[i]) {
            score += 2 - i * scorePerElem;
            result.indicators.push(descriptionMessages["suspicious_tld"]);
            break;
        }
    }

    console.log(score);

    if(score > detectionThreshold) {
        result.isScamOrVirus = true;
    }
    else if(score == detectionThreshold) {
        result.isScamOrVirus = null; // maybe
    }

    return result;
}
