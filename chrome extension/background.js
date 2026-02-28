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

// Use the onDeterminingFilename event to check downloads before they start, helps in obtaining the name and size before the download begins, allowing us to block or warn as needed.
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {

    const filename = downloadItem.suggestedFilename || downloadItem.filename || "";
    const size = downloadItem.totalBytes || 0;

    console.log("Final filename:", filename);

    const result = decideDownload(filename, size);

    console.log("Decision:", result.decision);
    console.log("Reason:", result.reason);

    if (result.decision === Decision.BLOCK || result.decision === Decision.WARN) {

    chrome.downloads.search({ id: downloadItem.id }, (results) => {

        if (!results || results.length === 0) return;

        const state = results[0].state;

        if (state === "in_progress") {
            chrome.downloads.cancel(downloadItem.id);
            console.log("Download cancelled.");
        } else {
            console.log("Too late. Download state:", state);
        }

    });

    return;
}

    // Allow
    suggest({ filename: filename });
});