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
    if (isUserInitiated(downloadItem))
    {
        chrome.downloads.cancel(downloadItem.id);
        console.log("Download paused");
    }
    else
    {
        console.log("Ignored non-user initiated download", downloadItem.id);
    }
}

chrome.downloads.onCreated.addListener(detectDownload);