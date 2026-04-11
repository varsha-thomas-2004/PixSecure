import os
import io
import argparse
import numpy as np
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from torch.serialization import safe_globals

from srnet import SRNet

app = Flask(__name__)
CORS(app)

model = None
device = torch.device("cpu")

def load_model():
    global model
    model = SRNet()
    weight_path = os.path.join(os.path.dirname(__file__), 'models', 'SRNet_model_weights.pt')
    
    if os.path.exists(weight_path):
        with safe_globals([argparse.Namespace]):
            ckpt = torch.load(weight_path, map_location=device, weights_only=True)
            
        sd = ckpt['model_state_dict'] if 'model_state_dict' in ckpt else ckpt
        
        # Mapping Kaggle flat parameter names to SRNet structural names 1-to-1
        new_sd = {}
        model_keys = list(model.state_dict().keys())
        ckpt_keys = list(sd.keys())
        
        for mk, ck in zip(model_keys, ckpt_keys):
            new_sd[mk] = sd[ck]
            
        model.load_state_dict(new_sd)
        model.to(device)
        model.eval()
        print(f"Loaded SRNet weights from {weight_path}")
    else:
        print(f"WARNING: Weights file not found at {weight_path}")

load_model()

@app.route('/analyze/image', methods=['POST'])
def analyze_image():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500
        
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image provided"}), 400

    try:
        # Preprocess exactly as SRNet requires (1 channel grayscale, 256x256)
        # We must use cropping instead of scaling to preserve pixel steganography patterns.
        file_bytes = file.read()
        img = Image.open(io.BytesIO(file_bytes)).convert("L")
        w, h = img.size
        
        if w < 256 or h < 256:
            return jsonify({"error": f"Image too small ({w}x{h}), must be at least 256x256"}), 400
            
        left = (w - 256) // 2
        top = (h - 256) // 2
        img = img.crop((left, top, left + 256, top + 256))
        
        arr = np.array(img, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).to(device)
        
        with torch.no_grad():
            log_probs = model(tensor)
            
        probs = torch.exp(log_probs).squeeze(0)
        stego_prob = float(probs[1])
        
        # Threshold: if stego probability > 0.5, label is stego
        is_stego = stego_prob > 0.5
        label = "stego" if is_stego else "cover"
        
        return jsonify({
            "label": label,
            "stego_probability": round(stego_prob, 4),
            "decision": "BLOCK" if is_stego else "ALLOW"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
