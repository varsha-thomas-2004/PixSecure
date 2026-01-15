const Decision = {
    BLOCK: "block",
    WARN: "warn",
    ALLOW_ONCE: "allow_once"
}

function getExtension(filename) 
{
    if (!filename) 
        return "";
    const parts = filename.toLowerCase().split("."); //["file", "pdf"]
    return parts.length > 1 ? parts.pop() : ""; //return "pdf"
}

function decideDownload(item)
{
    const filename = item.url;
    const ext = getExtension(filename);
    const size = item.totalBytes || 0;

    const executableExts = ["exe", "scr", "bat", "cmd", "js", "vbs", "hta", "lnk"];
    const archiveExts = ["zip", "rar", "7z", "iso"];

    if (executableExts.includes(ext))
    {
        return {
            decision: Decision.BLOCK, 
            reason: "Executable file type."
        };
    }

    if (filename.match(/\.(pdf|jpg|jpeg|docx|png)\.(${executableExts.join("|")})$/i))
    {
        return {
            decision: Decision.BLOCK,
            reason: "Multiple extension deception."
        };
    }

    if (archiveExts.includes(ext))
    {
        return {
            decision: Decision.WARN,
            reason: "Archives may contain hidden executables."
        };
    }

    if (size > 100 * 1024 * 1024)
    {
        return {
            decision: Decision.WARN,
            reason: "Large file size."
        };
    }

    return {
        decision: Decision.ALLOW_ONCE,
        reason: "Nothing suspicious found."
    };
}

function isUserInitiated(item)
{
    return (
        (item.filename || item.url.startsWith("blob") || item.url.startsWith("http")) &&
        item.totalBytes !== undefined        
    );
}

function detectDownload(downloadItem) 
{
    console.log("Download detected!");
    console.log("File: ", downloadItem.filename);
    console.log("URL: ", downloadItem.url);
    console.log("Total Bytes:", downloadItem.totalBytes);

    if (!isUserInitiated(downloadItem))
    {
        console.log("Ignored non-user initiated download.", downloadItem.id);
    }

    chrome.downloads.cancel(downloadItem.id);
    console.log("Download intercepted.");

    const result = decideDownload(downloadItem);
    console.log("Decision: ", result.decision);
    console.log("Reason: ", result.reason);
}

chrome.downloads.onCreated.addListener(detectDownload);