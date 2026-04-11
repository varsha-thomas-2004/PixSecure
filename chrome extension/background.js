importScripts("exifr.js");

const BACKEND_URL = "http://127.0.0.1:5000";
const BACKEND_TIMEOUT_MS = 5000;

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

    console.log("=== [Stage 2: Metadata Extraction] ===");
    console.log(metadata);

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
            } catch { }
        }
    }

    const combined = values.join(" ");
    console.log("=== [Stage 3: Metadata Normalization] ===");
    console.log(combined);

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
    } catch { }

    // Base64 detection
    const base64Match = metadataString.match(/[A-Za-z0-9+/]{20,}={0,2}/);

    if (base64Match) {
        try {
            const decoded = atob(base64Match[0]);
            if (/<script/i.test(decoded)) {
                features.hasBase64Payload = true;
            }
        } catch { }
    }

    return features;
}

function scoreFeatures(features) {

    let score = 0;
    let detected = false;

    console.log("=== [Stage 4: Feature Detection] ===");

    if (features.hasScriptTag) {
        detected = true;
        score += 6;
        console.log("Script tag: ", true);
    }
    if (features.hasJavascriptScheme) {
        detected = true;
        score += 6;
        console.log("Javascript scheme: ", true);
    }
    if (features.hasEventHandler) {
        detected = true;
        score += 6;
        console.log("Event handler: ", true);
    }
    if (features.hasUrlEncodedPayload) {
        detected = true;
        score += 6;
        console.log("URL encoded payload: ", true);
    }
    if (features.hasBase64Payload) {
        detected = true;
        score += 6;
        console.log("Base64 payload: ", true);
    }
    if (!detected) {
        console.log("No suspicious features detected.");
    }
    console.log("=== [Stage 5: Risk Scoring] ===");
    console.log("Total score:", score);
    return score;
}

function decideFromScore(score) {

    console.log("=== [Stage 6: Final Decision] ===");
    if (score >= 6) {
        console.log("Final decision: BLOCK");
        console.log("=====================================");
        return Decision.BLOCK;
    }
    if (score >= 3) {
        console.log("Final decision: WARN");
        console.log("=====================================");
        return Decision.WARN;
    }
    console.log("Final decision: ALLOW");
    console.log("=====================================");
    return Decision.ALLOW;
}

async function deepInspectImage(buffer) {

    try {

        const metadataString = await extractMetadataString(buffer);

        if (!metadataString) return Decision.ALLOW;

        const features = extractFeatures(metadataString);
        const score = scoreFeatures(features);

        return decideFromScore(score);

    } catch {
        return Decision.ALLOW;
    }
}

async function checkBackend(buffer, filename) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
        const blob = new Blob([buffer]);
        const formData = new FormData();
        formData.append("image", blob, filename || "image.png");

        const resp = await fetch(`${BACKEND_URL}/analyze/image`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
            const data = await resp.json();
            console.log("CNN Backend Response:", data);
            return data.decision === "BLOCK" ? Decision.BLOCK : Decision.ALLOW;
        }
    } catch (e) {
        console.warn("CNN Backend unavailable or failed:", e);
    }
    return Decision.ALLOW;
}

//DOWNLOAD CASCADE
chrome.downloads.onCreated.addListener(async (downloadItem) => {

    const url = downloadItem.url || "";
    const rawName = downloadItem.filename || url || "";
    const size = downloadItem.totalBytes || 0;
    const ext = getExtension(rawName);
    const layer1 = decideDownload(rawName, size);

    console.log("=== [Stage 1: Initial Decision] ===");
    console.log("Decision:", layer1.decision);

    // Immediate block
    if (layer1.decision === Decision.BLOCK) {
        chrome.downloads.cancel(downloadItem.id);
    }

    else if (IMAGE_EXTS.includes(ext)) {

        chrome.downloads.pause(downloadItem.id);

        try {

            const response = await fetch(url, {
                headers: { "Range": "bytes=0-1048575" }
            });

            const buffer = await response.arrayBuffer();
            const deepResult = await deepInspectImage(buffer);

            if (deepResult === Decision.BLOCK) {
                console.log("Local metadata check BLOCKED the image.");
                chrome.downloads.cancel(downloadItem.id);
            } else if (deepResult === Decision.WARN) {
                console.log("Local check returned WARN. Proceeding to CNN analysis.");
                // ONLY RUN CNN ON WARN IMAGES
                const cnnResult = await checkBackend(buffer, rawName);
                if (cnnResult === Decision.BLOCK) {
                    console.log("CNN Check BLOCKED the image.");
                    chrome.downloads.cancel(downloadItem.id);
                } else {
                    console.log("CNN Check PASSED the image.");
                    chrome.downloads.resume(downloadItem.id);
                }
            } else {
                chrome.downloads.resume(downloadItem.id);
            }

        } catch {
            chrome.downloads.resume(downloadItem.id);
        }
    }

    else if (layer1.decision === Decision.WARN && ARCHIVE_EXTS.includes(ext)) {

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
    }

    // Immediate allow
    else if (layer1.decision === Decision.ALLOW) {
        // No action needed, download proceeds
    }
    return;
});

chrome.notifications.onClicked.addListener((notificationId) => {

    if (pendingDownloads[notificationId]) {

        const downloadId = pendingDownloads[notificationId];

        chrome.downloads.resume(downloadId);

        delete pendingDownloads[notificationId];

        chrome.notifications.clear(notificationId);
    }
});