from stegano import lsb
from PIL import Image
import io

def is_stego_image(image_bytes: bytes) -> dict:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        secret = lsb.reveal(image)
        
        if secret:
            return {'is_stego': True, 'hidden_data': secret}
        else:
            return {'is_stego': False, 'hidden_data': None}
    
    except Exception:
        # Catch common error like "Impossible to detect message"
        return {'is_stego': False, 'hidden_data': None}
