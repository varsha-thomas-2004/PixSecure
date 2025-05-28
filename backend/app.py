# Backend ivde aagunnu
from flask import Flask, jsonify, request
import base64
from analyzer import is_stego_image

app = Flask(__name__)
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        image_data = data.get('image')
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        image_bytes = base64.b64decode(image_data)
        result = is_stego_image(image_bytes)
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True,)