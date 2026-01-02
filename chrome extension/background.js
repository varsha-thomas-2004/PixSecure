function detectDownload(downloadItem) 
{
    console.log("Download detected!");
    console.log("File: ", downloadItem.filename);
    console.log("URL: ", downloadItem.url);

    chrome.downloads.pause(downloadItem.id);
}

chrome.downloads.onCreated.addListener(detectDownload);