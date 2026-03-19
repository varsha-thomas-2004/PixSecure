importScripts("exifr.js");

const Decision = {
    BLOCK: "block",
    WARN: "warn",
    ALLOW: "allow"
};

const IMAGE_EXTS = ["jpg", "jpeg", "png"];
const EXECUTABLE_EXTS = ["exe", "scr", "bat", "cmd", "js", "vbs", "hta", "lnk"];
const ARCHIVE_EXTS = ["zip", "rar", "7z", "iso"];
const pendingDownloads = {};

function getExtension(name) {
    if (!name) return "";
    const parts = name.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
}

//LAYER 1 – STRUCTURAL FILTER
function decideDownload(name, size) {

    const ext = getExtension(name);
    console.log("Getting extension: ", ext);

    if (EXECUTABLE_EXTS.includes(ext)) {
        return { decision: Decision.BLOCK, reason: "Executable file type." };
    }

    const multiExtRegex = new RegExp(
        `\\.(pdf|jpg|jpeg|docx|png)\\.(${EXECUTABLE_EXTS.join("|")})$`,
        "i"
    );

    if (multiExtRegex.test(name)) {
        return { decision: Decision.BLOCK, reason: "Multiple extension deception." };
    }

    if (ARCHIVE_EXTS.includes(ext)) {
        return { decision: Decision.WARN, reason: "Archive file." };
    }

    if (size > 100 * 1024 * 1024) {
        return { decision: Decision.WARN, reason: "Large file." };
    }

    return { decision: Decision.ALLOW, reason: "Nothing suspicious." };
}

//LAYER 2 – IMAGE METADATA INSPECTION
async function extractMetadataString(buffer) {

    const metadata = await exifr.parse(buffer, {
        tiff: true,
        exif: true,
        ifd0: true,
        userComment: true,
        mergeOutput: true
    });

    console.log("Raw metadata object:", metadata);

    if (!metadata) return "";

    let values = [];

    for (let value of Object.values(metadata)) {

        if (typeof value === "string") {
            values.push(value);
        }

        else if (value instanceof Uint8Array) {
            try {
                const decoded = new TextDecoder().decode(value);
                values.push(decoded);
            } catch {}
        }
    }

    const combined = values.join(" ");
    console.log("Extracted metadata string:", combined);

    return combined;
}

function extractFeatures(metadataString) {

    const features = {
        hasScriptTag: /<script/i.test(metadataString),
        hasJavascriptScheme: /javascript:/i.test(metadataString),
        hasEventHandler: /onerror|onload/i.test(metadataString),
        hasUrlEncodedPayload: false,
        hasBase64Payload: false
    };

    // URL decode detection
    try {
        const decodedURL = decodeURIComponent(metadataString);
        if (/<script/i.test(decodedURL)) {
            features.hasUrlEncodedPayload = true;
        }
    } catch {}

    // Base64 detection
    const base64Match = metadataString.match(/[A-Za-z0-9+/]{20,}={0,2}/);

    if (base64Match) {
        try {
            const decoded = atob(base64Match[0]);
            if (/<script/i.test(decoded)) {
                features.hasBase64Payload = true;
            }
        } catch {}
    }

    return features;
}

function scoreFeatures(features) {

    let score = 0;

    if (features.hasScriptTag) score += 6;
    if (features.hasJavascriptScheme) score += 6;
    if (features.hasEventHandler) score += 6;
    if (features.hasUrlEncodedPayload) score += 6;
    if (features.hasBase64Payload) score += 6;

    console.log("Feature scores: ", features, "Total score: ", score);
    return score;
}

function decideFromScore(score) {

    if (score >= 6)
    {
        console.log("Blocking due to high score: ", score);
        return Decision.BLOCK;
    }
    if (score >= 3)
    {
        console.log("Warning due to moderate score: ", score);
        return Decision.WARN;
    }
    console.log("Allowing due to low score: ", score);
    return Decision.ALLOW;
}

async function deepInspectImage(buffer) {

    try {

        const metadataString = await extractMetadataString(buffer);
        console.log("Extracted metadata string: ", metadataString);

        if (!metadataString) return Decision.ALLOW;

        const features = extractFeatures(metadataString);
        const score = scoreFeatures(features);

        return decideFromScore(score);

    } catch {
        return Decision.ALLOW;
    }
}

//DOWNLOAD CASCADE
chrome.downloads.onCreated.addListener(async (downloadItem) => {

    const url = downloadItem.url || "";
    const rawName = downloadItem.filename || url || "";
    const size = downloadItem.totalBytes || 0;
    const ext = getExtension(rawName);
    const layer1 = decideDownload(rawName, size);

    // Immediate block
    if (layer1.decision === Decision.BLOCK) {
        console.log(`Blocking download: ${rawName} - Reason: ${layer1.reason}`);
        chrome.downloads.cancel(downloadItem.id);
        return;
    }
    
    if (IMAGE_EXTS.includes(ext)) {
        
        chrome.downloads.pause(downloadItem.id);

        try {

            const response = await fetch(url, {
                headers: { "Range": "bytes=0-1048575" }
            });

            const buffer = await response.arrayBuffer();
            const deepResult = await deepInspectImage(buffer);
            console.log("Deep result returned:", deepResult);

            if (deepResult === Decision.BLOCK) {
                chrome.downloads.cancel(downloadItem.id);
                console.log(`Blocking download: ${rawName} - Reason: Suspicious image content`);
            } else {
                chrome.downloads.resume(downloadItem.id);
                console.log(`Allowing download: ${rawName} - Reason: Image content is safe`);
            }

        } catch {
            chrome.downloads.resume(downloadItem.id);
            console.log(`Allowing download: ${rawName} - Reason: Error occurred while inspecting image`);
        }
        return;
    }
    
    if (layer1.decision === Decision.WARN && ARCHIVE_EXTS.includes(ext)) {

    chrome.downloads.pause(downloadItem.id);

    const notificationId = `archive-warning-${downloadItem.id}`;
    
    console.log("Creating archive warning notification:", notificationId);
    chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "./icons/icon48.png",  
        title: "PixSecure Warning",
        message: "This archive file may contain executable content. Click to proceed or ignore to cancel.",
        requireInteraction: true
        }, (id) => {
    if (chrome.runtime.lastError) {
        console.error("Notification error:", chrome.runtime.lastError);
    } else {
        console.log("Notification created:", id);
    }
    });

    // Store download id for later
    pendingDownloads[notificationId] = downloadItem.id;

    return;
}

    // Immediate allow
    if (layer1.decision === Decision.ALLOW) {
        console.log(`Allowing download: ${rawName} - Reason: ${layer1.reason}`);
        return;
    }

});

chrome.notifications.onClicked.addListener((notificationId) => {

    if (pendingDownloads[notificationId]) {

        const downloadId = pendingDownloads[notificationId];

        chrome.downloads.resume(downloadId);

        delete pendingDownloads[notificationId];

        chrome.notifications.clear(notificationId);
    }
});