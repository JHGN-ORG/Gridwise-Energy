from PIL import Image

def remove_background(image_path, output_path, tolerance=15):
    img = Image.open(image_path).convert("RGBA")
    data = img.getdata()
    
    # Assume the top-left pixel is the background color
    bg_color = data[0]
    
    new_data = []
    for item in data:
        # Check if the pixel is close to the background color
        if (abs(item[0] - bg_color[0]) <= tolerance and
            abs(item[1] - bg_color[1]) <= tolerance and
            abs(item[2] - bg_color[2]) <= tolerance):
            # Make it fully transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

remove_background("public/logo.png", "public/logo_transparent.png", tolerance=20)
print("Done")
