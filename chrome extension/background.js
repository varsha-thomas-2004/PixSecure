const Decision = {
    BLOCK: "block",
    WARN: "warn",
    ALLOW: "allow"
};

function getExtension(filename) {
    if (!filename) return "";
    const parts = filename.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
}

function decideDownload(filename, size) {

    const ext = getExtension(filename);

    const executableExts = ["exe", "scr", "bat", "cmd", "js", "vbs", "hta", "lnk"];
    const archiveExts = ["zip", "rar", "7z", "iso"];

    if (executableExts.includes(ext)) {
        return { decision: Decision.BLOCK, reason: "Executable file type." };
    }

    const multiExtRegex = new RegExp(
        `\\.(pdf|jpg|jpeg|docx|png)\\.(${executableExts.join("|")})$`,
        "i"
    );

    if (multiExtRegex.test(filename)) {
        return { decision: Decision.BLOCK, reason: "Multiple extension deception." };
    }

    if (archiveExts.includes(ext)) {
        return { decision: Decision.WARN, reason: "Archive file." };
    }

    if (size > 100 * 1024 * 1024) {
        return { decision: Decision.WARN, reason: "Large file." };
    }

    return { decision: Decision.ALLOW, reason: "Nothing suspicious." };
}

async function deepInspect(buffer) {
    
    console.log("Deep inspect started");
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(buffer);

    const features = {
        hasScript: /<script/i.test(text),
        hasJS: /javascript:/i.test(text),
        hasEvent: /onerror|onload/i.test(text),
        hasPercentEncoding: /%3C|%3E/i.test(text),
        hasBase64: /[A-Za-z0-9+/=]{20,}={0,2}/.test(text)
    };

    let score = 0;

    if (features.hasScript) score += 5;
    if (features.hasJS) score += 6;
    if (features.hasEvent) score += 6;
    if (features.hasPercentEncoding) score += 5;
    if (features.hasBase64) score += 4;
    
    const base64Match = text.match(/[A-Za-z0-9+/]{20,}={0,2}/);

    if (base64Match) {
        console.log("Base64 candidate found:", base64Match[0]);

        try {
            const decoded = atob(base64Match[0]);
            console.log("Decoded base64:", decoded);

            if (decoded.toLowerCase().includes("<script>")) {
                console.log("Decoded script detected!");
                score += 6;
            }
        } catch (e) {
            console.log("Base64 decode failed");
        }
    }

    console.log("Deep Inspect Score:", score);

    if (score >= 8) return Decision.BLOCK;
    if (score >= 4) return Decision.WARN;

    return Decision.ALLOW;
}

// Use the onDeterminingFilename event to check downloads before they start, helps in obtaining the name and size before the download begins, allowing us to block or warn as needed.
// chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {

//     const filename = downloadItem.suggestedFilename || downloadItem.filename || "";
//     const size = downloadItem.totalBytes || 0;

//     console.log("Final filename:", filename);

//     const result = decideDownload(filename, size);

//     console.log("Decision:", result.decision);
//     console.log("Reason:", result.reason);

//     if (result.decision === Decision.BLOCK || result.decision === Decision.WARN) {

//     chrome.downloads.search({ id: downloadItem.id }, (results) => {

//         if (!results || results.length === 0) return;

//         const state = results[0].state;

//         if (state === "in_progress") {
//             chrome.downloads.cancel(downloadItem.id);
//             console.log("Download cancelled.");
//         } else {
//             console.log("Too late. Download state:", state);
//         }

//     });

//     return;
// }

//     // Allow
//     suggest({ filename: filename });
// });

chrome.downloads.onCreated.addListener(async (downloadItem) => {

    console.log("onCreated triggered for:", downloadItem.url);

    const url = downloadItem.url || "";

    const imageExts = ["jpg", "jpeg", "png"];

    const isImage = imageExts.some(ext =>
        url.toLowerCase().includes("." + ext)
    );

    if (!isImage) {
        console.log("Not an image, skipping deep inspect");
        return;
    }

    chrome.downloads.pause(downloadItem.id);

    try {
        console.log("Fetching file for deep inspect...");

        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        const deepResult = await deepInspect(buffer);

        console.log({
            filename: downloadItem.url,
            //score: score,
            decision: deepResult
        });

        if (deepResult === Decision.BLOCK) {
            chrome.downloads.cancel(downloadItem.id);
        } else {
            chrome.downloads.resume(downloadItem.id);
        }

    } catch (err) {
        console.error("Deep inspect error:", err);
        console.warn("Inspection failed — allowing download");
        chrome.downloads.resume(downloadItem.id);
    }
});