import base64
import requests

def test_image(path):
    with open(path, 'rb') as img:
        img_base64 = base64.b64encode(img.read()).decode('utf-8')
    payload = {"image": img_base64}
    res = requests.post("http://127.0.0.1:5000/analyze", json=payload)
    print(f"Testing {path} ->", res.json())

# Original image (no hidden data)
test_image("original images/image.png")           # Expected: {"safe": True}

# Stego image (LSB hidden data)
test_image("embedded images/image_embedded.png")  # Expected: {"safe": False}


