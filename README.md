# PixSecure

PixSecure is a browser-based security tool designed to detect and prevent malicious content hidden inside images, particularly through techniques like metadata-based and steganographic attacks.

It acts as a smart download filter, analyzing images before they are saved to the user’s system and warning or blocking potentially dangerous files.

### Features

* **Metadata Analysis** (EXIF-based detection): Extracts and inspects image metadata using lightweight parsing to identify anomalies.

* **Layered Detection System**:
    * **Layer 1:** File-type & basic heuristics
    * **Layer 2:** Deep metadata inspection
    * **(Planned) Layer 3+:** Advanced detection (ML / steganography)
* **Threat Scoring Engine:** Assigns risk scores based on suspicious patterns like:
    * Script tags
    * JavaScript schemes
    * Event handlers
    * Encoded payloads
* **Browser Extension Integration:** Intercepts downloads in real-time and evaluates them before saving.
* **Safe Testing Mode:**
Logs metadata and analysis results for debugging and improvement.

### Architecture

PixSecure follows a layered security architecture:

* **Client Layer (Browser Extension):** Intercepts downloads and forwards files for inspection.
* **Analysis Layer (Background Script):** Performs:
    * File classification
    * Metadata extraction (via exifr)
    * Feature detection & scoring
* Decision Engine:
    * ALLOW → Safe file
    * WARN → Suspicious
    * BLOCK → Malicious

### Project Structure

```
PixSecure/
├── background.js        # Core logic for interception & analysis
├── manifest.json        # Extension configuration
├── exifr.min.js         # EXIF metadata parser
├── test/                # Sample test files (images, archives)
```

### Installation

1. Clone the repository:
```
git clone https://github.com/varsha-thomas-2004/PixSecure.git
cd PixSecure
```

2. Open Chrome and go to:
```
chrome://extensions/
```

3. Enable Developer Mode
4. Click Load Unpacked
5. Select the PixSecure folder

### Testing

Test the extension using different image types:

* DSLR images (rich metadata)
* Mobile images
* Screenshots (minimal metadata)
* Images with embedded payloads (malicious samples)

What to Observe (Open chrome console):
* Extracted metadata fields
* Presence of suspicious strings
* Detection decisions (ALLOW / WARN / BLOCK)

### Future Enhancements
* Steganography detection (LSB analysis)
* Machine learning-based anomaly detection
* Web scanning for abusive image usage
* Visual dashboard for threat reports
* Integration with forensic reporting tools

### Tech Stack
* JavaScript (Browser Extension APIs)
EXIF Parsing: exifr
* (Planned) Python for advanced analysis
* (Planned) ML models for anomaly detection

### Use Cases
* Prevent downloading malicious images
* Detect hidden payloads in files
* Assist in digital forensics
* Enhance browser-level security

### Contributing

Contributions are welcome! You can help by:

* Improving detection logic
* Adding new test cases
* Enhancing UI/UX
* Integrating ML models