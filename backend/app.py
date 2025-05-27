# Backend ivde aagunnu
from flask import Flask, jsonify, request


app = Flask(__name__)
@app.route('/analyze', methods=['POST'])
def analyse():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text = data['text']
    # Simple analysis: count words and characters
    word_count = len(text.split())
    char_count = len(text)

    result = {
        'word_count': word_count,
        'char_count': char_count
    }
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True,)